begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
insert into ids values ('paulo', gen_random_uuid()), ('lia_b', gen_random_uuid()), ('eq', gen_random_uuid());
insert into public.professionals (id, salon_id, name, color) values
  ((select v from ids where k='paulo'), (select v from ids where k='salon_a'), 'Paulo', '#1B3B4B'),
  ((select v from ids where k='lia_b'), (select v from ids where k='salon_b'), 'Lia', '#1B3B4B');

select t.login((select v from ids where k='ana'));
select lives_ok($$
  insert into public.equipment (id, salon_id, name, professional_id)
  values ((select v from ids where k='eq'), (select v from ids where k='salon_a'), 'Máquina de corte', (select v from ids where k='paulo'))
$$, 'admin cria equipamento');
select lives_ok($$
  insert into public.equipment_maintenance (salon_id, equipment_id, performed_on, description, cost_cents, next_due)
  values ((select v from ids where k='salon_a'), (select v from ids where k='eq'), '2026-11-20', 'Troca de lâmina', 8000, '2026-12-20')
$$, 'admin registra manutenção');
select throws_ok($$
  insert into public.equipment_maintenance (salon_id, equipment_id, performed_on, description, next_due)
  values ((select v from ids where k='salon_a'), (select v from ids where k='eq'), '2026-11-20', 'Revisão', '2026-11-19')
$$, '23514', null, 'próxima antes da realizada');
select throws_ok($$
  insert into public.equipment (salon_id, name, professional_id)
  values ((select v from ids where k='salon_a'), 'Secador', (select v from ids where k='lia_b'))
$$, '23503', null, 'responsável de outro salão');

select t.login((select v from ids where k='rec'));
select is((select count(*)::int from public.equipment) + (select count(*)::int from public.equipment_maintenance), 2, 'recepção lê equipamento e manutenção');
select throws_ok($$
  insert into public.equipment (salon_id, name) values ((select v from ids where k='salon_a'), 'Secador')
$$, '42501', null, 'recepção não cria equipamento');
select throws_ok($$
  insert into public.equipment_maintenance (salon_id, equipment_id, performed_on, description)
  values ((select v from ids where k='salon_a'), (select v from ids where k='eq'), '2026-11-21', 'Limpeza')
$$, '42501', null, 'recepção não registra manutenção');
update public.equipment set status = 'inactive';
select t.login((select v from ids where k='pro'));
select is((select count(*)::int from public.equipment), 1, 'profissional lê equipamento');
select throws_ok($$
  insert into public.equipment (salon_id, name) values ((select v from ids where k='salon_a'), 'Secador')
$$, '42501', null, 'profissional não cria equipamento');
delete from public.equipment_maintenance;
select t.logout();
select is((select status from public.equipment where id = (select v from ids where k='eq')), 'active', 'update da recepção não muda o status');
select is((select count(*)::int from public.equipment_maintenance), 1, 'delete do profissional não apaga manutenção');

select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.equipment) + (select count(*)::int from public.equipment_maintenance), 0, 'outro salão não lê nada');

select * from finish();
rollback;
