begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

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
  ('pro1', t.create_user('pro1@a.com')),
  ('pro2', t.create_user('pro2@a.com')),
  ('bia', t.create_user('bia@b.com'));

select t.login((select v from ids where k='ana'));
insert into ids select 'salon_a', id from public.create_salon('Salão A');
select t.login((select v from ids where k='bia'));
insert into ids select 'salon_b', id from public.create_salon('Salão B');

select t.logout();
insert into public.salon_members (salon_id, user_id, role) values
  ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro1'), 'professional'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'professional');
insert into ids values ('p1', gen_random_uuid()), ('p2', gen_random_uuid()), ('corte', gen_random_uuid()),
  ('barba', gen_random_uuid()), ('sb', gen_random_uuid()), ('cli', gen_random_uuid());
insert into public.professionals (id, salon_id, user_id, name, color) values
  ((select v from ids where k='p1'), (select v from ids where k='salon_a'), (select v from ids where k='pro1'), 'P1', '#1B3B4B'),
  ((select v from ids where k='p2'), (select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'P2', '#B45309');
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500),
  ((select v from ids where k='barba'), (select v from ids where k='salon_a'), 'Barba', 30, 3500),
  ((select v from ids where k='sb'), (select v from ids where k='salon_b'), 'Outro', 30, 1000);
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');
insert into public.professional_schedules (salon_id, professional_id, weekday, starts_at, ends_at) values
  ((select v from ids where k='salon_a'), (select v from ids where k='p1'), 5, '09:00', '18:00');

create function t.book(p_time text) returns uuid language sql as $$
  select id from public.create_appointment(
    (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='p1'),
    array[(select v from ids where k='corte')], ('2026-11-20 ' || p_time)::timestamp);
$$;
create function t.add(p_appt text, p_service text) returns uuid language sql as $$
  select id from public.add_appointment_item((select v from ids where k=p_appt), (select v from ids where k=p_service));
$$;
create function t.total(p_appt text) returns integer language sql as $$
  select total_cents from public.appointments where id = (select v from ids where k=p_appt);
$$;

-- Itens -----------------------------------------------------------------------
select t.login((select v from ids where k='rec'));
insert into ids values ('a1', t.book('10:00'));
select is((select professional_id from public.appointment_items where appointment_id = (select v from ids where k='a1')),
  (select v from ids where k='p1'), 'item novo grava o profissional do atendimento');

select public.start_appointment((select v from ids where k='a1'));
insert into ids values ('barba1', t.add('a1', 'barba'));
select is(t.total('a1'), 8000, 'adicionar Barba soma ao total');
select is((select professional_id from public.appointment_items where id = (select v from ids where k='barba1')),
  (select v from ids where k='p1'), 'item adicionado é do profissional do atendimento');
select is((select count(*)::int from public.appointment_events
  where appointment_id = (select v from ids where k='a1') and event = 'item_added' and data->>'service_id' = (select v from ids where k='barba')::text),
  1, 'evento item_added com o serviço');

select public.remove_appointment_item((select v from ids where k='barba1'));
select is(t.total('a1'), 4500, 'remover a Barba volta o total');
select throws_ok(
  format('select public.remove_appointment_item(%L)', (select id from public.appointment_items where appointment_id = (select v from ids where k='a1'))),
  'Atendimento precisa de pelo menos um serviço.', 'não remove o último serviço');

select t.login((select v from ids where k='pro1'));
select lives_ok(format('select t.add(%L, %L)', 'a1', 'barba'), 'profissional adiciona no próprio atendimento em curso');
select throws_ok(
  format('select public.add_appointment_item(%L, %L, %L)', (select v from ids where k='a1'), (select v from ids where k='barba'), (select v from ids where k='p2')),
  'Sem permissão.', 'profissional não lança item em nome de colega');
