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
create function pg_temp.make_appt(p_pro uuid, p_services uuid[], p_status public.appointment_status default 'awaiting_payment') returns uuid
language plpgsql as $$
declare v_id uuid; v_total int; v_start timestamptz;
begin
  select now() + count(*) * interval '2 hours' into v_start from public.appointments where professional_id = p_pro;
  select coalesce(sum(price_cents), 0) into v_total from public.services where id = any (p_services);
  insert into public.appointments (salon_id, guest_name, professional_id, kind, status, arrived_at, started_at, starts_at, ends_at, total_cents)
  values (current_setting('t.a')::uuid, 'Cliente', p_pro, 'walk_in', p_status, clock_timestamp(), clock_timestamp(), v_start, v_start + interval '1 hour', v_total)
  returning id into v_id;
  insert into public.appointment_items (appointment_id, salon_id, service_id, description, unit_price_cents, duration_minutes, professional_id)
  select v_id, current_setting('t.a')::uuid, s.id, s.name, s.price_cents, s.duration_minutes, p_pro from public.services s where s.id = any (p_services);
  return v_id;
end $$;

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'admin-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'rec-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a3', 'paulo@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'admin-b@t.dev');

select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated; select public.create_salon('Salão A'); reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated; select public.create_salon('Salão B'); reset role;
select set_config('t.a', (select id::text from public.salons where name = 'Salão A'), true);

insert into public.salon_members (salon_id, user_id, role) values
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a2', 'reception'),
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a3', 'professional');
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ('00000000-0000-0000-0000-0000000000e1', current_setting('t.a')::uuid, 'Corte', 30, 4500);
insert into public.professionals (id, salon_id, user_id, name) values
  ('00000000-0000-0000-0000-0000000000f1', current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a3', 'Paulo');

-- itens: shampoo (ml, consumo) e pomada (revenda)
select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
insert into public.inventory_items (id, salon_id, name, unit, min_quantity) values
  ('00000000-0000-0000-0000-0000000000d1', current_setting('t.a')::uuid, 'Shampoo', 'ml', 200);
insert into public.inventory_items (id, salon_id, name, unit, min_quantity, sale_price_cents) values
  ('00000000-0000-0000-0000-0000000000d2', current_setting('t.a')::uuid, 'Pomada', 'un', 2, 3500);
insert into public.service_consumables (salon_id, service_id, item_id, quantity)
values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 20);

select is((select quantity from public.inventory_items where salon_id = current_setting('t.a')::uuid and name = 'Shampoo'), 0::numeric, 'item novo começa com estoque zero');
select throws_ok($$update public.inventory_items set quantity = 999 where name = 'Shampoo' and salon_id = current_setting('t.a')::uuid$$, 'P0001',
  'A quantidade só pode ser alterada por movimentações de estoque', 'quantidade não é editável direto');

-- movimentações ----------------------------------------------------------------------
select is((select quantity from public.record_stock_movement('00000000-0000-0000-0000-0000000000d1', 'in', 1000, 'Compra', 1200)), 1000::numeric, 'entrada soma ao estoque');
select is((select quantity from public.record_stock_movement('00000000-0000-0000-0000-0000000000d1', 'out', 100, 'Derramou')), 900::numeric, 'saída subtrai');
select is((select quantity from public.record_stock_movement('00000000-0000-0000-0000-0000000000d1', 'adjust', 850, 'Contagem')), 850::numeric, 'contagem ajusta para o valor contado');
select throws_ok($$select public.record_stock_movement('00000000-0000-0000-0000-0000000000d1', 'adjust', 850)$$, 'P0001', 'A contagem é igual ao estoque atual', 'contagem igual é recusada');
select public.record_stock_movement('00000000-0000-0000-0000-0000000000d2', 'in', 3, 'Compra', 1800);
reset role;
select is((select count(*)::int from public.stock_movements where item_id = '00000000-0000-0000-0000-0000000000d1'), 3, 'cada movimentação fica registrada');
select is((select unit_cost_cents from public.inventory_item_costs where item_id = '00000000-0000-0000-0000-0000000000d1'), 1200, 'custo unitário gravado na entrada');

-- recepção e profissional não movimentam ------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$select public.record_stock_movement('00000000-0000-0000-0000-0000000000d1', 'in', 5)$$, '42501', null, 'recepção não movimenta estoque');
select cmp_ok((select count(*)::int from public.inventory_items), '>=', 2, 'recepção lê o estoque');
select is((select count(*)::int from public.stock_movements) + (select count(*)::int from public.inventory_item_costs), 0, 'recepção não vê movimentações nem custos');
reset role;

