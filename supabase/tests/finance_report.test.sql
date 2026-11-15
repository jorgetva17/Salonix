begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

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
insert into ids values ('paulo', gen_random_uuid()), ('corte', gen_random_uuid()), ('barba', gen_random_uuid()),
  ('cli', gen_random_uuid()), ('pomada', gen_random_uuid()), ('shampoo', gen_random_uuid()),
  ('a1', gen_random_uuid()), ('a2', gen_random_uuid()), ('a3', gen_random_uuid());
insert into public.professionals (id, salon_id, user_id, name, color) values
  ((select v from ids where k='paulo'), (select v from ids where k='salon_a'), (select v from ids where k='pro'), 'Paulo', '#1B3B4B');
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500),
  ((select v from ids where k='barba'), (select v from ids where k='salon_a'), 'Barba', 20, 3500);
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');
insert into public.commission_rates (salon_id, professional_id, service_id, percent) values
  ((select v from ids where k='salon_a'), (select v from ids where k='paulo'), null, 40);
insert into public.inventory_items (id, salon_id, name, unit, unit_cost_cents, sale_price_cents) values
  ((select v from ids where k='pomada'), (select v from ids where k='salon_a'), 'Pomada', 'un', 1200, 2000),
  ((select v from ids where k='shampoo'), (select v from ids where k='salon_a'), 'Shampoo', 'ml', 3, null);
insert into public.service_consumables (salon_id, service_id, inventory_item_id, quantity) values
  ((select v from ids where k='salon_a'), (select v from ids where k='corte'), (select v from ids where k='shampoo'), 10);

-- Corte + Barba + Pomada aguardando pagamento.
insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, arrived_at, ends_at, duration_minutes, total_cents)
values ((select v from ids where k='a1'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo'),
        'walk_in', 'awaiting_payment', now() - interval '1 hour', now() - interval '1 hour', now(), 50, 10000);
insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, inventory_item_id, professional_id, quantity, unit_price_cents, duration_minutes, created_at) values
  ((select v from ids where k='salon_a'), (select v from ids where k='a1'), 'service', (select v from ids where k='corte'), null, (select v from ids where k='paulo'), 1, 4500, 30, now() - interval '3 minutes'),
  ((select v from ids where k='salon_a'), (select v from ids where k='a1'), 'service', (select v from ids where k='barba'), null, (select v from ids where k='paulo'), 1, 3500, 20, now() - interval '2 minutes'),
  ((select v from ids where k='salon_a'), (select v from ids where k='a1'), 'product', null, (select v from ids where k='pomada'), (select v from ids where k='paulo'), 1, 2000, 0, now() - interval '1 minute');

-- Hoje no fuso do salão.
create function t.today() returns date language sql as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
create function t.report(p_from date, p_to date) returns jsonb language sql as $$
  select public.finance_report((select v from ids where k='salon_a'), p_from, p_to);
$$;
grant execute on all functions in schema t to authenticated;

select t.login((select v from ids where k='rec'));
select public.open_cash_session((select v from ids where k='salon_a'), 0);
select public.receive_payment((select v from ids where k='a1'),
  '[{"method": "cash", "amount_cents": 6000}, {"method": "pix", "amount_cents": 2999}]', 1001);

select t.logout();
select is((select array_agg(net_cents order by created_at, id) from public.appointment_items where appointment_id = (select v from ids where k='a1')),
  array[4049, 3150, 1800], 'valor líquido de cada item gravado no recebimento');
select isnt((select paid_at from public.appointments where id = (select v from ids where k='a1')), null, 'data do recebimento gravada');

-- Relatório do dia --------------------------------------------------------------
select t.login((select v from ids where k='ana'));
create temp table r as select t.report(t.today(), t.today()) as j;
select is((select (j->>'revenue_cents')::int from r), 8999, 'faturamento líquido do desconto');
select is((select (j->>'appointments')::int from r), 1, 'um atendimento');
select is((select (j->>'discount_cents')::int from r), 1001, 'desconto do período');
select is((select (j->'by_method'->>'cash')::int from r), 6000, 'dinheiro');
select is((select (j->'by_method'->>'pix')::int from r), 2999, 'Pix, mesmo pendente');
select is((select (j->>'pix_pending_cents')::int from r), 2999, 'Pix a confirmar');
select is((select ((j->>'services_cents')::int, (j->>'products_cents')::int)::text from r), '(7199,1800)', 'serviços e produtos');
select is((select sum((x->>'amount_cents')::int)::int from r, jsonb_array_elements(j->'by_item') x), 8999, 'por item fecha com o total');
select is((select array_agg(x->>'id' order by x->>'id') from r, jsonb_array_elements(j->'by_item') x),
  (select array_agg(v::text order by v::text) from ids where k in ('corte', 'barba', 'pomada')),
  'cada linha por item traz o id do serviço ou produto');
select is((select (j->'by_method'->>'cash')::int + (j->'by_method'->>'debit')::int + (j->'by_method'->>'credit')::int + (j->'by_method'->>'pix')::int from r),
  8999, 'por forma fecha com o total');
