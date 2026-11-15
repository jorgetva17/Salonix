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
create function pg_temp.make_appt(p_pro uuid, p_services uuid[]) returns uuid
language plpgsql as $$
declare v_id uuid; v_total int; v_start timestamptz;
begin
  select now() + count(*) * interval '2 hours' into v_start from public.appointments where professional_id = p_pro;
  select coalesce(sum(price_cents), 0) into v_total from public.services where id = any (p_services);
  insert into public.appointments (salon_id, guest_name, professional_id, kind, status, arrived_at, started_at, starts_at, ends_at, total_cents)
  values (current_setting('t.a')::uuid, 'Cliente', p_pro, 'walk_in', 'awaiting_payment', clock_timestamp(), clock_timestamp(), v_start, v_start + interval '1 hour', v_total)
  returning id into v_id;
  insert into public.appointment_items (appointment_id, salon_id, service_id, description, unit_price_cents, duration_minutes, professional_id)
  select v_id, current_setting('t.a')::uuid, s.id, s.name, s.price_cents, s.duration_minutes, p_pro from public.services s where s.id = any (p_services);
  return v_id;
end $$;

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'admin-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'rec-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'admin-b@t.dev');

select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated; select public.create_salon('Salão A'); reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated; select public.create_salon('Salão B'); reset role;
select set_config('t.a', (select id::text from public.salons where name = 'Salão A'), true);
insert into public.salon_members (salon_id, user_id, role) values
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a2', 'reception');

insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ('00000000-0000-0000-0000-0000000000e1', current_setting('t.a')::uuid, 'Corte', 30, 4500),
  ('00000000-0000-0000-0000-0000000000e2', current_setting('t.a')::uuid, 'Barba', 20, 3000);
insert into public.professionals (id, salon_id, name) values
  ('00000000-0000-0000-0000-0000000000f1', current_setting('t.a')::uuid, 'Paulo'),
  ('00000000-0000-0000-0000-0000000000f2', current_setting('t.a')::uuid, 'Pedro');
insert into public.professional_default_commissions (salon_id, professional_id, commission_percent) values
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', 40),
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f2', 30);
insert into public.inventory_items (id, salon_id, name, unit) values
  ('00000000-0000-0000-0000-0000000000d1', current_setting('t.a')::uuid, 'Shampoo', 'ml');
insert into public.inventory_items (id, salon_id, name, unit, sale_price_cents) values
  ('00000000-0000-0000-0000-0000000000d2', current_setting('t.a')::uuid, 'Pomada', 'un', 3500);
insert into public.inventory_item_costs (item_id, salon_id, unit_cost_cents) values
  ('00000000-0000-0000-0000-0000000000d1', current_setting('t.a')::uuid, 2),
  ('00000000-0000-0000-0000-0000000000d2', current_setting('t.a')::uuid, 1800);
insert into public.service_consumables (salon_id, service_id, item_id, quantity)
values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 20);

-- despesas ------------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$select public.create_expense(current_setting('t.a')::uuid, 'aluguel', 'Aluguel', 20000, current_date, false)$$, '42501', null, 'recepção não lança despesa');
select throws_ok($$select public.financial_report(current_setting('t.a')::uuid, current_date, current_date)$$, '42501', null, 'recepção não vê relatórios');
reset role;

select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select throws_ok($$select public.create_expense(current_setting('t.a')::uuid, 'viagem', 'Algo', 100, current_date, false)$$, 'P0001', 'Categoria inválida', 'categoria precisa ser da lista');
select throws_ok($$select public.create_expense(current_setting('t.a')::uuid, 'aluguel', 'Aluguel', 0, current_date, false)$$, 'P0001', 'Informe um valor maior que zero', 'valor precisa ser positivo');
select throws_ok($$select public.create_expense(current_setting('t.a')::uuid, 'aluguel', 'Aluguel', 100, null, false)$$, 'P0001', 'Informe o vencimento', 'conta pendente exige vencimento');
select is((select status from public.create_expense(current_setting('t.a')::uuid, 'aluguel', 'Aluguel de novembro', 20000, current_date, true, 'pix')), 'paid', 'despesa já paga');
select is((select status from public.create_expense(current_setting('t.a')::uuid, 'energia', 'Conta de luz', 5000, current_date - 1, false)), 'pending', 'conta a pagar pendente');
select public.create_expense(current_setting('t.a')::uuid, 'internet', 'Internet', 3000, current_date + 10, false);
select is((select status from public.pay_expense((select id from public.transactions where description = 'Internet'), 'debit', current_date)), 'paid', 'pagar despesa pendente');
select throws_ok($$select public.pay_expense((select id from public.transactions where description = 'Internet'), 'debit')$$, 'P0001', 'Esta despesa não está pendente', 'não paga duas vezes');
select throws_ok($$select public.delete_expense((select id from public.transactions where description = 'Aluguel de novembro'))$$, 'P0001', null, 'despesa paga não pode ser excluída');
select lives_ok($$select public.create_expense(current_setting('t.a')::uuid, 'outros', 'Lançamento errado', 999, current_date + 5, false)$$, 'cria despesa pendente a excluir');
select lives_ok($$select public.delete_expense((select id from public.transactions where description = 'Lançamento errado'))$$, 'exclui despesa pendente');
reset role;