-- baixa automática no recebimento + comissão não incide sobre produto ------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select public.open_cash_session(current_setting('t.a')::uuid, 0);
reset role;
select set_config('t.p1', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000e1']::uuid[], 'in_progress')::text, true);
select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select is((select total_cents from public.add_product_item(current_setting('t.p1')::uuid, '00000000-0000-0000-0000-0000000000d2', 2)), 11500, 'produto entra no total (4500 + 2 x 3500)');
select public.complete_appointment(current_setting('t.p1')::uuid);
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select status::text from public.receive_payment(current_setting('t.p1')::uuid, '[{"method":"cash","amount_cents":11500}]')), 'paid', 'recebe serviço + produto');
reset role;
select is((select quantity from public.inventory_items where salon_id = current_setting('t.a')::uuid and name = 'Shampoo'), 830::numeric, 'baixa automática do material do serviço (850 - 20)');
select is((select quantity from public.inventory_items where salon_id = current_setting('t.a')::uuid and name = 'Pomada'), 1::numeric, 'baixa do produto vendido (3 - 2)');
select is((select string_agg(type || ':' || delta::text, ',' order by type) from public.stock_movements where appointment_id = current_setting('t.p1')::uuid),
  'consumption:-20.000,out:-2.000', 'movimentações ligadas ao atendimento');
select is((select unit_cost_cents from public.stock_movements where appointment_id = current_setting('t.p1')::uuid and type = 'consumption'), 1200, 'custo do consumo fica registrado (snapshot)');
select is((select count(*)::int from public.commissions where appointment_id = current_setting('t.p1')::uuid and base_cents = 7000), 0, 'produto não gera comissão');

-- estorno devolve estoque ---------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select public.reverse_appointment(current_setting('t.p1')::uuid, 'Erro');
reset role;
select is((select quantity from public.inventory_items where salon_id = current_setting('t.a')::uuid and name = 'Shampoo'), 850::numeric, 'estorno devolve o material');
select is((select quantity from public.inventory_items where salon_id = current_setting('t.a')::uuid and name = 'Pomada'), 3::numeric, 'estorno devolve o produto');

-- estoque negativo é permitido (não bloqueia o atendimento) ------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select public.record_stock_movement('00000000-0000-0000-0000-0000000000d1', 'adjust', 10, 'Quase acabou');
reset role;
select set_config('t.p2', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000e1']::uuid[])::text, true);
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select lives_ok($$select public.receive_payment(current_setting('t.p2')::uuid, '[{"method":"cash","amount_cents":4500}]')$$, 'estoque insuficiente não bloqueia o recebimento');
reset role;
select is((select quantity from public.inventory_items where salon_id = current_setting('t.a')::uuid and name = 'Shampoo'), -10::numeric, 'estoque fica negativo (alerta)');

-- venda de balcão --------------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select total_cents from public.create_counter_sale(current_setting('t.a')::uuid, null, null, '00000000-0000-0000-0000-0000000000d2', 1)), 3500, 'venda de balcão nasce aguardando pagamento');
select public.receive_payment((select id from public.appointments where salon_id = current_setting('t.a')::uuid and status = 'awaiting_payment' and professional_id is null), '[{"method":"pix","amount_cents":3500}]');
reset role;
select is((select quantity from public.inventory_items where salon_id = current_setting('t.a')::uuid and name = 'Pomada'), 2::numeric, 'venda de balcão baixa o estoque');
select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select throws_ok($$select public.create_counter_sale(current_setting('t.a')::uuid, null, null, '00000000-0000-0000-0000-0000000000d2', 1)$$, '42501', null, 'profissional não vende no balcão');
reset role;

-- item não vendável e isolamento ------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$select public.create_counter_sale(current_setting('t.a')::uuid, null, null, '00000000-0000-0000-0000-0000000000d1', 1)$$, 'P0001', 'Este item não está à venda', 'item sem preço de venda não é vendável');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select is((select count(*)::int from public.inventory_items) + (select count(*)::int from public.stock_movements), 0, 'outro salão não vê estoque');
select throws_ok($$select public.record_stock_movement('00000000-0000-0000-0000-0000000000d1', 'in', 1)$$, '42501', null, 'outro salão não movimenta o estoque');
reset role;

-- equipamentos ---------------------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
insert into public.equipment (id, salon_id, name, responsible_id) values
  ('00000000-0000-0000-0000-0000000000b9', current_setting('t.a')::uuid, 'Máquina de corte', '00000000-0000-0000-0000-0000000000f1');
insert into public.equipment_maintenance (id, salon_id, equipment_id, description, next_due_on)
values ('00000000-0000-0000-0000-0000000000c9', current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000b9', 'Troca de lâmina', current_date + 30);
insert into public.equipment_maintenance_costs (maintenance_id, salon_id, cost_cents) values ('00000000-0000-0000-0000-0000000000c9', current_setting('t.a')::uuid, 8000);
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select count(*)::int from public.equipment) + (select count(*)::int from public.equipment_maintenance), 2, 'recepção lê equipamentos e histórico');
select is((select count(*)::int from public.equipment_maintenance_costs), 0, 'recepção não vê custo de manutenção');
select throws_ok($$insert into public.equipment (salon_id, name) values (current_setting('t.a')::uuid, 'Secador')$$, '42501', null, 'recepção não cadastra equipamento');
reset role;

select * from finish();
rollback;
