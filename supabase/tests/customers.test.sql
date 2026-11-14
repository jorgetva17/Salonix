begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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

-- recepção cria e edita
select t.login((select v from ids where k='rec'));
insert into public.customers (salon_id, name, phone)
values ((select v from ids where k='salon_a'), 'João Ávila', '11988887777');
insert into ids select 'joao', id from public.customers where phone = '11988887777';
update public.customers set notes = 'Prefere máquina 2' where id = (select v from ids where k='joao');
select is((select notes from public.customers where id = (select v from ids where k='joao')), 'Prefere máquina 2',
          'recepção cria e edita cliente');
select is((select name_search from public.customers where id = (select v from ids where k='joao')), 'joao avila',
          'name_search sem acento e minúsculo');

select throws_ok(
  format($$ insert into public.customers (salon_id, name, phone) values (%L, 'Outro João', '11988887777') $$,
         (select v from ids where k='salon_a')),
  '23505', null, 'telefone repetido no mesmo salão');
select throws_ok(
  format($$ insert into public.customers (salon_id, name, phone) values (%L, 'Fone ruim', '98888-7777') $$,
         (select v from ids where k='salon_a')),
  '23514', null, 'telefone fora do formato (só dígitos, 10 ou 11)');

delete from public.customers where id = (select v from ids where k='joao');
select is((select count(*)::int from public.customers), 1, 'recepção não apaga cliente');

-- profissional só lê
select t.login((select v from ids where k='pro'));
select is((select count(*)::int from public.customers), 1, 'profissional lê clientes');
select throws_ok(
  format($$ insert into public.customers (salon_id, name) values (%L, 'Novo') $$, (select v from ids where k='salon_a')),
  '42501', null, 'profissional não cria cliente');

-- outro salão
select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.customers), 0, 'outro salão não vê clientes');
insert into public.customers (salon_id, name, phone)
values ((select v from ids where k='salon_b'), 'João B', '11988887777');
select is((select count(*)::int from public.customers), 1, 'mesmo telefone em outro salão é permitido');

-- admin apaga
select t.login((select v from ids where k='ana'));
delete from public.customers where id = (select v from ids where k='joao');
select is((select count(*)::int from public.customers), 0, 'admin apaga cliente');

select * from finish();
rollback;