select t.logout();
insert into ids select 'item_a1', id from public.appointment_items where appointment_id = (select v from ids where k='a1') limit 1;
select t.login((select v from ids where k='pro2'));
select throws_ok(format('select t.add(%L, %L)', 'a1', 'barba'), 'Sem permissão.', 'profissional não mexe no atendimento de colega');
select throws_ok(format('select public.remove_appointment_item(%L)', (select v from ids where k='item_a1')),
  'Sem permissão.', 'profissional não remove item de colega');

select t.login((select v from ids where k='rec'));
select throws_ok(format('select t.add(%L, %L)', 'a1', 'sb'), 'Serviço inválido.', 'serviço de outro salão é recusado');

select t.login((select v from ids where k='pro1'));
select public.complete_appointment((select v from ids where k='a1'));
select throws_ok(format('select t.add(%L, %L)', 'a1', 'barba'), 'Sem permissão.', 'profissional não ajusta depois de concluir');
select t.login((select v from ids where k='rec'));
select lives_ok(format('select t.add(%L, %L)', 'a1', 'barba'), 'recepção ajusta aguardando pagamento');

select t.logout();
update public.appointments set status = 'paid' where id = (select v from ids where k='a1');
select t.login((select v from ids where k='rec'));
select throws_ok(format('select t.add(%L, %L)', 'a1', 'barba'), 'Atendimento não pode mudar deste status.', 'pago não muda');

select t.login((select v from ids where k='bia'));
select throws_ok(format('select t.add(%L, %L)', 'a1', 'barba'), 'Sem permissão.', 'outro salão não mexe');

-- Desfazer início --------------------------------------------------------------
select t.login((select v from ids where k='rec'));
insert into ids values ('a2', t.book('11:00'));
select public.start_appointment((select v from ids where k='a2'));
select public.revert_appointment_start((select v from ids where k='a2'));
select results_eq(
  format('select status, starts_at from public.appointments where id = %L', (select v from ids where k='a2')),
  $$values ('scheduled'::text, '2026-11-20 14:00+00'::timestamptz)$$,
  'agendado volta a agendado no horário original');
select is((select count(*)::int from public.appointment_events where appointment_id = (select v from ids where k='a2') and event = 'reverted'),
  1, 'evento reverted');

insert into ids select 'w_p2', id from public.enqueue_walk_in(
  (select v from ids where k='salon_a'), (select v from ids where k='cli'), array[(select v from ids where k='corte')], (select v from ids where k='p2'));
select public.call_next_walk_in((select v from ids where k='salon_a'), (select v from ids where k='p2'));
select public.revert_appointment_start((select v from ids where k='w_p2'));
select results_eq(
  format('select status, professional_id, starts_at, ends_at from public.appointments where id = %L', (select v from ids where k='w_p2')),
  format($$values ('waiting'::text, %L::uuid, null::timestamptz, null::timestamptz)$$, (select v from ids where k='p2')),
  'walk-in que esperava P2 volta à fila esperando P2');
select is((select arrived_at from public.appointments where id = (select v from ids where k='w_p2'))
  = (select created_at from public.appointment_events where appointment_id = (select v from ids where k='w_p2') and event = 'created'),
  true, 'walk-in mantém a ordem de chegada');

insert into ids select 'w_any', id from public.enqueue_walk_in(
  (select v from ids where k='salon_a'), (select v from ids where k='cli'), array[(select v from ids where k='corte')], null);
select public.call_next_walk_in((select v from ids where k='salon_a'), (select v from ids where k='p1'));
select public.revert_appointment_start((select v from ids where k='w_any'));
select is((select professional_id from public.appointments where id = (select v from ids where k='w_any')), null,
  'walk-in da fila geral volta para a fila geral');

select public.call_next_walk_in((select v from ids where k='salon_a'), (select v from ids where k='p1'));
select t.login((select v from ids where k='pro1'));
select throws_ok(format('select public.revert_appointment_start(%L)', (select v from ids where k='w_any')),
  'Sem permissão.', 'profissional não desfaz início');
select t.login((select v from ids where k='bia'));
select throws_ok(format('select public.revert_appointment_start(%L)', (select v from ids where k='w_any')),
  'Sem permissão.', 'outro salão não desfaz início');

select * from finish();
rollback;
