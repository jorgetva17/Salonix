begin;
set local search_path to public, extensions;
select plan(5);

create function pg_temp.make_user(p_id uuid, p_email text) returns void language sql as $$
  insert into auth.users (id, email) values (p_id, p_email);
$$;
create function pg_temp.claims(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
    set_config('request.jwt.claim.sub', p_uid::text, true);
$$;

select pg_temp.make_user('00000000-0000-0000-0000-00000000000a', 'a@test.dev');
select pg_temp.make_user('00000000-0000-0000-0000-00000000000b', 'b@test.dev');
select pg_temp.make_user('00000000-0000-0000-0000-00000000000c', 'c@test.dev');

select pg_temp.claims('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.create_salon('Salão A');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select public.create_salon('Salão B');
reset role;
insert into public.salon_members (salon_id, user_id, role)
select id, '00000000-0000-0000-0000-00000000000c', 'reception' from public.salons where name = 'Salão A';

select set_config('test.salon_a', (select id::text from public.salons where name = 'Salão A'), true);

-- admin do salão A grava na pasta do próprio salão
select pg_temp.claims('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('salon-logos', current_setting('test.salon_a') || '/light.png')$$,
  'admin grava em {salon_id}/light.png');
reset role;

-- recepção do salão A não grava
select pg_temp.claims('00000000-0000-0000-0000-00000000000c');
set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('salon-logos', current_setting('test.salon_a') || '/dark.png')$$,
  '42501', null, 'recepção não grava logo');
reset role;

-- admin de B não grava na pasta de A
select pg_temp.claims('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('salon-logos', current_setting('test.salon_a') || '/dark.png')$$,
  '42501', null, 'admin de outro salão não grava na pasta de A');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('salon-logos', 'nao-e-uuid/light.png')$$,
  '42501', null, 'pasta que não é UUID é rejeitada');
reset role;

select is((select file_size_limit from storage.buckets where id = 'salon-logos'), 2097152::bigint,
  'bucket limita arquivos a 2 MB');

select * from finish();
rollback;
