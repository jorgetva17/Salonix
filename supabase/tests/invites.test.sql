begin;
set local search_path to public, extensions;
select plan(10);

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

select pg_temp.make_user('00000000-0000-0000-0000-00000000000a', 'admin@test.dev');
select pg_temp.make_user('00000000-0000-0000-0000-00000000000b', 'recepcao@test.dev');
select pg_temp.make_user('00000000-0000-0000-0000-00000000000c', 'novo@test.dev');
select pg_temp.make_user('00000000-0000-0000-0000-00000000000d', 'outro@test.dev');
select pg_temp.make_user('00000000-0000-0000-0000-00000000000e', 'admin2@test.dev');

-- salão A (admin a, recepção b) e salão B (admin e)
select pg_temp.claims('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.create_salon('Salão A');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-00000000000e');
set local role authenticated;
select public.create_salon('Salão B');
reset role;
insert into public.salon_members (salon_id, user_id, role)
select id, '00000000-0000-0000-0000-00000000000b', 'reception' from public.salons where name = 'Salão A';

-- admin cria convite ------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select lives_ok(
  $$insert into public.salon_invites (salon_id, email, role, invited_by)
    select id, 'Novo@Test.dev', 'professional', '00000000-0000-0000-0000-00000000000a'
    from public.salons where name = 'Salão A'$$,
  'admin cria convite');
select throws_ok(
  $$insert into public.salon_invites (salon_id, email, role)
    select id, 'novo@test.dev', 'reception' from public.salons where name = 'Salão A'$$,
  '23505', null, 'não permite dois convites pendentes para o mesmo e-mail');
reset role;

-- recepção não cria -------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select throws_ok(
  $$insert into public.salon_invites (salon_id, email, role)
    select id, 'x@test.dev', 'reception' from public.salons where name = 'Salão A'$$,
  '42501', null, 'recepção não cria convite');
reset role;

-- outro salão não vê -------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-00000000000e');
set local role authenticated;
select is((select count(*)::int from public.salon_invites), 0, 'admin de outro salão não vê convites');
reset role;

-- convidado: vê só o seu e aceita só com o e-mail certo -----------------------
select pg_temp.claims('00000000-0000-0000-0000-00000000000d');
set local role authenticated;
select is((select count(*)::int from public.my_pending_invites()), 0, 'e-mail diferente não vê o convite');
select throws_ok(
  $$select public.accept_invite((select id from public.salon_invites limit 1))$$,
  'P0001', 'Convite inválido ou expirado', 'aceitar com outro e-mail falha');
reset role;

select pg_temp.claims('00000000-0000-0000-0000-00000000000c');
set local role authenticated;
select is((select count(*)::int from public.my_pending_invites()), 1, 'e-mail certo (sem diferenciar caixa) vê o convite');
select is((select role::text from public.accept_invite((select id from public.my_pending_invites() limit 1))),
  'professional', 'aceitar cria o vínculo com o papel do convite');
reset role;

select is((select status from public.salon_invites where email = 'novo@test.dev'), 'accepted', 'convite marcado como aceito');

-- membro desativado é reativado com o novo papel ---------------------------------
update public.salon_members set active = false where user_id = '00000000-0000-0000-0000-00000000000c';
insert into public.salon_invites (salon_id, email, role)
select id, 'novo@test.dev', 'reception' from public.salons where name = 'Salão A';
select pg_temp.claims('00000000-0000-0000-0000-00000000000c');
set local role authenticated;
select public.accept_invite((select id from public.my_pending_invites() limit 1));
reset role;
select is((select role::text || '/' || active::text from public.salon_members
  where user_id = '00000000-0000-0000-0000-00000000000c'), 'reception/true',
  'convite reativa membro desativado com novo papel');

select * from finish();
rollback;
