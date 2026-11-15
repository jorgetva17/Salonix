begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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
insert into ids values ('paulo', gen_random_uuid()), ('corte', gen_random_uuid()), ('cli', gen_random_uuid()),
  ('pomada', gen_random_uuid()), ('shampoo', gen_random_uuid()), ('gel_b', gen_random_uuid()),
  ('a1', gen_random_uuid()), ('a2', gen_random_uuid());
insert into public.professionals (id, salon_id, user_id, name, color) values
  ((select v from ids where k='paulo'), (select v from ids where k='salon_a'), (select v from ids where k='pro'), 'Paulo', '#1B3B4B');
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ((select v from ids where k='corte'), (select v from ids where k='salon_a'), 'Corte', 30, 4500);
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');
insert into public.commission_rates (salon_id, professional_id, service_id, percent) values
  ((select v from ids where k='salon_a'), (select v from ids where k='paulo'), null, 40);
insert into public.inventory_items (id, salon_id, name, unit, sale_price_cents) values
  ((select v from ids where k='pomada'), (select v from ids where k='salon_a'), 'Pomada', 'un', 3500),
  ((select v from ids where k='shampoo'), (select v from ids where k='salon_a'), 'Shampoo', 'ml', null),
  ((select v from ids where k='gel_b'), (select v from ids where k='salon_b'), 'Gel', 'un', 2000);

-- Corte do Paulo em curso.
create function t.in_progress(p_key text) returns void language sql as $$
  insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, arrived_at, duration_minutes, total_cents)
  values ((select v from ids where k=p_key), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='paulo'),
          'walk_in', 'in_progress', now() - interval '30 minutes', now() - interval '30 minutes', 30, 4500);
  insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, professional_id, unit_price_cents, duration_minutes, created_at)
  values ((select v from ids where k='salon_a'), (select v from ids where k=p_key), 'service', (select v from ids where k='corte'),
          (select v from ids where k='paulo'), 4500, 30, now() - interval '1 minute');
$$;
create function t.add(p_appt text, p_item text, p_qty int default 1) returns uuid language sql as $$
  select id from public.add_product_item((select v from ids where k=p_appt), (select v from ids where k=p_item), p_qty);
$$;
create function t.sale(p_items jsonb, p_customer uuid default null) returns uuid language sql as $$
  select id from public.create_counter_sale((select v from ids where k='salon_a'), p_customer, p_items);
$$;
create function t.lines(p_qty numeric) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('inventory_item_id', (select v from ids where k='pomada'), 'quantity', p_qty));
$$;
grant execute on all functions in schema t to authenticated;
select t.in_progress('a1');

-- Produto no atendimento ----------------------------------------------------------
select t.login((select v from ids where k='rec'));
insert into ids select 'p1', t.add('a1', 'pomada');
select is((select total_cents from public.appointments where id = (select v from ids where k='a1')), 8000, 'total soma o produto');
select results_eq(format('select item_type, unit_price_cents, quantity, inventory_item_id from public.appointment_items where id = %L', (select v from ids where k='p1')),
  format($$values ('product'::text, 3500, 1, %L::uuid)$$, (select v from ids where k='pomada')), 'item de produto com o preço de venda');
select throws_ok($$select t.add('a1', 'shampoo')$$, 'Produto sem preço de venda.', 'item sem preço não é vendido');
select throws_ok($$select t.add('a1', 'pomada', 0)$$, 'Quantidade inválida.', 'quantidade zero');
select throws_ok($$select t.add('a1', 'gel_b')$$, 'Item de estoque não encontrado.', 'item de outro salão');

select t.logout();
update public.appointments set status = 'awaiting_payment', ends_at = now() where id = (select v from ids where k='a1');
select t.in_progress('a2');
select t.login((select v from ids where k='pro'));
insert into ids select 'p2', t.add('a2', 'pomada');
select isnt((select v from ids where k='p2'), null, 'profissional vende produto no próprio atendimento em curso');
select lives_ok($$select public.remove_appointment_item((select v from ids where k='p2'))$$, 'remove o produto mantendo o serviço');
select throws_ok($$select public.remove_appointment_item(id) from public.appointment_items
  where appointment_id = (select v from ids where k='a2')$$,
  'Atendimento precisa de pelo menos um serviço.', 'o último serviço continua obrigatório');
select t.login((select v from ids where k='bia'));
select throws_ok($$select t.add('a2', 'pomada')$$, 'Sem permissão.', 'outro salão não vende no atendimento');

-- Desconto em serviço + produto ---------------------------------------------------
select t.login((select v from ids where k='rec'));
select public.open_cash_session((select v from ids where k='salon_a'), 0);
select is((public.receive_payment((select v from ids where k='a1'), '[{"method": "cash", "amount_cents": 7000}]', 1000)).status, 'paid',
  'recebe serviço + produto com desconto');
select t.logout();
select results_eq(format('select base_cents, amount_cents from public.commissions where appointment_id = %L', (select v from ids where k='a1')),
  $$values (3937, 1575)$$, 'desconto repartido com o produto; só o serviço gera comissão');

-- Venda no balcão -----------------------------------------------------------------
select t.login((select v from ids where k='rec'));
insert into ids select 's1', t.sale(t.lines(2));
select results_eq(format('select kind, status, total_cents, customer_id is null, professional_id is null from public.appointments where id = %L', (select v from ids where k='s1')),
  $$values ('sale'::text, 'awaiting_payment'::text, 7000, true, true)$$, 'venda sem cliente aguardando pagamento');
select throws_ok($$select t.sale('[]'::jsonb)$$, 'Venda precisa de pelo menos um produto.', 'venda sem linhas');
select throws_ok($$select t.sale(t.lines(1.5))$$, 'Quantidade inválida.', 'quantidade fracionada na venda');
select is((public.receive_payment((select v from ids where k='s1'), '[{"method": "pix", "amount_cents": 7000}]')).status, 'paid', 'recebe a venda');
select t.logout();
select is((select count(*)::int from public.commissions where appointment_id = (select v from ids where k='s1')), 0, 'venda não gera comissão');

select t.login((select v from ids where k='pro'));
select throws_ok($$select t.sale(t.lines(1))$$, 'Sem permissão.', 'profissional não cria venda no balcão');

select t.login((select v from ids where k='rec'));
insert into ids select 's2', t.sale(t.lines(1));
select throws_ok($$select public.remove_appointment_item(id) from public.appointment_items where appointment_id = (select v from ids where k='s2')$$,
  'Venda precisa de pelo menos um produto.', 'venda não fica sem produto');

select t.logout();
select throws_ok($$
  insert into public.appointments (salon_id, kind, status, starts_at, ends_at, professional_id, duration_minutes, total_cents)
  values ((select v from ids where k='salon_a'), 'scheduled', 'scheduled', now(), now() + interval '30 minutes', (select v from ids where k='paulo'), 30, 0)
$$, '23514', null, 'só a venda dispensa cliente');

select * from finish();
rollback;
