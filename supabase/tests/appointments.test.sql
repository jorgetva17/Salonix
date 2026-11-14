begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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
  ('pro2', t.create_user('pro2@a.com')),
  ('bia', t.create_user('bia@b.com'));

select t.login((select v from ids where k='ana'));
insert into ids select 'salon_a', id from public.create_salon('Salão A');
select t.login((select v from ids where k='bia'));
insert into ids select 'salon_b', id from public.create_salon('Salão B');

-- setup como postgres
select t.logout();
insert into public.salon_members (salon_id, user_id, role) values
  ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro'), 'professional'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'professional');
insert into ids values ('paulo', gen_random_uuid()), ('lia', gen_random_uuid()), ('corte', gen_random_uuid()),
  ('cli', gen_random_uuid()), ('a1', gen_random_uuid()), ('a2', gen_random_uuid()), ('w1', gen_random_uuid()),
  ('w2', gen_random_uuid());
insert into public.professionals (id, salon_id, user_id, name, color) values
  ((select v from ids where k='paulo'), (select v from ids where k='salon_a'), (select v from ids where k='pro'), 'Paulo', '#1B3B4B'),
  ((select v from ids where k='lia'), (select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'Lia', '#B45309');
insert into public.services (id, salon_id, name, duration_minutes, price_cents)
values ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500);
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');

insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, arrived_at, duration_minutes, total_cents) values
  ((select v from ids where k='a1'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo'),
   'scheduled', 'scheduled', '2026-11-20 13:00+00', '2026-11-20 13:30+00', null, 30, 4500),
  ((select v from ids where k='a2'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='lia'),
   'scheduled', 'scheduled', '2026-11-20 13:00+00', '2026-11-20 13:30+00', null, 30, 4500),
  ((select v from ids where k='w1'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), null,
   'walk_in', 'waiting', null, null, now(), 30, 4500),
  ((select v from ids where k='w2'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='lia'),
   'walk_in', 'waiting', null, null, now(), 30, 4500);
insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, unit_price_cents, duration_minutes)
select (select v from ids where k='salon_a'), v, 'service', (select v from ids where k='corte'), 4500, 30
from ids where k in ('a1', 'a2');
insert into public.appointment_events (salon_id, appointment_id, event)
select (select v from ids where k='salon_a'), v, 'created' from ids where k in ('a1', 'a2');

-- leitura por perfil
select t.login((select v from ids where k='ana'));
select is((select count(*)::int from public.appointments), 4, 'admin vê todos os atendimentos do salão');
select t.login((select v from ids where k='rec'));
select is((select count(*)::int from public.appointments), 4, 'recepção vê todos os atendimentos do salão');

select t.login((select v from ids where k='pro'));
select set_eq(
  'select id from public.appointments',
  format('values (%L::uuid), (%L::uuid)', (select v from ids where k='a1'), (select v from ids where k='w1')),
  'profissional vê os próprios e a fila geral, não os de colega');
select is((select count(*)::int from public.appointment_items where appointment_id = (select v from ids where k='a2')), 0,
          'profissional não lê itens de atendimento de colega');
select is((select count(*)::int from public.appointment_events where appointment_id = (select v from ids where k='a2')), 0,
          'profissional não lê histórico de atendimento de colega');
select is((select count(*)::int from public.appointment_items), 1, 'profissional lê os itens do próprio atendimento');

select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.appointments), 0, 'outro salão não vê atendimentos');

-- escrita direta não existe
select t.login((select v from ids where k='ana'));
select throws_ok(
  format($$ insert into public.appointments (salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, duration_minutes, total_cents)
            values (%L, %L, %L, 'scheduled', 'scheduled', '2026-11-21 13:00+00', '2026-11-21 13:30+00', 30, 4500) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo')),
  '42501', null, 'admin não insere atendimento direto (só por RPC)');

-- trava de horário e checks (como postgres)
select t.logout();
select throws_ok(
  format($$ insert into public.appointments (salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, duration_minutes, total_cents)
            values (%L, %L, %L, 'scheduled', 'scheduled', '2026-11-20 13:15+00', '2026-11-20 13:45+00', 30, 4500) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo')),
  '23P01', null, 'dois agendados sobrepostos do mesmo profissional');

insert into public.appointments (salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, arrived_at, duration_minutes, total_cents)
values ((select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo'),
        'walk_in', 'in_progress', '2026-11-20 13:10+00', '2026-11-20 13:40+00', '2026-11-20 13:05+00', 30, 4500);
select pass('walk-in em atendimento pode sobrepor agendado');

update public.appointments set status = 'cancelled' where id = (select v from ids where k='a1');
select lives_ok(
  format($$ insert into public.appointments (salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, duration_minutes, total_cents)
            values (%L, %L, %L, 'scheduled', 'scheduled', '2026-11-20 13:00+00', '2026-11-20 13:30+00', 30, 4500) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo')),
  'horário de agendamento cancelado fica livre');

select throws_ok(
  format($$ insert into public.appointments (salon_id, customer_id, professional_id, kind, status, duration_minutes, total_cents)
            values (%L, %L, %L, 'scheduled', 'scheduled', 30, 4500) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo')),
  '23514', null, 'agendado sem horário viola check');
select throws_ok(
  format($$ insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, unit_price_cents, duration_minutes)
            values (%L, %L, 'product', %L, 100, 0) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='a2'), (select v from ids where k='corte')),
  '23514', null, 'item_type product ainda não existe');
select throws_ok(
  format($$ insert into public.appointments (salon_id, customer_id, kind, status, duration_minutes, total_cents)
            values (%L, %L, 'walk_in', 'waiting', 30, 4500) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='cli')),
  '23514', null, 'walk-in sem chegada viola check');

select * from finish();
rollback;
