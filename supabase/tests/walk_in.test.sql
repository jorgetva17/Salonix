begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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
insert into ids values ('p1', gen_random_uuid()), ('p2', gen_random_uuid()), ('pb', gen_random_uuid()),
  ('corte', gen_random_uuid()), ('cli', gen_random_uuid());
insert into public.professionals (id, salon_id, user_id, name, color) values
  ((select v from ids where k='p1'), (select v from ids where k='salon_a'), (select v from ids where k='pro1'), 'P1', '#1B3B4B'),
  ((select v from ids where k='p2'), (select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'P2', '#B45309'),
  ((select v from ids where k='pb'), (select v from ids where k='salon_b'), null, 'PB', '#047857');
insert into public.services (id, salon_id, name, duration_minutes, price_cents)
values ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500);
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');

create function t.enqueue(p_prof text) returns uuid language sql as $$
  select id from public.enqueue_walk_in(
    (select v from ids where k='salon_a'), (select v from ids where k='cli'),
    array[(select v from ids where k='corte')], (select v from ids where k=p_prof));
$$;
create function t.call(p_prof text) returns uuid language sql as $$
  select id from public.call_next_walk_in((select v from ids where k='salon_a'), (select v from ids where k=p_prof));
$$;
grant execute on function t.enqueue(text), t.call(text) to authenticated;

-- fila: A (qualquer), B (prefere P2), C (qualquer); chegadas em ordem
select t.login((select v from ids where k='rec'));
insert into ids select 'A', t.enqueue(null);
select t.logout();
update public.appointments set arrived_at = now() - interval '3 seconds' where id = (select v from ids where k='A');
select t.login((select v from ids where k='rec'));
insert into ids select 'B', t.enqueue('p2');
select t.logout();
update public.appointments set arrived_at = now() - interval '2 seconds' where id = (select v from ids where k='B');
select t.login((select v from ids where k='rec'));
insert into ids select 'C', t.enqueue(null);
select t.logout();
update public.appointments set arrived_at = now() - interval '1 second' where id = (select v from ids where k='C');

select is((select status from public.appointments where id = (select v from ids where k='A')), 'waiting', 'walk-in entra como waiting');
select is((select starts_at from public.appointments where id = (select v from ids where k='A')), null::timestamptz, 'walk-in não reserva horário');

-- profissional vê a fila geral, não o walk-in que espera colega
select t.login((select v from ids where k='pro1'));
select set_eq('select id from public.appointments',
  format('values (%L::uuid), (%L::uuid)', (select v from ids where k='A'), (select v from ids where k='C')),
  'P1 vê a fila geral, mas não quem espera P2');

select is(t.call('p1'), (select v from ids where k='A'), 'P1 chama o primeiro da fila geral');
select is((select status from public.appointments where id = (select v from ids where k='A')), 'in_progress', 'chamado fica em atendimento');
select throws_ok($$ select t.call('p1') $$, 'P0001', 'Profissional já está em atendimento.', 'não chama com atendimento em curso');
select throws_ok($$ select t.call('p2') $$, 'P0001', 'Sem permissão.', 'P1 não chama para P2');

select public.complete_appointment((select v from ids where k='A'));
select is(t.call('p1'), (select v from ids where k='C'), 'P1 pula quem espera P2 e chama o próximo geral');

select t.login((select v from ids where k='pro2'));
select is(t.call('p2'), (select v from ids where k='B'), 'P2 chama quem esperava por ele');
select public.complete_appointment((select v from ids where k='B'));
select throws_ok($$ select t.call('p2') $$, 'P0001', 'Fila vazia para este profissional.', 'fila vazia');

select t.login((select v from ids where k='rec'));
select is((select count(*)::int from public.appointment_events where appointment_id = (select v from ids where k='C') and event = 'called'), 1,
          'evento called no histórico');
select throws_ok(format($$ select public.call_next_walk_in(%L, %L) $$, (select v from ids where k='salon_a'), (select v from ids where k='pb')),
  'P0001', 'Profissional não encontrado.', 'profissional de outro salão');

select t.login((select v from ids where k='pro1'));
select throws_ok($$ select t.enqueue(null) $$, 'P0001', 'Sem permissão.', 'profissional não enfileira');

select * from finish();
rollback;
