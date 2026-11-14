begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create schema t;
create function t.create_user(p_email text, p_confirmed boolean default true) returns uuid language sql as $$
  insert into auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
  values (gen_random_uuid(), p_email, '{}'::jsonb, 'authenticated', 'authenticated',
          case when p_confirmed then now() end)
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
  ('bia', t.create_user('bia@b.com')),
  ('carlos', t.create_user('Carlos@Exemplo.com')),
  ('fake', t.create_user('dora@exemplo.com', false));

select t.login((select v from ids where k='ana'));
insert into ids select 'salon_a', id from public.create_salon('Salão A');
select t.login((select v from ids where k='bia'));
insert into ids select 'salon_b', id from public.create_salon('Salão B');

select t.logout();
insert into public.salon_members (salon_id, user_id, role)
values ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception');

-- admin convida
select t.login((select v from ids where k='ana'));
select lives_ok(
  format($$ insert into public.salon_invites (salon_id, email, role) values (%L, 'carlos@exemplo.com', 'reception') $$,
         (select v from ids where k='salon_a')),
  'admin cria convite');
insert into ids select 'inv1', id from public.salon_invites where email = 'carlos@exemplo.com';
select is((select invited_by from public.salon_invites where id = (select v from ids where k='inv1')),
          (select v from ids where k='ana'), 'invited_by preenchido com quem convidou');
select throws_ok(
  format($$ insert into public.salon_invites (salon_id, email, role) values (%L, 'CARLOS@exemplo.com', 'professional') $$,
         (select v from ids where k='salon_a')),
  '23505', null, 'não duplica convite pendente para o mesmo e-mail');

-- recepção não convida
select t.login((select v from ids where k='rec'));
select throws_ok(
  format($$ insert into public.salon_invites (salon_id, email, role) values (%L, 'x@x.com', 'admin') $$,
         (select v from ids where k='salon_a')),
  '42501', null, 'recepção não cria convite');

-- outro salão não vê convites
select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.salon_invites where salon_id = (select v from ids where k='salon_a')), 0,
          'outro salão não vê convites');
select throws_ok(format($$ select public.accept_invite(%L) $$, (select v from ids where k='inv1')),
                 'P0001', 'Convite não encontrado.', 'e-mail diferente não aceita');

-- e-mail não confirmado não aceita
select t.logout();
insert into public.salon_invites (salon_id, email, role)
values ((select v from ids where k='salon_a'), 'dora@exemplo.com', 'reception');
select t.login((select v from ids where k='fake'));
select throws_ok(
  format($$ select public.accept_invite(%L) $$, (select id from public.salon_invites where email = 'dora@exemplo.com')),
  'P0001', 'Confirme seu e-mail antes de aceitar o convite.', 'e-mail não confirmado não aceita');

-- convidado vê e aceita
select t.login((select v from ids where k='carlos'));
select is((select salon_name from public.my_pending_invites()), 'Salão A', 'convidado vê convite com nome do salão');
select is((select count(*)::int from public.salon_invites), 0, 'convidado não lê a tabela diretamente');
select is((select role::text from public.accept_invite((select v from ids where k='inv1'))), 'reception', 'aceite cria vínculo');
select t.logout();
select is((select status from public.salon_invites where id = (select v from ids where k='inv1')), 'accepted', 'convite marcado como aceito');

-- reativação com novo papel
update public.salon_members set active = false
 where salon_id = (select v from ids where k='salon_a') and user_id = (select v from ids where k='carlos');
insert into public.salon_invites (salon_id, email, role, invited_by)
values ((select v from ids where k='salon_a'), 'carlos@exemplo.com', 'professional', (select v from ids where k='ana'));
select t.login((select v from ids where k='carlos'));
select is(
  (select row(role::text, active)::text from public.accept_invite(
     (select id from public.my_pending_invites() limit 1))),
  '(professional,t)', 'novo convite reativa com o novo papel');

-- recusar
select t.logout();
insert into public.salon_invites (salon_id, email, role)
values ((select v from ids where k='salon_b'), 'carlos@exemplo.com', 'reception');
select t.login((select v from ids where k='carlos'));
select lives_ok(format($$ select public.decline_invite(%L) $$, (select id from public.my_pending_invites() limit 1)),
                'convidado recusa');
select is((select count(*)::int from public.my_pending_invites()), 0, 'recusado sai da lista');

-- convite vencido não aparece nem pode ser aceito
select t.logout();
insert into public.salon_invites (salon_id, email, role, expires_at)
values ((select v from ids where k='salon_b'), 'carlos@exemplo.com', 'admin', now() - interval '1 minute');
insert into ids select 'expired', id from public.salon_invites where expires_at < now();
select t.login((select v from ids where k='carlos'));
select is((select count(*)::int from public.my_pending_invites()), 0, 'convite vencido não aparece');
select throws_ok(
  format($$ select public.accept_invite(%L) $$, (select v from ids where k='expired')),
  'P0001', 'Convite não encontrado.', 'convite vencido não pode ser aceito');

-- desativar um membro cancela convites pendentes dele no salão
select t.logout();
insert into public.salon_invites (salon_id, email, role)
values ((select v from ids where k='salon_a'), 'carlos@exemplo.com', 'admin');
insert into ids select 'reinv', id from public.salon_invites
 where salon_id = (select v from ids where k='salon_a') and status = 'pending' and email = 'carlos@exemplo.com';
update public.salon_members set active = false
 where salon_id = (select v from ids where k='salon_a') and user_id = (select v from ids where k='carlos');
select is((select status from public.salon_invites where id = (select v from ids where k='reinv')), 'revoked',
          'convite pendente revogado ao desativar');
select t.login((select v from ids where k='carlos'));
select throws_ok(format($$ select public.accept_invite(%L) $$, (select v from ids where k='reinv')),
                 'P0001', 'Convite não encontrado.', 'desativado não se reativa com convite antigo');

select * from finish();
rollback;
