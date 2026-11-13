begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- helpers locais (somem no rollback)
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
  ('bia', t.create_user('bia@b.com')),
  ('rec', t.create_user('rec@a.com'));

-- trigger de profile
select is((select full_name from public.profiles where id = (select v from ids where k='ana')), 'ana', 'profile criado com full_name do metadata');

-- create_salon exige login
select throws_ok($$ select public.create_salon('Sem Login') $$, null, null, 'create_salon sem auth.uid() falha');

select t.login((select v from ids where k='ana'));
insert into ids select 'salon_a', id from public.create_salon('Barbearia São João');
select is((select slug from public.salons where id = (select v from ids where k='salon_a')), 'barbearia-sao-joao', 'slug sem acento');
select is((select role::text from public.salon_members where salon_id = (select v from ids where k='salon_a') and user_id = (select v from ids where k='ana')), 'admin', 'criador vira admin');
select is((select card_reconciliation or pix_webhook from public.feature_flags where salon_id = (select v from ids where k='salon_a')), false, 'feature flags desligadas');

-- admin não adiciona membros diretamente (só via convite aceito)
select throws_ok(
  format($$ insert into public.salon_members (salon_id, user_id, role) values (%L, %L, 'reception') $$,
         (select v from ids where k='salon_a'), (select v from ids where k='rec')),
  '42501', null, 'admin não insere membro arbitrário');

-- setup: recepção entra no salão A (como faria accept_invite)
select t.logout();
insert into public.salon_members (salon_id, user_id, role)
values ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception');
select t.login((select v from ids where k='ana'));

select t.login((select v from ids where k='bia'));
insert into ids select 'salon_b', id from public.create_salon('Barbearia São João');
select is((select slug from public.salons where id = (select v from ids where k='salon_b')), 'barbearia-sao-joao-2', 'slug duplicado recebe sufixo');

-- isolamento
select is((select count(*)::int from public.salons where id = (select v from ids where k='salon_a')), 0, 'bia não vê salão A');
select is((select count(*)::int from public.salon_members where salon_id = (select v from ids where k='salon_a')), 0, 'bia não vê membros de A');
select is((select count(*)::int from public.profiles where id = (select v from ids where k='ana')), 0, 'bia não vê perfil de ana');

-- recepção
select t.login((select v from ids where k='rec'));
select is((select count(*)::int from public.salons where id = (select v from ids where k='salon_a')), 1, 'recepção vê seu salão');
update public.salons set name = 'Hack' where id = (select v from ids where k='salon_a');
select is((select name from public.salons where id = (select v from ids where k='salon_a')), 'Barbearia São João', 'recepção não altera salão');
select throws_ok(
  format($$ insert into public.salon_members (salon_id, user_id, role) values (%L, %L, 'admin') $$,
         (select v from ids where k='salon_a'), (select v from ids where k='bia')),
  '42501', null, 'recepção não adiciona membros');

-- último admin
select t.login((select v from ids where k='ana'));
select throws_ok(
  format($$ update public.salon_members set role = 'reception' where salon_id = %L and user_id = %L $$,
         (select v from ids where k='salon_a'), (select v from ids where k='ana')),
  'P0001', 'O salão precisa de pelo menos um administrador ativo.', 'último admin não se rebaixa');

-- vínculo não muda de salão nem de usuário
select throws_ok(
  format($$ update public.salon_members set user_id = %L where salon_id = %L and user_id = %L $$,
         (select v from ids where k='bia'), (select v from ids where k='salon_a'), (select v from ids where k='rec')),
  'P0001', 'Não é permitido alterar o salão ou o usuário de um vínculo.', 'user_id imutável');

-- membro desativado perde acesso
update public.salon_members set active = false
 where salon_id = (select v from ids where k='salon_a') and user_id = (select v from ids where k='rec');
select is((select count(*)::int from public.profiles where id = (select v from ids where k='rec')), 1, 'admin ainda vê perfil do desativado');
select t.login((select v from ids where k='rec'));
select is(public.is_salon_member((select v from ids where k='salon_a')), false, 'desativado não é membro');
select is((select count(*)::int from public.salons where id = (select v from ids where k='salon_a')), 0, 'desativado não vê salão');

-- um colega comum não vê o perfil de quem foi desativado
select t.logout();
insert into ids values ('pro', t.create_user('pro@a.com'));
insert into public.salon_members (salon_id, user_id, role)
values ((select v from ids where k='salon_a'), (select v from ids where k='pro'), 'professional');
select t.login((select v from ids where k='pro'));
select is((select count(*)::int from public.profiles where id = (select v from ids where k='rec')), 0, 'colega não vê perfil de desativado');
select is((select count(*)::int from public.profiles where id = (select v from ids where k='ana')), 1, 'colega vê perfil de membro ativo');

-- toda tabela de public tem RLS
select t.logout();
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'todas as tabelas de public têm RLS');

select * from finish();
rollback;
