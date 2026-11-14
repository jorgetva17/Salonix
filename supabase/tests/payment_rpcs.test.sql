begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

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

-- setup como postgres
select t.logout();
insert into public.salon_members (salon_id, user_id, role) values
  ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro'), 'professional');
insert into ids values ('paulo', gen_random_uuid()), ('corte', gen_random_uuid()), ('barba', gen_random_uuid()), ('cli', gen_random_uuid());
insert into public.professionals (id, salon_id, user_id, name, color) values
  ((select v from ids where k='paulo'), (select v from ids where k='salon_a'), (select v from ids where k='pro'), 'Paulo', '#1B3B4B');
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500),
  ((select v from ids where k='barba'), (select v from ids where k='salon_a'), 'Barba', 30, 3500);
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');
insert into public.commission_rates (salon_id, professional_id, service_id, percent) values
  ((select v from ids where k='salon_a'), (select v from ids where k='paulo'), null, 40),
  ((select v from ids where k='salon_a'), (select v from ids where k='paulo'), (select v from ids where k='barba'), 50);

-- Atendimento aguardando pagamento com Corte + Barba (8000) do Paulo.
create function t.awaiting(p_key text) returns uuid language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, arrived_at, duration_minutes, total_cents)
  values (v_id, (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo'),
          'walk_in', 'awaiting_payment', now() - interval '1 hour', now(), now() - interval '1 hour', 60, 8000);
  insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, professional_id, unit_price_cents, duration_minutes, created_at)
  values ((select v from ids where k='salon_a'), v_id, 'service', (select v from ids where k='corte'), (select v from ids where k='paulo'), 4500, 30, now() - interval '2 minutes'),
         ((select v from ids where k='salon_a'), v_id, 'service', (select v from ids where k='barba'), (select v from ids where k='paulo'), 3500, 30, now() - interval '1 minute');
  insert into ids values (p_key, v_id);
  return v_id;
end $$;
create function t.receive(p_key text, p_payments text, p_discount int default 0) returns text language sql as $$
  select status from public.receive_payment((select v from ids where k=p_key), p_payments::jsonb, p_discount);
$$;
grant execute on all functions in schema t to authenticated;
select t.awaiting('a1');
select t.awaiting('a2');
select t.awaiting('a3');

-- Receber ---------------------------------------------------------------------
select t.login((select v from ids where k='rec'));
select throws_ok($$select t.receive('a1', '[{"method": "cash", "amount_cents": 7000}]', 1000)$$,
  'Abra o caixa antes de receber.', 'receber exige caixa aberto');
insert into ids select 'cs', id from public.open_cash_session((select v from ids where k='salon_a'), 10000);

select is(t.receive('a1', '[{"method": "cash", "amount_cents": 7000}]', 1000), 'paid', 'recebe com desconto');
select is((select discount_cents from public.appointments where id = (select v from ids where k='a1')), 1000, 'grava o desconto');
select results_eq(
  format('select amount_cents, method, status, cash_session_id from public.transactions where appointment_id = %L', (select v from ids where k='a1')),
  format($$values (7000, 'cash'::text, 'paid'::text, %L::uuid)$$, (select v from ids where k='cs')),
  'uma entrada paga no caixa aberto');

select t.logout();
select results_eq(
  format($$select c.base_cents, c.amount_cents, c.percent from public.commissions c
           join public.appointment_items i on i.id = c.appointment_item_id
           where c.appointment_id = %L order by i.created_at$$, (select v from ids where k='a1')),
  $$values (3937, 1575, 40.00::numeric(5,2)), (3063, 1532, 50.00::numeric(5,2))$$,
  'desconto repartido e comissão arredondada por item');
select is((select count(*)::int from public.commissions where appointment_id = (select v from ids where k='a1')
  and status = 'available' and reference_month = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date), 2,
  'comissões disponíveis no mês local');
select t.login((select v from ids where k='rec'));
select is((select count(*)::int from public.appointment_events where appointment_id = (select v from ids where k='a1') and event = 'paid'), 1,
  'evento paid');

select throws_ok($$select t.receive('a1', '[{"method": "cash", "amount_cents": 7000}]', 1000)$$,
  'Atendimento não pode mudar deste status.', 'não recebe duas vezes');
select is((select count(*)::int from public.transactions where appointment_id = (select v from ids where k='a1')), 1,
  'continua uma entrada');

-- Pix pendente ------------------------------------------------------------------
select is(t.receive('a2', '[{"method": "cash", "amount_cents": 4000}, {"method": "pix", "amount_cents": 4000}]'), 'paid', 'recebe dividido com Pix');
insert into ids select 'pix', id from public.transactions where appointment_id = (select v from ids where k='a2') and method = 'pix';
select results_eq(
  format('select status, paid_at is null from public.transactions where id = %L', (select v from ids where k='pix')),
  $$values ('pending'::text, true)$$, 'Pix nasce pendente');
select t.logout();
select is((select array_agg(distinct status) from public.commissions where appointment_id = (select v from ids where k='a2')), array['blocked'],
  'comissão bloqueada com Pix pendente');

select t.login((select v from ids where k='pro'));
select throws_ok(format('select public.confirm_pix(%L)', (select v from ids where k='pix')), 'Sem permissão.', 'profissional não confirma Pix');
select t.login((select v from ids where k='rec'));
select is((select status from public.confirm_pix((select v from ids where k='pix'))), 'paid', 'confirma o Pix');
select t.logout();
select is((select array_agg(distinct status) from public.commissions where appointment_id = (select v from ids where k='a2')), array['available'],
  'Pix confirmado libera a comissão');