-- cenário de vendas ---------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select public.open_cash_session(current_setting('t.a')::uuid, 0);
reset role;
select set_config('t.a1', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000e1']::uuid[])::text, true);
select set_config('t.a2', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2']::uuid[])::text, true);
select set_config('t.a3', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f2', array['00000000-0000-0000-0000-0000000000e1']::uuid[])::text, true);
select set_config('t.a4', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f2', array['00000000-0000-0000-0000-0000000000e1']::uuid[])::text, true);

select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select public.receive_payment(current_setting('t.a1')::uuid, '[{"method":"cash","amount_cents":4500}]');
select public.receive_payment(current_setting('t.a2')::uuid, '[{"method":"pix","amount_cents":7000}]', 500);
select public.add_product_item(current_setting('t.a3')::uuid, '00000000-0000-0000-0000-0000000000d2', 1);
select public.receive_payment(current_setting('t.a3')::uuid, '[{"method":"debit","amount_cents":8000}]');
select public.receive_payment(current_setting('t.a4')::uuid, '[{"method":"cash","amount_cents":4500}]');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select public.reverse_appointment(current_setting('t.a4')::uuid, 'Erro de lançamento');

select set_config('t.r', public.financial_report(current_setting('t.a')::uuid, current_date - 1, current_date + 1)::text, true);
reset role;

select is((current_setting('t.r')::jsonb ->> 'revenue_cents')::int, 19500, 'faturamento = vendas pagas líquidas de desconto (estornada fica fora)');
select is((current_setting('t.r')::jsonb ->> 'appointments_count')::int, 3, 'três vendas no período');
select is((current_setting('t.r')::jsonb ->> 'avg_ticket_cents')::int, 6500, 'ticket médio');
select is((current_setting('t.r')::jsonb ->> 'discount_cents')::int, 500, 'descontos concedidos');
select is((current_setting('t.r')::jsonb ->> 'pending_pix_cents')::int, 7000, 'Pix a confirmar aparece separado');
select is((current_setting('t.r')::jsonb ->> 'refunds_cents')::int, 4500, 'estornos do período (informativo)');
select is((select jsonb_object_agg(e ->> 'method', (e ->> 'cents')::int) from jsonb_array_elements(current_setting('t.r')::jsonb -> 'by_method') e),
  '{"cash": 4500, "debit": 8000, "pix": 7000}'::jsonb, 'faturamento por forma de pagamento');
select is((select jsonb_object_agg(e ->> 'name', (e ->> 'cents')::int) from jsonb_array_elements(current_setting('t.r')::jsonb -> 'by_service') e),
  '{"Corte": 13200, "Barba": 2800}'::jsonb, 'por serviço: desconto rateado (Corte 4200 + Barba 2800 na venda com desconto)');
select is((current_setting('t.r')::jsonb ->> 'products_cents')::int, 3500, 'produtos vendidos separados dos serviços');
select is(
  (select sum((e ->> 'cents')::int)::int from jsonb_array_elements(current_setting('t.r')::jsonb -> 'by_service') e)
  + (current_setting('t.r')::jsonb ->> 'products_cents')::int,
  (current_setting('t.r')::jsonb ->> 'revenue_cents')::int, 'serviços + produtos = faturamento (sem erro de arredondamento)');
select is((select jsonb_object_agg(e ->> 'name', (e ->> 'cents')::int) from jsonb_array_elements(current_setting('t.r')::jsonb -> 'by_professional') e),
  '{"Paulo": 11500, "Pedro": 4500}'::jsonb, 'por profissional (serviços)');
select is((current_setting('t.r')::jsonb ->> 'materials_cost_cents')::int, 1920, 'custo real: 3 cortes x 20 ml x R$ 0,02 + pomada R$ 18,00');
select is((current_setting('t.r')::jsonb ->> 'cost_per_appointment_cents')::int, 640, 'custo médio por atendimento');
select is((current_setting('t.r')::jsonb ->> 'commissions_cents')::int, 6150, 'comissões do período (estornada fora)');
select is((current_setting('t.r')::jsonb ->> 'expenses_cents')::int, 23000, 'despesas pagas (aluguel + internet), sem estorno nem comissão');
select is((current_setting('t.r')::jsonb ->> 'payable_pending_cents')::int, 5000, 'contas a pagar pendentes');
select is((current_setting('t.r')::jsonb ->> 'payable_overdue_cents')::int, 5000, 'contas vencidas');
select is((current_setting('t.r')::jsonb ->> 'result_cents')::int, -11570, 'resultado = receita - materiais - comissões - despesas');

-- isolamento -----------------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select throws_ok($$select public.financial_report(current_setting('t.a')::uuid, current_date, current_date)$$, '42501', null, 'outro salão não acessa o relatório');
reset role;

select * from finish();
rollback;
