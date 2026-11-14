begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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

select t.logout();
insert into public.salon_members (salon_id, user_id, role) values
  ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro'), 'professional'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'professional');
insert into ids values ('paulo', gen_random_uuid()), ('lia', gen_random_uuid()), ('corte', gen_random_uuid()), ('cli', gen_random_uuid());
insert into public.professionals (id, salon_id, user_id, name, color) values
  ((select v from ids where k='paulo'), (select v from ids where k='salon_a'), (select v from ids where k='pro'), 'Paulo', '#1B3B4B'),
  ((select v from ids where k='lia'), (select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'Lia', '#B45309');
-- sexta-feira (5): Paulo 09–12 e 13–18; Lia 09–18
insert into public.professional_schedules (salon_id, professional_id, weekday, starts_at, ends_at) values
  ((select v from ids where k='salon_a'), (select v from ids where k='paulo'), 5, '09:00', '12:00'),
  ((select v from ids where k='salon_a'), (select v from ids where k='paulo'), 5, '13:00', '18:00'),
  ((select v from ids where k='salon_a'), (select v from ids where k='lia'), 5, '09:00', '18:00');
insert into public.services (id, salon_id, name, duration_minutes, price_cents)
values ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500);
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');

create function t.book(p_prof text, p_local text) returns uuid language sql as $$
  select id from public.create_appointment(
    (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k=p_prof),
    array[(select v from ids where k='corte')], p_local::timestamp);
$$;
grant execute on function t.book(text, text) to authenticated;

-- agendar (sexta 20/11/2026, São Paulo = UTC-3)
select t.login((select v from ids where k='rec'));
insert into ids select 'a1', t.book('paulo', '2026-11-20 10:00');
select is((select starts_at from public.appointments where id = (select v from ids where k='a1')),
          '2026-11-20 13:00+00'::timestamptz, 'horário local do salão gravado em UTC');
select is((select total_cents from public.appointments where id = (select v from ids where k='a1')), 4500, 'total pelos serviços');
select is((select count(*)::int from public.appointment_items where appointment_id = (select v from ids where k='a1')), 1, 'um item por serviço');
select is((select event from public.appointment_events where appointment_id = (select v from ids where k='a1')), 'created', 'evento created');

select throws_ok($$ select t.book('paulo', '2026-11-20 10:00') $$, 'P0001',
  'Horário indisponível para este profissional.', 'mesmo horário é recusado');
select throws_ok($$ select t.book('paulo', '2026-11-20 10:15') $$, 'P0001',
  'Horário indisponível para este profissional.', 'sobreposição parcial é recusada');
select throws_ok($$ select t.book('paulo', '2026-11-20 17:45') $$, 'P0001',
  'Fora da jornada do profissional.', 'passa do fim da jornada');
select throws_ok($$ select t.book('paulo', '2026-11-20 11:45') $$, 'P0001',
  'Fora da jornada do profissional.', 'atravessa o almoço');
select throws_ok($$ select t.book('paulo', '2026-11-22 10:00') $$, 'P0001',
  'Fora da jornada do profissional.', 'domingo sem jornada');

select t.login((select v from ids where k='ana'));
select public.create_schedule_block((select v from ids where k='paulo'), '2026-11-20 14:00', '2026-11-20 15:00', 'break');
select t.login((select v from ids where k='rec'));
select throws_ok($$ select t.book('paulo', '2026-11-20 14:30') $$, 'P0001',
  'Profissional bloqueado neste horário.', 'bloqueio impede agendar');

select t.login((select v from ids where k='pro'));
select throws_ok($$ select t.book('paulo', '2026-11-20 15:00') $$, 'P0001', 'Sem permissão.', 'profissional não agenda');
select t.login((select v from ids where k='bia'));
select throws_ok($$ select t.book('paulo', '2026-11-20 15:00') $$, 'P0001', 'Sem permissão.', 'admin de outro salão não agenda');

-- reagendar e cancelar
select t.login((select v from ids where k='rec'));
select public.reschedule_appointment((select v from ids where k='a1'), (select v from ids where k='paulo'), '2026-11-20 11:00');
select is(
  (select (data -> 'from' ->> 'starts_at')::timestamptz from public.appointment_events
   where appointment_id = (select v from ids where k='a1') and event = 'rescheduled'),
  '2026-11-20 13:00+00'::timestamptz, 'histórico guarda o horário anterior');
insert into ids select 'a2', t.book('paulo', '2026-11-20 10:00');
select pass('horário antigo ficou livre depois de reagendar');
select is((select status from public.cancel_appointment((select v from ids where k='a2'), 'cliente desmarcou')), 'cancelled', 'cancelar');
select lives_ok($$ select t.book('paulo', '2026-11-20 10:00') $$, 'horário de cancelado aceita novo agendamento');

-- iniciar e concluir
insert into ids select 'l1', t.book('lia', '2026-11-20 10:00');
select t.login((select v from ids where k='pro'));
select is((select status from public.start_appointment((select v from ids where k='a1'))), 'in_progress', 'profissional inicia o próprio');
select throws_ok(format($$ select public.start_appointment(%L) $$, (select v from ids where k='l1')),
  'P0001', 'Sem permissão.', 'profissional não inicia atendimento de colega');

select t.login((select v from ids where k='rec'));
insert into ids select 'a4', t.book('paulo', '2026-11-20 16:00');
select throws_ok(format($$ select public.start_appointment(%L) $$, (select v from ids where k='a4')),
  'P0001', 'Profissional já está em atendimento.', 'não inicia dois ao mesmo tempo');

select t.login((select v from ids where k='pro'));
select is((select status from public.complete_appointment((select v from ids where k='a1'))), 'awaiting_payment', 'concluir');
select throws_ok(format($$ select public.complete_appointment(%L) $$, (select v from ids where k='a1')),
  'P0001', 'Atendimento não pode mudar deste status.', 'concluir duas vezes');

select t.login((select v from ids where k='rec'));
select public.start_appointment((select v from ids where k='l1'));
select throws_ok(format($$ select public.mark_no_show(%L) $$, (select v from ids where k='l1')),
  'P0001', 'Atendimento não pode mudar deste status.', 'falta só antes de começar');
select is((select status from public.mark_no_show((select v from ids where k='a4'))), 'no_show', 'marcar falta');
select is((select count(*)::int from public.appointment_events where appointment_id = (select v from ids where k='a1')), 4,
          'histórico: created, rescheduled, started, completed');

select * from finish();
rollback;
