begin;
set local search_path to public, extensions;
select plan(13);

-- helpers (descartados com a transação) -------------------------------------
create function pg_temp.make_user(p_id uuid, p_email text, p_name text default 'Teste')
returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_email, jsonb_build_object('full_name', p_name));
$$;
create function pg_temp.claims(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true),
    set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
$$;

select pg_temp.make_user('00000000-0000-0000-0000-00000000000a', 'a@test.dev', 'Ana');
select pg_temp.make_user('00000000-0000-0000-0000-00000000000b', 'b@test.dev', 'Bruno');
select pg_temp.make_user('00000000-0000-0000-0000-00000000000c', 'c@test.dev', 'Carla');
select pg_temp.make_user('00000000-0000-0000-0000-00000000000d', 'd@test.dev', 'Davi');

-- perfil criado por trigger ---------------------------------------------------
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Ana', 'trigger cria o perfil com o nome do metadata');

-- create_salon: slug e vínculo ------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select is((select slug from public.create_salon('Barbearia São João')),
  'barbearia-sao-joao', 'slug sem acento e com hífens');
reset role;

select pg_temp.claims('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select is((select slug from public.create_salon('Barbearia São João')),
  'barbearia-sao-joao-2', 'nome duplicado ganha sufixo -2');
reset role;

select is((select role::text || '/' || active::text from public.salon_members
  where user_id = '00000000-0000-0000-0000-00000000000a'), 'admin/true',
  'criador vira admin ativo');
select is((select (card_reconciliation or pix_webhook) from public.feature_flags f
  join public.salons s on s.id = f.salon_id where s.slug = 'barbearia-sao-joao'),
  false, 'feature_flags nasce desligado');

-- isolamento entre salões -----------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select is((select count(*)::int from public.salons where slug = 'barbearia-sao-joao'), 0,
  'usuário B não enxerga o salão de A');
select is((select count(*)::int from public.salon_members
  where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'usuário B não enxerga membros do salão de A');
reset role;

-- recepção: sem escrita administrativa ---------------------------------------
insert into public.salon_members (salon_id, user_id, role)
select id, '00000000-0000-0000-0000-00000000000c', 'reception'
from public.salons where slug = 'barbearia-sao-joao';

select pg_temp.claims('00000000-0000-0000-0000-00000000000c');
set local role authenticated;
with u as (update public.salons set name = 'Invadido' where slug = 'barbearia-sao-joao' returning 1)
select is((select count(*)::int from u), 0, 'recepção não atualiza o salão');
select throws_ok(
  $$insert into public.salon_members (salon_id, user_id, role)
    select id, '00000000-0000-0000-0000-00000000000d', 'admin'
    from public.salons where slug = 'barbearia-sao-joao'$$,
  '42501', null, 'recepção não insere membros');
reset role;

-- membro desativado perde acesso na hora --------------------------------------
update public.salon_members set active = false
where user_id = '00000000-0000-0000-0000-00000000000c';

select pg_temp.claims('00000000-0000-0000-0000-00000000000c');
set local role authenticated;
select is((select count(*)::int from public.salons), 0, 'desativado: select em salons retorna 0');
reset role;

-- último admin ----------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok(
  $$update public.salon_members set role = 'reception'
    where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'P0001', 'O salão precisa ter pelo menos um administrador ativo',
  'último admin não pode se rebaixar');
reset role;

-- sem autenticação ------------------------------------------------------------
select pg_temp.claims(null);
select throws_ok($$select public.create_salon('Sem Login')$$, '28000', 'Não autenticado',
  'create_salon exige usuário autenticado');

-- guarda-chuva: toda tabela de public tem RLS --------------------------------
select is((select count(*)::int from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0,
  'toda tabela de public tem RLS habilitado');

select * from finish();
rollback;