select is((select j->'by_professional' from r), '[{"name": "Paulo", "appointments": 1, "amount_cents": 7199}]'::jsonb, 'por profissional só serviços');
select is((select (j->>'material_cost_cents')::int from r), 1230, 'custo do shampoo e da pomada');
select is((select (j->>'commission_cents')::int from r), 2880, 'comissões do período');
select is((select (j->'costs'->0->>'material_cost_cents')::int from r), 1230, 'custo por atendimento');
select is((select j->'costs'->0->>'label' from r), 'Carlos', 'rótulo do atendimento');

-- Virada do dia e estorno em outro mês -----------------------------------------------
select t.logout();
insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, duration_minutes, total_cents, paid_at, refunded_at) values
  ((select v from ids where k='a2'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo'),
   'scheduled', 'paid', '2026-11-01 01:30+00', '2026-11-01 02:00+00', 30, 5000, '2026-11-01 02:30+00', null),
  ((select v from ids where k='a3'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo'),
   'scheduled', 'paid', '2026-10-31 17:00+00', '2026-10-31 17:30+00', 30, 3000, '2026-10-31 18:00+00', '2026-11-03 12:00+00');
insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, professional_id, unit_price_cents, duration_minutes, net_cents) values
  ((select v from ids where k='salon_a'), (select v from ids where k='a2'), 'service', (select v from ids where k='corte'), (select v from ids where k='paulo'), 5000, 30, 5000),
  ((select v from ids where k='salon_a'), (select v from ids where k='a3'), 'service', (select v from ids where k='corte'), (select v from ids where k='paulo'), 3000, 30, 3000);
insert into public.transactions (salon_id, type, category, amount_cents, method, status, paid_at, appointment_id) values
  ((select v from ids where k='salon_a'), 'income', 'atendimento', 5000, 'cash', 'paid', '2026-11-01 02:30+00', (select v from ids where k='a2')),
  ((select v from ids where k='salon_a'), 'income', 'atendimento', 3000, 'cash', 'reversed', '2026-10-31 18:00+00', (select v from ids where k='a3'));

select t.login((select v from ids where k='ana'));
create temp table oct as select t.report('2026-10-01', '2026-10-31') as j;
select is((select (j->>'revenue_cents')::int from oct), 5000, '23:30 de 31/10 em Brasília entra em outubro; o estornado sai');
select is((select j->'refunded' from oct), '{"appointments": 1, "amount_cents": 3000}'::jsonb, 'estornado aparece em outubro');
select is((select count(*)::int from jsonb_array_elements((t.report('2026-11-01', '2026-11-30'))->'costs') x
  where x->>'appointment_id' in ((select v from ids where k='a2')::text, (select v from ids where k='a3')::text)), 0,
  'novembro não traz os de outubro');

-- Preenchimento dos já pagos -----------------------------------------------------------
-- O mesmo auxiliar do backfill da migration reparte o desconto de um atendimento antigo.
select t.logout();
update public.appointment_items set net_cents = null where appointment_id = (select v from ids where k='a1');
select public.set_item_net_cents((select v from ids where k='a1'), 1001);
select is((select array_agg(net_cents order by created_at, id) from public.appointment_items where appointment_id = (select v from ids where k='a1')),
  array[4049, 3150, 1800], 'auxiliar do backfill reparte o desconto como o recebimento');
-- Nenhum atendimento pago do banco (seed e testes) fica sem data ou com itens que não fecham.
select is((select count(*)::int from public.appointments a
  where a.status = 'paid' and (a.paid_at is null or a.total_cents - a.discount_cents is distinct from
    (select sum(i.net_cents) from public.appointment_items i where i.appointment_id = a.id))), 0,
  'pagos têm data e valor líquido que fecha com o total');
select t.login((select v from ids where k='ana'));

-- Contas pagas ------------------------------------------------------------------------
select public.create_bill((select v from ids where k='salon_a'), 'outros', 'Luz', 8000, t.today(), 'debit');
select public.create_bill((select v from ids where k='salon_a'), 'aluguel', 'Aluguel', 150000, t.today());
select is((t.report(t.today(), t.today())->>'bills_paid_cents')::int, 8000, 'só a conta paga entra');

-- Período e permissões -------------------------------------------------------------------
select throws_ok($$select t.report('2026-11-02', '2026-11-01')$$, 'Período inválido.', 'início depois do fim');
select throws_ok($$select t.report('2025-10-01', '2026-11-04')$$, 'Período inválido.', 'mais de 366 dias');
select t.login((select v from ids where k='rec'));
select throws_ok($$select t.report('2026-11-01', '2026-11-30')$$, 'Sem permissão.', 'recepção não vê relatório');
select t.login((select v from ids where k='pro'));
select throws_ok($$select t.report('2026-11-01', '2026-11-30')$$, 'Sem permissão.', 'profissional não vê relatório');
select t.login((select v from ids where k='bia'));
select throws_ok($$select t.report('2026-11-01', '2026-11-30')$$, 'Sem permissão.', 'outro salão não vê relatório');

select * from finish();
rollback;