select t.login((select v from ids where k='rec'));
select throws_ok(format('select public.confirm_pix(%L)', (select v from ids where k='pix')), 'Pix já confirmado.', 'não confirma duas vezes');

-- Conferência -------------------------------------------------------------------
select throws_ok($$select t.receive('a3', '[{"method": "cash", "amount_cents": 5000}]')$$,
  'Valor pago não confere com o total.', 'valor menor que o total');
select throws_ok($$select t.receive('a3', '[]', 9000)$$,
  'Desconto maior que o total.', 'desconto maior que o total');
select throws_ok($$select t.receive('a3', '[{"method": "boleto", "amount_cents": 8000}]')$$,
  'Valor pago não confere com o total.', 'forma inválida');
select t.login((select v from ids where k='pro'));
select throws_ok($$select t.receive('a3', '[{"method": "cash", "amount_cents": 8000}]')$$, 'Sem permissão.', 'profissional não recebe');
select t.login((select v from ids where k='bia'));
select throws_ok($$select t.receive('a3', '[{"method": "cash", "amount_cents": 8000}]')$$, 'Sem permissão.', 'outro salão não recebe');
select t.login((select v from ids where k='rec'));
select is(t.receive('a3', '[]', 8000), 'paid', 'desconto total aceita sem pagamento');
select t.logout();
select is((select sum(amount_cents)::int from public.commissions where appointment_id = (select v from ids where k='a3')), 0,
  'desconto total zera a comissão');

-- Repartição do desconto (interno) ---------------------------------------------
select is(public.allocate_discount('{4500,3500}', 1000), '{563,437}'::int[], 'resto vai para o primeiro empatado');
select is(public.allocate_discount('{1,1,1}', 2), '{1,1,0}'::int[], 'centavos inteiros sem sobra');

-- Estorno ------------------------------------------------------------------------
create function t.refund(p_key text, p_reason text default 'Cobrado em dobro') returns text language sql as $$
  select status from public.refund_appointment((select v from ids where k=p_key), p_reason);
$$;
grant execute on function t.refund(text, text) to authenticated;

select t.login((select v from ids where k='rec'));
select throws_ok($$select t.refund('a1')$$, 'Sem permissão.', 'recepção não estorna');
select t.login((select v from ids where k='bia'));
select throws_ok($$select t.refund('a1')$$, 'Sem permissão.', 'outro salão não estorna');

select t.login((select v from ids where k='ana'));
select is(t.refund('a1'), 'paid', 'estornado continua pago');
select t.logout();
insert into ids select 'in_a1', id from public.transactions where appointment_id = (select v from ids where k='a1') and type = 'income';
select is((select status from public.transactions where id = (select v from ids where k='in_a1')), 'reversed', 'entrada vira reversed');
select results_eq(
  format($$select amount_cents, method, status, category, cash_session_id from public.transactions where reverses_id = %L$$, (select v from ids where k='in_a1')),
  format($$values (7000, 'cash'::text, 'paid'::text, 'estorno'::text, %L::uuid)$$, (select v from ids where k='cs')),
  'saída de estorno no caixa aberto');
select is((select array_agg(distinct status) from public.commissions where appointment_id = (select v from ids where k='a1')), array['reversed'],
  'comissões estornadas');
select isnt((select refunded_at from public.appointments where id = (select v from ids where k='a1')), null, 'data do estorno');
select is((select data->>'reason' from public.appointment_events where appointment_id = (select v from ids where k='a1') and event = 'refunded'),
  'Cobrado em dobro', 'evento refunded com o motivo');

select t.login((select v from ids where k='ana'));
select throws_ok($$select t.refund('a1')$$, 'Atendimento já estornado.', 'não estorna duas vezes');
select throws_ok($$select t.refund('a2', '  ')$$, 'Informe o motivo do estorno.', 'motivo obrigatório');

-- Comissão já paga ao profissional: fica paga e ganha um abatimento negativo.
select t.logout();
update public.commissions set status = 'paid', paid_at = now() where appointment_id = (select v from ids where k='a2');
select t.login((select v from ids where k='ana'));
select t.refund('a2');
select t.logout();
select is((select count(*)::int from public.commissions where appointment_id = (select v from ids where k='a2') and status = 'paid'), 2,
  'comissões pagas continuam pagas');
select set_eq(
  format($$select amount_cents, status from public.commissions where appointment_id = %L and reverses_id is not null$$, (select v from ids where k='a2')),
  $$values (-1800, 'available'::text), (-1750, 'available'::text)$$,
  'abatimento negativo disponível');

-- Pix ainda pendente: só vira reversed, sem saída.
select t.awaiting('a4');
select t.login((select v from ids where k='rec'));
select t.receive('a4', '[{"method": "pix", "amount_cents": 8000}]');
select t.login((select v from ids where k='ana'));
select t.refund('a4');
select t.logout();
select is((select status from public.transactions where appointment_id = (select v from ids where k='a4') and type = 'income'), 'reversed',
  'Pix pendente vira reversed');
select is((select count(*)::int from public.transactions where appointment_id = (select v from ids where k='a4') and type = 'expense'), 0,
  'Pix nunca recebido não gera saída');
select is(public.cash_session_expected((select v from ids where k='cs')) - 'pix_pending',
  '{"cash": 10000, "debit": 0, "credit": 0, "pix": 0}'::jsonb, 'esperado desconta as saídas de estorno');

-- Sem caixa aberto.
select t.login((select v from ids where k='rec'));
select public.close_cash_session((select v from ids where k='cs'), '{}');
select t.login((select v from ids where k='ana'));
select throws_ok($$select t.refund('a3')$$, 'Abra o caixa antes de estornar.', 'estorno exige caixa aberto');

select * from finish();
rollback;
