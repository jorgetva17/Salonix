begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create schema t;
create function t.create_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (gen_random_uuid(), p_email, jsonb_build_object('full_name', split_part(p_email, '@', 1)), 'authenticated', 'authenticated')
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
  ('pro', t.create_user('pro@a.com')),
  ('bia', t.create_user('bia@b.com'));

select t.login((select v from ids where k='ana'));
insert into ids select 'salon_a', id from public.create_salon('Salão A');
select t.login((select v from ids where k='bia'));
insert into ids select 'salon_b', id from public.create_salon('Salão B');
select t.logout();
insert into public.salon_members (salon_id, user_id, role) values
  ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro'), 'professional');

-- admin cria e edita
select t.login((select v from ids where k='ana'));
insert into public.services (salon_id, name, duration_minutes, price_cents)
values ((select v from ids where k='salon_a'), 'Corte', 30, 4500);
insert into ids select 'corte', id from public.services where name = 'Corte';
update public.services set price_cents = 5000 where id = (select v from ids where k='corte');
select is((select price_cents from public.services where id = (select v from ids where k='corte')), 5000, 'admin cria e edita serviço');

select throws_ok(
  format($$ insert into public.services (salon_id, name, duration_minutes, price_cents) values (%L, 'corte', 30, 4500) $$,
         (select v from ids where k='salon_a')),
  '23505', null, 'nome repetido (outra caixa) no mesmo salão');
select throws_ok(
  format($$ insert into public.services (salon_id, name, duration_minutes, price_cents) values (%L, 'Barba', 7, 3000) $$,
         (select v from ids where k='salon_a')),
  '23514', null, 'duração fora de múltiplo de 5');
select throws_ok(
  format($$ insert into public.services (salon_id, name, duration_minutes, price_cents) values (%L, 'Barba', 30, -1) $$,
         (select v from ids where k='salon_a')),
  '23514', null, 'preço negativo');

delete from public.services where id = (select v from ids where k='corte');
select is((select count(*)::int from public.services where id = (select v from ids where k='corte')), 1, 'admin não apaga serviço (só desativa)');

-- recepção e profissional
select t.login((select v from ids where k='rec'));
select throws_ok(
  format($$ insert into public.services (salon_id, name, duration_minutes, price_cents) values (%L, 'Escova', 30, 4000) $$,
         (select v from ids where k='salon_a')),
  '42501', null, 'recepção não cria serviço');
update public.services set price_cents = 1 where id = (select v from ids where k='corte');
select is((select count(*)::int from public.services), 1, 'recepção vê os serviços do salão');

select t.login((select v from ids where k='pro'));
select throws_ok(
  format($$ insert into public.services (salon_id, name, duration_minutes, price_cents) values (%L, 'Escova', 30, 4000) $$,
         (select v from ids where k='salon_a')),
  '42501', null, 'profissional não cria serviço');
update public.services set price_cents = 1 where id = (select v from ids where k='corte');

select t.logout();
select is((select price_cents from public.services where id = (select v from ids where k='corte')), 5000, 'update de recepção/profissional não altera');

-- outro salão
select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.services), 0, 'outro salão não vê serviços');
insert into public.services (salon_id, name, duration_minutes, price_cents)
values ((select v from ids where k='salon_b'), 'Corte', 30, 4000);
select is((select count(*)::int from public.services), 1, 'mesmo nome em outro salão é permitido');

select * from finish();
rollback;
