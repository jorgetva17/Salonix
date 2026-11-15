begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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
insert into ids values ('corte', gen_random_uuid()), ('corte_b', gen_random_uuid()), ('sh', gen_random_uuid());
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500),
  ((select v from ids where k='corte_b'), (select v from ids where k='salon_b'), 'Corte', 30, 4500);
insert into public.inventory_items (id, salon_id, name, unit) values
  ((select v from ids where k='sh'), (select v from ids where k='salon_a'), 'Shampoo', 'ml');

select t.login((select v from ids where k='ana'));
select lives_ok($$
  insert into public.service_consumables (salon_id, service_id, inventory_item_id, quantity)
  values ((select v from ids where k='salon_a'), (select v from ids where k='corte'), (select v from ids where k='sh'), 10)
$$, 'admin liga serviço e item');
select throws_ok($$
  insert into public.service_consumables (salon_id, service_id, inventory_item_id, quantity)
  values ((select v from ids where k='salon_a'), (select v from ids where k='corte'), (select v from ids where k='sh'), 5)
$$, '23505', null, 'mesmo par duas vezes');
select throws_ok($$
  update public.service_consumables set quantity = 0
$$, '23514', null, 'quantidade zero');
select throws_ok($$
  insert into public.service_consumables (salon_id, service_id, inventory_item_id, quantity)
  values ((select v from ids where k='salon_a'), (select v from ids where k='corte_b'), (select v from ids where k='sh'), 5)
$$, '23503', null, 'serviço de outro salão');

select t.login((select v from ids where k='rec'));
select is((select count(*)::int from public.service_consumables), 1, 'recepção lê o consumo');
select throws_ok($$
  insert into public.service_consumables (salon_id, service_id, inventory_item_id, quantity)
  values ((select v from ids where k='salon_a'), (select v from ids where k='corte'), (select v from ids where k='sh'), 1)
$$, '42501', null, 'recepção não cria consumo');
select t.login((select v from ids where k='pro'));
select is((select count(*)::int from public.service_consumables), 1, 'profissional lê o consumo');
select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.service_consumables), 0, 'outro salão não lê');

select * from finish();
rollback;
