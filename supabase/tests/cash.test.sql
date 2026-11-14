begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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
  ('cli', gen_random_uuid()), ('a1', gen_random_uuid()), ('i1', gen_random_uuid()), ('i2', gen_random_uuid()),
  ('cs', gen_random_uuid());
insert into public.professionals (id, salon_id, user_id, name, color) values
  ((select v from ids where k='paulo'), (select v from ids where k='salon_a'), (select v from ids where k='pro'), 'Paulo', '#1B3B4B'),
  ((select v from ids where k='lia'), (select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'Lia', '#B45309');
insert into public.services (id, salon_id, name, duration_minutes, price_cents)
values ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500);
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');
insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, duration_minutes, total_cents)
values ((select v from ids where k='a1'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo'),
  'scheduled', 'paid', '2026-11-20 13:00+00', '2026-11-20 13:30+00', 30, 9000);
insert into public.appointment_items (id, salon_id, appointment_id, item_type, service_id, professional_id, unit_price_cents, duration_minutes) values
  ((select v from ids where k='i1'), (select v from ids where k='salon_a'), (select v from ids where k='a1'), 'service',
   (select v from ids where k='corte'), (select v from ids where k='paulo'), 4500, 30),
  ((select v from ids where k='i2'), (select v from ids where k='salon_a'), (select v from ids where k='a1'), 'service',
   (select v from ids where k='corte'), (select v from ids where k='lia'), 4500, 30);
insert into public.cash_sessions (id, salon_id, opening_cents) values ((select v from ids where k='cs'), (select v from ids where k='salon_a'), 10000);
insert into public.transactions (salon_id, type, category, amount_cents, method, status, paid_at, appointment_id, cash_session_id) values
  ((select v from ids where k='salon_a'), 'income', 'atendimento', 9000, 'cash', 'paid', now(), (select v from ids where k='a1'), (select v from ids where k='cs')),
  ((select v from ids where k='salon_a'), 'expense', 'comissao', 1800, 'cash', 'paid', now(), null, (select v from ids where k='cs'));
insert into public.commissions (salon_id, appointment_id, appointment_item_id, professional_id, base_cents, percent, amount_cents, reference_month, status) values
  ((select v from ids where k='salon_a'), (select v from ids where k='a1'), (select v from ids where k='i1'), (select v from ids where k='paulo'), 4500, 40, 1800, '2026-11-01', 'available'),
  ((select v from ids where k='salon_a'), (select v from ids where k='a1'), (select v from ids where k='i2'), (select v from ids where k='lia'), 4500, 50, 2250, '2026-11-01', 'available');

-- leitura por perfil
select t.login((select v from ids where k='ana'));
select is((select count(*)::int from public.transactions), 2, 'admin lê todas as transações');
select is((select count(*)::int from public.commissions), 2, 'admin lê todas as comissões');
select is((select count(*)::int from public.cash_sessions), 1, 'admin lê o caixa');

select t.login((select v from ids where k='rec'));
select is((select count(*)::int from public.cash_sessions), 1, 'recepção lê o caixa');
select is((select array_agg(category) from public.transactions), array['atendimento'], 'recepção lê a entrada, não a despesa de comissão');
select is((select count(*)::int from public.commissions), 0, 'recepção não lê comissões');

select t.login((select v from ids where k='pro'));
select is((select count(*)::int from public.transactions), 0, 'profissional não lê transações');
select is((select count(*)::int from public.cash_sessions), 0, 'profissional não lê o caixa');
select is((select array_agg(professional_id) from public.commissions), array[(select v from ids where k='paulo')],
  'profissional lê só a própria comissão');

select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.transactions) + (select count(*)::int from public.commissions)
  + (select count(*)::int from public.cash_sessions), 0, 'outro salão não lê nada');

-- escrita direta barrada
select t.login((select v from ids where k='ana'));
select throws_ok(
  format($$insert into public.transactions (salon_id, type, category, amount_cents, method, status) values (%L, 'income', 'atendimento', 100, 'cash', 'pending')$$,
    (select v from ids where k='salon_a')), '42501', null, 'admin não insere transação direto');
select throws_ok(
  format($$insert into public.cash_sessions (salon_id, opening_cents) values (%L, 0)$$, (select v from ids where k='salon_a')),
  '42501', null, 'admin não abre caixa direto');
select throws_ok(
  format($$update public.commissions set status = 'paid' where salon_id = %L$$, (select v from ids where k='salon_a')),
  '42501', null, 'admin não altera comissão direto');

-- constraints (como postgres)
select t.logout();
select throws_ok(
  format($$insert into public.cash_sessions (salon_id, opening_cents) values (%L, 0)$$, (select v from ids where k='salon_a')),
  '23505', null, 'uma sessão aberta por salão');
select lives_ok(
  format($$insert into public.cash_sessions (salon_id, opening_cents) values (%L, 0)$$, (select v from ids where k='salon_b')),
  'outro salão abre o próprio caixa');
select throws_ok(
  format($$insert into public.transactions (salon_id, type, category, amount_cents, method, status) values (%L, 'income', 'atendimento', 100, 'cash', 'paid')$$,
    (select v from ids where k='salon_a')), '23514', null, 'paga sem paid_at é recusada');
select throws_ok(
  format($$insert into public.transactions (salon_id, type, category, amount_cents, method, status) values (%L, 'income', 'atendimento', 100, 'boleto', 'pending')$$,
    (select v from ids where k='salon_a')), '23514', null, 'forma de pagamento inválida');
select throws_ok(
  format($$insert into public.commissions (salon_id, appointment_id, appointment_item_id, professional_id, base_cents, percent, amount_cents, reference_month, status)
    values (%L, %L, %L, %L, 4500, 40, -1800, '2026-11-01', 'available')$$,
    (select v from ids where k='salon_a'), (select v from ids where k='a1'), (select v from ids where k='i1'), (select v from ids where k='paulo')),
  '23514', null, 'comissão negativa só como estorno');
select throws_ok(
  format($$insert into public.commissions (salon_id, appointment_id, appointment_item_id, professional_id, base_cents, percent, amount_cents, reference_month, status)
    values (%L, %L, %L, %L, 4500, 40, 1800, '2026-11-15', 'available')$$,
    (select v from ids where k='salon_a'), (select v from ids where k='a1'), (select v from ids where k='i1'), (select v from ids where k='paulo')),
  '23514', null, 'mês de referência é o dia 1');
select lives_ok(
  format($$insert into public.appointment_events (salon_id, appointment_id, event) values (%L, %L, 'paid')$$,
    (select v from ids where k='salon_a'), (select v from ids where k='a1')),
  'evento paid é aceito');

select * from finish();
rollback;
