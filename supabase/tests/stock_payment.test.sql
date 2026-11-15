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
insert into ids values ('ana', t.create_user('ana@a.com'));

select t.login((select v from ids where k='ana'));
insert into ids select 'salon_a', id from public.create_salon('Salão A');

select t.logout();
insert into ids values ('paulo', gen_random_uuid()), ('corte', gen_random_uuid()), ('barba', gen_random_uuid()), ('cli', gen_random_uuid()),
  ('shampoo', gen_random_uuid()), ('pomada', gen_random_uuid());
insert into public.professionals (id, salon_id, name, color) values
  ((select v from ids where k='paulo'), (select v from ids where k='salon_a'), 'Paulo', '#1B3B4B');
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500),
  ((select v from ids where k='barba'), (select v from ids where k='salon_a'), 'Barba', 30, 3500);
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');
insert into public.inventory_items (id, salon_id, name, unit, unit_cost_cents, sale_price_cents) values
  ((select v from ids where k='shampoo'), (select v from ids where k='salon_a'), 'Shampoo', 'ml', 3, null),
  ((select v from ids where k='pomada'), (select v from ids where k='salon_a'), 'Pomada', 'un', 1500, 3500);
insert into public.stock_movements (salon_id, inventory_item_id, type, quantity) values
  ((select v from ids where k='salon_a'), (select v from ids where k='shampoo'), 'in', 5),
  ((select v from ids where k='salon_a'), (select v from ids where k='pomada'), 'in', 3);
insert into public.service_consumables (salon_id, service_id, inventory_item_id, quantity) values
  ((select v from ids where k='salon_a'), (select v from ids where k='corte'), (select v from ids where k='shampoo'), 10);

-- Atendimento aguardando pagamento com os itens dados: [['service', <serviço>, qtd] | ['product', <item>, qtd]]
create function t.awaiting(p_key text, p_items text[][]) returns uuid language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_total integer := 0;
  v_i integer;
begin
  insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, arrived_at, duration_minutes, total_cents)
  values (v_id, (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo'),
          'walk_in', 'awaiting_payment', now() - interval '1 hour', now(), now() - interval '1 hour', 60, 0);
  for v_i in 1 .. array_length(p_items, 1) loop
    if p_items[v_i][1] = 'service' then
      insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, professional_id, quantity, unit_price_cents, duration_minutes)
      values ((select v from ids where k='salon_a'), v_id, 'service', (select v from ids where k=p_items[v_i][2]),
              (select v from ids where k='paulo'), p_items[v_i][3]::int, 1000, 30);
    else
      insert into public.appointment_items (salon_id, appointment_id, item_type, inventory_item_id, professional_id, quantity, unit_price_cents, duration_minutes)
      values ((select v from ids where k='salon_a'), v_id, 'product', (select v from ids where k=p_items[v_i][2]),
              (select v from ids where k='paulo'), p_items[v_i][3]::int, 1000, 0);
    end if;
    v_total := v_total + 1000 * p_items[v_i][3]::int;
  end loop;
  update public.appointments set total_cents = v_total where id = v_id;
  insert into ids values (p_key, v_id);
  return v_id;
end $$;
create function t.receive(p_key text) returns text language sql as $$
  select status from public.receive_payment((select v from ids where k=p_key),
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', (select total_cents from public.appointments where id = (select v from ids where k=p_key)))));
$$;
create function t.qty(p_item text) returns numeric language sql as $$
  select quantity from public.inventory_items where id = (select v from ids where k=p_item);
$$;
create function t.moves(p_key text) returns bigint language sql as $$
  select count(*) from public.stock_movements where appointment_id = (select v from ids where k=p_key);
$$;
grant execute on all functions in schema t to authenticated;

select t.awaiting('a1', array[['service', 'corte', '1'], ['product', 'pomada', '2']]);
select t.awaiting('a2', array[['service', 'corte', '1'], ['service', 'corte', '1']]);
select t.awaiting('a3', array[['service', 'barba', '1']]);
select t.awaiting('a4', array[['product', 'pomada', '1']]);

select t.login((select v from ids where k='ana'));
select throws_ok($$select t.receive('a1')$$, 'Abra o caixa antes de receber.', 'sem caixa aberto não recebe');
select is(t.moves('a1'), 0::bigint, 'nada baixa quando o recebimento falha');

select public.open_cash_session((select v from ids where k='salon_a'), 0);
select is(t.receive('a1'), 'paid', 'recebe mesmo deixando o estoque negativo');
select results_eq($$select t.qty('shampoo'), t.qty('pomada')$$, $$values (-5.000::numeric, 1.000::numeric)$$,
  'baixa o consumo do serviço e o produto vendido');
select results_eq(format($$select type, quantity, unit_cost_cents, appointment_item_id is not null from public.stock_movements
  where appointment_id = %L order by type$$, (select v from ids where k='a1')),
  $$values ('consumption'::text, -10.000::numeric(12,3), 3, true), ('out'::text, -2.000::numeric(12,3), 1500, true)$$,
  'movimentos ligados ao item com o custo do momento');

select is(t.receive('a2'), 'paid', 'recebe dois cortes');
select is(t.qty('shampoo'), -25.000::numeric, 'dois cortes consomem 20 ml');

select is(t.receive('a3'), 'paid', 'recebe serviço sem consumível');
select is(t.moves('a3'), 0::bigint, 'serviço sem consumível não movimenta');

-- Estorno devolve uma vez só
select public.refund_appointment((select v from ids where k='a1'), 'Cliente desistiu');
select results_eq($$select t.qty('shampoo'), t.qty('pomada')$$, $$values (-15.000::numeric, 3.000::numeric)$$,
  'estorno devolve consumo e produto');
select is((select count(*)::int from public.stock_movements where appointment_id = (select v from ids where k='a1')
  and type = 'in' and reverses_id is not null and reason = 'Cliente desistiu'), 2, 'devoluções ligadas ao movimento original');
select throws_ok($$select public.refund_appointment((select v from ids where k='a1'), 'De novo')$$,
  'Atendimento já estornado.', 'não estorna duas vezes');

-- Venda no balcão também baixa
select is((select (t.receive('a4') = 'paid') and t.qty('pomada') = 2), true, 'venda recebida baixa o produto');

select * from finish();
rollback;
