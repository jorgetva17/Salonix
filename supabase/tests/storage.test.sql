begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create schema t;
create function t.create_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
  values (gen_random_uuid(), p_email, '{}'::jsonb, 'authenticated', 'authenticated', now())
  returning id;
$$;
create function t.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
create function t.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into ids values
  ('ana', t.create_user('ana@a.com')),
  ('rec', t.create_user('rec@a.com')),
  ('bia', t.create_user('bia@b.com'));

select t.login((select v from ids where k='ana'));
insert into ids select 'salon_a', id from public.create_salon('Salão A');
select t.login((select v from ids where k='bia'));
insert into ids select 'salon_b', id from public.create_salon('Salão B');
select t.logout();
insert into public.salon_members (salon_id, user_id, role)
values ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception');

select is((select public from storage.buckets where id = 'salon-logos'), true, 'bucket de logos é público para leitura');
select is((select file_size_limit from storage.buckets where id = 'salon-logos'), 2097152::bigint, 'limite de 2 MB');

select t.login((select v from ids where k='ana'));
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('salon-logos', %L) $$,
         (select v from ids where k='salon_a') || '/light.png'),
  'admin grava logo do próprio salão');
select lives_ok(
  format($$ update storage.objects set name = name where bucket_id = 'salon-logos' and name = %L $$,
         (select v from ids where k='salon_a') || '/light.png'),
  'admin atualiza logo do próprio salão');

select t.login((select v from ids where k='rec'));
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('salon-logos', %L) $$,
         (select v from ids where k='salon_a') || '/dark.png'),
  '42501', null, 'recepção não grava logo');

select t.login((select v from ids where k='bia'));
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('salon-logos', %L) $$,
         (select v from ids where k='salon_a') || '/dark.png'),
  '42501', null, 'admin de outro salão não grava no salão A');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('salon-logos', 'nao-e-uuid/light.png') $$,
  '42501', null, 'caminho fora do padrão é recusado');

select * from finish();
rollback;
