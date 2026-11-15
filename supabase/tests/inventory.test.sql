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

-- admin cadastra o item pela API
select t.login((select v from ids where k='ana'));
select lives_ok($$
  insert into public.inventory_items (salon_id, name, unit, min_quantity)
  values ((select v from ids where k='salon_a'), 'Shampoo', 'ml', 500)
$$, 'admin cria item');
insert into ids select 'sh', id from public.inventory_items where name = 'Shampoo';
select throws_ok($$ update public.inventory_items set quantity = 99 $$, '42501', null, 'saldo não se altera direto');
select throws_ok($$
  insert into public.inventory_items (salon_id, name, unit) values ((select v from ids where k='salon_a'), 'SHAMPOO', 'ml')
$$, '23505', null, 'nome duplicado ignorando maiúsculas');

-- leitura e escrita por perfil
select t.login((select v from ids where k='rec'));
select is((select count(*)::int from public.inventory_items), 1, 'recepção lê o estoque');
select throws_ok($$
  insert into public.inventory_items (salon_id, name, unit) values ((select v from ids where k='salon_a'), 'Gel', 'un')
$$, '42501', null, 'recepção não cria item');
select throws_ok($$ select public.record_stock_movement((select v from ids where k='sh'), 'in', 10) $$,
  'P0001', 'Sem permissão.', 'recepção não movimenta');
select t.login((select v from ids where k='pro'));
select is((select count(*)::int from public.inventory_items), 1, 'profissional lê o estoque');
select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.inventory_items), 0, 'outro salão não lê o item');
select throws_ok($$ select public.record_stock_movement((select v from ids where k='sh'), 'in', 10) $$,
  'P0001', 'Sem permissão.', 'admin de outro salão não movimenta');

-- movimentos
select t.login((select v from ids where k='ana'));
select public.record_stock_movement((select v from ids where k='sh'), 'in', 1000, 5);
select results_eq($$ select quantity, unit_cost_cents from public.inventory_items $$,
  $$ values (1000.000::numeric(12,3), 5) $$, 'entrada soma e atualiza o custo');
select is((public.record_stock_movement((select v from ids where k='sh'), 'out', 300)).quantity, -300.000::numeric(12,3),
  'saída grava quantidade negativa');
select is((public.record_stock_movement((select v from ids where k='sh'), 'adjust', 650)).quantity, -50.000::numeric(12,3),
  'ajuste grava a diferença da contagem');
select is((select quantity from public.inventory_items), 650.000::numeric(12,3), 'saldo igual à contagem');
select throws_ok($$ select public.record_stock_movement((select v from ids where k='sh'), 'adjust', 650) $$,
  'P0001', 'Quantidade inválida.', 'ajuste sem diferença recusado');
select public.record_stock_movement((select v from ids where k='sh'), 'out', 2000);
select is((select quantity from public.inventory_items), -1350.000::numeric(12,3), 'saída pode deixar negativo');
select throws_ok($$ select public.record_stock_movement((select v from ids where k='sh'), 'consumption', 1) $$,
  'P0001', 'Quantidade inválida.', 'consumo não é lançado à mão');
select throws_ok($$ select public.record_stock_movement((select v from ids where k='sh'), 'in', 0) $$,
  'P0001', 'Quantidade inválida.', 'entrada zero recusada');
select throws_ok($$ select public.record_stock_movement(gen_random_uuid(), 'in', 1) $$,
  'P0001', 'Item de estoque não encontrado.', 'item inexistente');
select throws_ok($$
  insert into public.stock_movements (salon_id, inventory_item_id, type, quantity)
  values ((select v from ids where k='salon_a'), (select v from ids where k='sh'), 'in', 1)
$$, '42501', null, 'movimento não entra direto pela API');

select * from finish();
rollback;
