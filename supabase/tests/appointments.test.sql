begin;
set local search_path to public, extensions;
select plan(31);

create function pg_temp.make_user(p_id uuid, p_email text) returns void language sql as $$
  insert into auth.users (id, email) values (p_id, p_email);
$$;
create function pg_temp.claims(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
    set_config('request.jwt.claim.sub', p_uid::text, true);
$$;

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'admin-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'rec-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a3', 'paulo@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a4', 'pedro@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'admin-b@t.dev');

select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated; select public.create_salon('Salão A'); reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated; select public.create_salon('Salão B'); reset role;

select set_config('t.a', (select id::text from public.salons where name = 'Salão A'), true);
select set_config('t.b', (select id::text from public.salons where name = 'Salão B'), true);

insert into public.salon_members (salon_id, user_id, role) values
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a2', 'reception'),
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a3', 'professional'),
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a4', 'professional');

insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ('00000000-0000-0000-0000-0000000000e1', current_setting('t.a')::uuid, 'Corte', 30, 4500),
  ('00000000-0000-0000-0000-0000000000e2', current_setting('t.a')::uuid, 'Barba', 20, 3000);
insert into public.professionals (id, salon_id, user_id, name) values
  ('00000000-0000-0000-0000-0000000000f1', current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a3', 'Paulo'),
  ('00000000-0000-0000-0000-0000000000f2', current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a4', 'Pedro');
insert into public.professional_schedules (salon_id, professional_id, weekday, start_time, end_time)
select current_setting('t.a')::uuid, p, d, '09:00', '18:00'
from (values ('00000000-0000-0000-0000-0000000000f1'::uuid), ('00000000-0000-0000-0000-0000000000f2'::uuid)) v(p), generate_series(0, 6) d;
insert into public.customers (id, salon_id, name) values
  ('00000000-0000-0000-0000-0000000000c1', current_setting('t.a')::uuid, 'Maria');

-- amanhã às 10:00 (São Paulo)
select set_config('t.d1',
  ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day 10 hours') at time zone 'America/Sao_Paulo')::text, true);

-- 1-3: criação por recepção -----------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select ends_at - starts_at from public.create_appointment(current_setting('t.a')::uuid,
  '00000000-0000-0000-0000-0000000000c1', null, '00000000-0000-0000-0000-0000000000f1', current_setting('t.d1')::timestamptz,
  array['00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2']::uuid[])),
  interval '50 minutes', 'duração = soma dos serviços');
reset role;
select is((select total_cents from public.appointments where salon_id = current_setting('t.a')::uuid and kind = 'scheduled' limit 1), 7500, 'total em centavos = soma dos preços');
select is((select count(*)::int from public.appointment_items where salon_id = current_setting('t.a')::uuid), 2, 'itens gravados com snapshot');

-- 4: profissional não agenda
select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select throws_ok($$select public.create_appointment(current_setting('t.a')::uuid, null, 'X', '00000000-0000-0000-0000-0000000000f1',
  current_setting('t.d1')::timestamptz + interval '3 hours', array['00000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  '42501', null, 'profissional não cria agendamento');
reset role;

-- 5-9: regras de horário ----------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$select public.create_appointment(current_setting('t.a')::uuid, null, 'Cliente', '00000000-0000-0000-0000-0000000000f1',
  current_setting('t.d1')::timestamptz + interval '30 minutes', array['00000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  'P0001', 'Horário indisponível: já existe outro atendimento nesse período', 'conflito de horário é recusado');
select lives_ok($$select public.create_appointment(current_setting('t.a')::uuid, null, 'Cliente', '00000000-0000-0000-0000-0000000000f1',
  current_setting('t.d1')::timestamptz + interval '50 minutes', array['00000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  'horário colado ao anterior é aceito');
select lives_ok($$select public.create_appointment(current_setting('t.a')::uuid, null, 'Cliente', '00000000-0000-0000-0000-0000000000f2',
  current_setting('t.d1')::timestamptz, array['00000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  'outro profissional pode no mesmo horário');
select throws_ok($$select public.create_appointment(current_setting('t.a')::uuid, null, 'Cliente', '00000000-0000-0000-0000-0000000000f1',
  current_setting('t.d1')::timestamptz + interval '10 hours', array['00000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  'P0001', 'Fora da jornada do profissional', 'fora da jornada é recusado');
select throws_ok($$select public.create_appointment(current_setting('t.a')::uuid, null, 'Cliente', '00000000-0000-0000-0000-0000000000f1',
  now() - interval '1 day', array['00000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  'P0001', 'Não é possível agendar no passado', 'passado é recusado');
reset role;

insert into public.schedule_blocks (salon_id, professional_id, starts_at, ends_at, reason)
values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f2',
  current_setting('t.d1')::timestamptz + interval '2 hours', current_setting('t.d1')::timestamptz + interval '3 hours', 'Almoço');
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$select public.create_appointment(current_setting('t.a')::uuid, null, 'Cliente', '00000000-0000-0000-0000-0000000000f2',
  current_setting('t.d1')::timestamptz + interval '2 hours 10 minutes', array['00000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  'P0001', 'Profissional com bloqueio nesse horário', 'bloqueio é respeitado');
reset role;

-- 10: isolamento entre salões ------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select throws_ok($$select public.create_appointment(current_setting('t.a')::uuid, null, 'Invasor', '00000000-0000-0000-0000-0000000000f1',
  current_setting('t.d1')::timestamptz + interval '4 hours', array['00000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  '42501', null, 'admin de outro salão não agenda no salão A');
select is((select count(*)::int from public.appointments), 0, 'admin de outro salão não vê agendamentos');
reset role;

-- 12-14: reagendar e cancelar -------------------------------------------------------
select set_config('t.appt', (select id::text from public.appointments where salon_id = current_setting('t.a')::uuid and kind = 'scheduled' and starts_at = current_setting('t.d1')::timestamptz
  and professional_id = '00000000-0000-0000-0000-0000000000f1'), true);

select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select starts_at from public.reschedule_appointment(current_setting('t.appt')::uuid, current_setting('t.d1')::timestamptz + interval '3 hours')),
  current_setting('t.d1')::timestamptz + interval '3 hours', 'reagendar muda o horário');
reset role;
select is((select count(*)::int from public.appointment_events where appointment_id = current_setting('t.appt')::uuid and event_type = 'rescheduled'),
  1, 'reagendar grava histórico');

select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select status::text from public.cancel_appointment(current_setting('t.appt')::uuid, 'Cliente desistiu')), 'cancelled', 'cancelar muda o status');
select throws_ok($$select public.reschedule_appointment(current_setting('t.appt')::uuid, current_setting('t.d1')::timestamptz + interval '5 hours')$$,
  'P0001', 'Só é possível reagendar atendimentos agendados e ainda não iniciados', 'cancelado não reagenda');
select lives_ok($$select public.create_appointment(current_setting('t.a')::uuid, null, 'Reaproveita', '00000000-0000-0000-0000-0000000000f1',
  current_setting('t.d1')::timestamptz + interval '3 hours', array['00000000-0000-0000-0000-0000000000e1']::uuid[])$$,
  'horário do cancelado fica livre');
reset role;

-- 17-18: visibilidade do profissional ---------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a4');
set local role authenticated;
select is((select count(*)::int from public.appointments where professional_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'profissional não vê a agenda de outro');
select cmp_ok((select count(*)::int from public.appointments), '>=', 1, 'profissional vê a própria agenda');
reset role;

-- 19: escrita direta bloqueada -----------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$update public.appointments set status = 'paid'$$, '42501', null, 'update direto em appointments é negado');
reset role;

-- fila de walk-in ---------------------------------------------------------------------------
delete from public.appointments where salon_id = current_setting('t.a')::uuid and kind = 'scheduled';
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select public.enqueue_walk_in(current_setting('t.a')::uuid, null, 'Primeiro', '00000000-0000-0000-0000-0000000000f2', array['00000000-0000-0000-0000-0000000000e1']::uuid[]);
select public.enqueue_walk_in(current_setting('t.a')::uuid, null, 'Segundo', null, array['00000000-0000-0000-0000-0000000000e1']::uuid[]);
select public.enqueue_walk_in(current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000c1', null, null, array['00000000-0000-0000-0000-0000000000e2']::uuid[]);
reset role;
select is((select count(*)::int from public.appointments where salon_id = current_setting('t.a')::uuid and status = 'waiting' and starts_at is null), 3, 'walk-in entra na fila sem reservar horário');

-- profissional vê só a fila sem dono (Paulo não vê "Primeiro", que prefere Pedro)
select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select is((select count(*)::int from public.appointments), 2, 'profissional vê só a fila sem dono');
-- chamar para outro profissional é negado
select throws_ok($$select public.call_next(current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f2')$$,
  '42501', null, 'profissional não chama pelo colega');
-- Paulo chama: pula "Primeiro" (prefere Pedro) e pega "Segundo"
select is((select guest_name from public.call_next(current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1')),
  'Segundo', 'chama o primeiro elegível por ordem de chegada');
select throws_ok($$select public.call_next(current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1')$$,
  'P0001', 'Profissional já está em atendimento', 'não chama de novo com atendimento em curso');
reset role;

select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select guest_name from public.call_next(current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f2')),
  'Primeiro', 'quem tem preferência é chamado pelo profissional escolhido');
reset role;
select is((select status::text from public.appointments where guest_name = 'Primeiro'), 'in_progress', 'chamado vira em atendimento');

-- 29-31: início, no-show, histórico ------------------------------------------------------------
select set_config('t.w', (select id::text from public.appointments where salon_id = current_setting('t.a')::uuid and status = 'waiting'), true);
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select status::text from public.mark_no_show(current_setting('t.w')::uuid)), 'no_show', 'recepção marca no-show da fila');
reset role;
select is((select count(*)::int from public.appointment_events where salon_id = current_setting('t.a')::uuid and event_type = 'called'), 2, 'chamadas ficam no histórico');

insert into public.appointments (salon_id, guest_name, professional_id, kind, status, starts_at, ends_at)
values (current_setting('t.a')::uuid, 'Agendado', '00000000-0000-0000-0000-0000000000f2', 'scheduled', 'scheduled',
  current_setting('t.d1')::timestamptz + interval '6 hours', current_setting('t.d1')::timestamptz + interval '7 hours');
select set_config('t.s', (select id::text from public.appointments where guest_name = 'Agendado'), true);
select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select throws_ok($$select public.start_appointment(current_setting('t.s')::uuid)$$, '42501', null, 'profissional que não é o dono não inicia o atendimento');
reset role;

select pg_temp.claims('00000000-0000-0000-0000-0000000000a4');
set local role authenticated;
select is((select status::text from public.start_appointment(current_setting('t.s')::uuid)), 'in_progress', 'profissional dono inicia o próprio atendimento');
reset role;

select * from finish();
rollback;
