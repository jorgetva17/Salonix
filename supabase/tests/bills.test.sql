begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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

-- Conta do salão A com os padrões do teste.
create function t.bill(p_category text, p_description text, p_amount integer, p_due date default current_date + 1, p_paid text default null)
returns uuid language sql as $$
  select id from public.create_bill((select v from ids where k='salon_a'), p_category, p_description, p_amount, p_due, p_paid);
$$;
grant execute on all functions in schema t to authenticated;

-- Lançar -------------------------------------------------------------------------
select t.login((select v from ids where k='ana'));
insert into ids select 'aluguel', t.bill('aluguel', 'Aluguel novembro', 150000);
select results_eq(format('select type, status, method is null, due_date from public.transactions where id = %L', (select v from ids where k='aluguel')),
  $$values ('expense'::text, 'pending'::text, true, current_date + 1)$$, 'conta nasce pendente, sem forma');
select throws_ok($$select t.bill('comissao', 'Comissão', 1000)$$, 'Categoria inválida.', 'categoria de sistema não é lançada');
select throws_ok($$select t.bill('aluguel', ' ', 1000)$$, 'Informe a descrição.', 'descrição vazia');
select throws_ok($$select t.bill('aluguel', 'Aluguel', 0)$$, 'Valor inválido.', 'valor zero');
select throws_ok($$select t.bill('aluguel', 'Aluguel', 1000, null)$$, 'Informe o vencimento.', 'sem vencimento');
select throws_ok($$select public.pay_bill((select v from ids where k='aluguel'), 'cheque')$$, 'Forma de pagamento inválida.', 'forma desconhecida');

-- Pagar em dinheiro sai do caixa aberto -------------------------------------------
insert into ids select 'luz', t.bill('outros', 'Luz', 8000);
select throws_ok($$select public.pay_bill((select v from ids where k='luz'), 'cash')$$,
  'Abra o caixa antes de pagar em dinheiro.', 'dinheiro exige caixa aberto');
insert into ids select 'cs', id from public.open_cash_session((select v from ids where k='salon_a'), 10000);
select is((public.pay_bill((select v from ids where k='luz'), 'cash')).cash_session_id, (select v from ids where k='cs'),
  'conta paga em dinheiro entra no caixa aberto');
select is(public.cash_session_summary((select v from ids where k='salon_a'))->>'cash', '2000', 'esperado em dinheiro desconta a conta');

-- Pagar em Pix fica fora do caixa --------------------------------------------------
select results_eq(format($$select (public.pay_bill(%L, 'pix')).cash_session_id is null$$, (select v from ids where k='aluguel')),
  $$values (true)$$, 'conta paga em Pix fica fora do caixa');
select is(public.cash_session_summary((select v from ids where k='salon_a'))->>'pix', '0', 'esperado do Pix não muda');
select results_eq(format('select status, paid_at is not null from public.transactions where id = %L', (select v from ids where k='aluguel')),
  $$values ('paid'::text, true)$$, 'conta paga com data');
select throws_ok($$select public.pay_bill((select v from ids where k='aluguel'), 'pix')$$,
  'Conta não pode mudar deste status.', 'não paga duas vezes');
select throws_ok($$select public.cancel_bill((select v from ids where k='aluguel'))$$,
  'Conta não pode mudar deste status.', 'conta paga não é cancelada');

-- Cancelar e lançar já paga ----------------------------------------------------------
insert into ids select 'agua', t.bill('outros', 'Água', 5000);
select is((public.cancel_bill((select v from ids where k='agua'))).status, 'reversed', 'conta pendente é cancelada');
insert into ids select 'forn', t.bill('fornecedor', 'Distribuidora', 64000, current_date, 'debit');
select results_eq(format('select status, method, paid_at is not null, cash_session_id is null from public.transactions where id = %L', (select v from ids where k='forn')),
  $$values ('paid'::text, 'debit'::text, true, true)$$, 'conta lançada já paga');

select t.logout();
with x as (
  insert into public.transactions (salon_id, type, category, amount_cents, method, status, paid_at, cash_session_id)
  values ((select v from ids where k='salon_a'), 'income', 'atendimento', 4500, 'cash', 'paid', now(), (select v from ids where k='cs'))
  returning id)
insert into ids select 'receita', id from x;
select t.login((select v from ids where k='ana'));
select throws_ok($$select public.pay_bill((select v from ids where k='receita'), 'cash')$$,
  'Conta não pode mudar deste status.', 'entrada de atendimento não é conta');
select throws_ok($$select public.pay_bill(gen_random_uuid(), 'cash')$$, 'Conta não encontrada.', 'conta inexistente');
select throws_ok($$insert into public.transactions (salon_id, type, category, amount_cents, status, due_date)
  values ((select v from ids where k='salon_a'), 'expense', 'aluguel', 100, 'pending', current_date)$$,
  '42501', null, 'admin não grava transação direto');

-- Permissões ------------------------------------------------------------------------
insert into ids select 'pendente', t.bill('salarios', 'Salário', 200000);
select t.login((select v from ids where k='rec'));
select throws_ok($$select t.bill('aluguel', 'Aluguel', 1000)$$, 'Sem permissão.', 'recepção não lança conta');
select throws_ok($$select public.pay_bill((select v from ids where k='pendente'), 'cash')$$, 'Sem permissão.', 'recepção não paga conta');
select throws_ok($$select public.cancel_bill((select v from ids where k='pendente'))$$, 'Sem permissão.', 'recepção não cancela conta');
select is((select array_agg(description order by description) from public.transactions where type = 'expense'),
  array['Luz'], 'recepção lê só a conta que saiu da gaveta');
select is((select count(*)::int from public.transactions where category = 'atendimento'), 1, 'recepção lê as entradas');

select t.login((select v from ids where k='pro'));
select is((select count(*)::int from public.transactions), 0, 'profissional não lê transações');

select t.login((select v from ids where k='bia'));
select throws_ok($$select public.pay_bill((select v from ids where k='pendente'), 'pix')$$, 'Sem permissão.', 'outro salão não paga');
select is((select count(*)::int from public.transactions), 0, 'outro salão não lê nada');

select * from finish();
rollback;
