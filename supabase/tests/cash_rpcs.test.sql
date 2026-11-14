begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
  ((select v from ids where k='salon_a'), (select v from ids where k='pro'), 'professional');

create function t.open(p_cents int) returns uuid language sql as $$
  select id from public.open_cash_session((select v from ids where k='salon_a'), p_cents);
$$;

select t.login((select v from ids where k='rec'));
insert into ids values ('cs', t.open(10000));
select is((select opening_cents from public.cash_sessions where id = (select v from ids where k='cs')), 10000, 'recepção abre o caixa');
select throws_ok('select t.open(0)', 'Já existe um caixa aberto.', 'não abre dois caixas');

select t.login((select v from ids where k='pro'));
select throws_ok('select t.open(0)', 'Sem permissão.', 'profissional não abre caixa');
select t.login((select v from ids where k='bia'));
select throws_ok('select t.open(0)', 'Sem permissão.', 'outro salão não abre caixa aqui');

select t.logout();
insert into public.transactions (salon_id, type, category, amount_cents, method, status, paid_at, cash_session_id)
select (select v from ids where k='salon_a'), type, 'atendimento', amount, method, status, case when status = 'paid' then now() end,
  (select v from ids where k='cs')
from (values ('income', 4500, 'cash', 'paid'), ('income', 7000, 'debit', 'paid'), ('income', 3500, 'pix', 'pending'),
             ('expense', 1000, 'cash', 'paid'), ('income', 2000, 'credit', 'reversed')) v (type, amount, method, status);

select t.login((select v from ids where k='bia'));
select throws_ok(format($$select public.close_cash_session(%L, '{"cash": 0}')$$, (select v from ids where k='cs')),
  'Sem permissão.', 'outro salão não fecha o caixa');

select t.login((select v from ids where k='rec'));
select public.close_cash_session((select v from ids where k='cs'), '{"cash": 13000, "debit": 7000}');
select is((select expected->>'cash' from public.cash_sessions where id = (select v from ids where k='cs')), '13500', 'esperado em dinheiro');
select is((select expected->>'pix_pending' from public.cash_sessions where id = (select v from ids where k='cs')), '3500', 'Pix pendente à parte');
select is((select difference_cents from public.cash_sessions where id = (select v from ids where k='cs')), -500, 'diferença do fechamento');
select is((select counted->>'credit' from public.cash_sessions where id = (select v from ids where k='cs')), '0', 'forma não contada vira 0');
select isnt((select closed_at from public.cash_sessions where id = (select v from ids where k='cs')), null, 'caixa fechado');
select throws_ok(format($$select public.close_cash_session(%L, '{}')$$, (select v from ids where k='cs')),
  'Caixa já fechado.', 'não fecha duas vezes');
select lives_ok('select t.open(5000)', 'depois de fechar, abre de novo');

select * from finish();
rollback;
