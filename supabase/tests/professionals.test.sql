begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
insert into public.services (salon_id, name, duration_minutes, price_cents) values
  ((select v from ids where k='salon_a'), 'Corte', 30, 4500),
  ((select v from ids where k='salon_a'), 'Barba', 30, 3500),
  ((select v from ids where k='salon_b'), 'Corte B', 30, 4000);
insert into ids select 'corte', id from public.services where name = 'Corte' and salon_id = (select v from ids where k='salon_a');
insert into ids select 'barba', id from public.services where name = 'Barba' and salon_id = (select v from ids where k='salon_a');
insert into ids select 'corte_b', id from public.services where name = 'Corte B' and salon_id = (select v from ids where k='salon_b');

-- admin cria profissional com comissão padrão
select t.login((select v from ids where k='ana'));
insert into ids select 'paulo', id from public.save_professional(
  (select v from ids where k='salon_a'), 'Paulo', '#1B3B4B', 40);
insert into ids select 'marcos', id from public.save_professional(
  (select v from ids where k='salon_a'), 'Marcos', '#F59E0B', 50);
select is((select percent from public.commission_rates where professional_id = (select v from ids where k='paulo') and service_id is null),
          40.00::numeric, 'save_professional grava a comissão padrão');

select lives_ok(
  format($$ select public.save_professional(%L, 'Paulo Silva', '#1B3B4B', 45, p_id => %L) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='paulo')),
  'admin edita profissional');
select is((select percent from public.commission_rates where professional_id = (select v from ids where k='paulo') and service_id is null),
          45.00::numeric, 'edição atualiza a comissão padrão sem duplicar');

select throws_ok(
  format($$ update public.professionals set user_id = %L where id = %L $$,
         (select v from ids where k='pro'), (select v from ids where k='paulo')),
  '42501', null, 'admin não altera user_id direto');

select throws_ok(
  format($$ select public.link_professional_user(%L, %L) $$,
         (select v from ids where k='paulo'), (select v from ids where k='bia')),
  'P0001', 'Pessoa não faz parte da equipe.', 'não vincula usuário de outro salão');
select lives_ok(
  format($$ select public.link_professional_user(%L, %L) $$,
         (select v from ids where k='paulo'), (select v from ids where k='pro')),
  'vincula membro ativo');

insert into public.commission_rates (salon_id, professional_id, service_id, percent) values
  ((select v from ids where k='salon_a'), (select v from ids where k='paulo'), (select v from ids where k='barba'), 50),
  ((select v from ids where k='salon_a'), (select v from ids where k='marcos'), (select v from ids where k='barba'), 55);
select is(public.commission_percent_for((select v from ids where k='paulo'), (select v from ids where k='barba')),
          50.00::numeric, 'sobrescrita por serviço vale');
select is(public.commission_percent_for((select v from ids where k='paulo'), (select v from ids where k='corte')),
          45.00::numeric, 'sem sobrescrita usa a padrão');

select throws_ok(
  format($$ insert into public.commission_rates (salon_id, professional_id, service_id, percent) values (%L, %L, %L, 30) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='paulo'), (select v from ids where k='corte_b')),
  '23503', null, 'serviço de outro salão viola FK');
select throws_ok(
  format($$ insert into public.commission_rates (salon_id, professional_id, service_id, percent) values (%L, %L, %L, 101) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='paulo'), (select v from ids where k='corte')),
  '23514', null, 'percentual acima de 100');

-- recepção
select t.login((select v from ids where k='rec'));
select throws_ok(
  format($$ select public.save_professional(%L, 'Intruso', '#1B3B4B', 10) $$, (select v from ids where k='salon_a')),
  '42501', null, 'recepção não cria profissional');
select throws_ok(
  format($$ select public.link_professional_user(%L, %L) $$,
         (select v from ids where k='marcos'), (select v from ids where k='rec')),
  'P0001', null, 'recepção não vincula');
select is((select count(*)::int from public.commission_rates), 0, 'recepção não lê comissões');
select is((select count(*)::int from public.professionals), 2, 'recepção vê os profissionais (agenda)');

-- profissional vinculado vê só as próprias comissões
select t.login((select v from ids where k='pro'));
select is((select count(*)::int from public.commission_rates where professional_id <> (select v from ids where k='paulo')), 0,
          'profissional não lê comissões de outros');
select is((select count(*)::int from public.commission_rates), 2, 'profissional lê as próprias comissões');

-- outro salão
select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.professionals), 0, 'outro salão não vê profissionais');

select * from finish();
rollback;
