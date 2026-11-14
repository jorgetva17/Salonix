begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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
  ('pro1', t.create_user('pro1@a.com')),
  ('pro2', t.create_user('pro2@a.com')),
  ('solto', t.create_user('solto@a.com')),
  ('bia', t.create_user('bia@b.com'));

select t.login((select v from ids where k='ana'));
insert into ids select 'salon_a', id from public.create_salon('Salão A');
select t.login((select v from ids where k='bia'));
insert into ids select 'salon_b', id from public.create_salon('Salão B');

select t.logout();
-- "solto": perfil profissional no salão, ainda sem cadastro de profissional vinculado
insert into public.salon_members (salon_id, user_id, role) values
  ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro1'), 'professional'),
  ((select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'professional'),
  ((select v from ids where k='salon_a'), (select v from ids where k='solto'), 'professional');
insert into ids values ('p1', gen_random_uuid()), ('p2', gen_random_uuid()), ('cli', gen_random_uuid()),
  ('s1', gen_random_uuid()), ('ip2', gen_random_uuid()), ('w_hoje', gen_random_uuid()), ('w_velho', gen_random_uuid());
insert into public.professionals (id, salon_id, user_id, name, color) values
  ((select v from ids where k='p1'), (select v from ids where k='salon_a'), (select v from ids where k='pro1'), 'P1', '#1B3B4B'),
  ((select v from ids where k='p2'), (select v from ids where k='salon_a'), (select v from ids where k='pro2'), 'P2', '#B45309');
insert into public.customers (id, salon_id, name) values ((select v from ids where k='cli'), (select v from ids where k='salon_a'), 'Carlos');
insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, arrived_at, duration_minutes, total_cents) values
  ((select v from ids where k='s1'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='p1'),
   'scheduled', 'scheduled', now() + interval '1 day', now() + interval '1 day 30 minutes', null, 30, 4500),
  ((select v from ids where k='ip2'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='p2'),
   'walk_in', 'in_progress', now(), now() + interval '30 minutes', now() - interval '5 minutes', 30, 4500),
  ((select v from ids where k='w_velho'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), null,
   'walk_in', 'waiting', null, null, now() - interval '2 days', 30, 4500),
  ((select v from ids where k='w_hoje'), (select v from ids where k='salon_a'), (select v from ids where k='cli'), null,
   'walk_in', 'waiting', null, null, now(), 30, 4500);

-- quem não é do salão não mexe em nada (o perfil de profissional sem vínculo gerava NULL na checagem)
select t.login((select v from ids where k='bia'));
select throws_ok(format($$ select public.start_appointment(%L) $$, (select v from ids where k='s1')),
  'P0001', 'Sem permissão.', 'admin de outro salão não inicia atendimento');
select throws_ok(format($$ select public.complete_appointment(%L) $$, (select v from ids where k='ip2')),
  'P0001', 'Sem permissão.', 'admin de outro salão não conclui atendimento');
select throws_ok(format($$ select public.call_next_walk_in(%L, %L) $$, (select v from ids where k='salon_a'), (select v from ids where k='p1')),
  'P0001', 'Sem permissão.', 'admin de outro salão não chama da fila');
select throws_ok(format($$ select public.call_next_walk_in(%L, %L) $$, (select v from ids where k='salon_a'), gen_random_uuid()),
  'P0001', 'Sem permissão.', 'sem permissão antes de revelar se o profissional existe');

select t.login((select v from ids where k='solto'));
select throws_ok(format($$ select public.start_appointment(%L) $$, (select v from ids where k='s1')),
  'P0001', 'Sem permissão.', 'profissional sem vínculo não inicia atendimento de colega');
select throws_ok(format($$ select public.call_next_walk_in(%L, %L) $$, (select v from ids where k='salon_a'), (select v from ids where k='p1')),
  'P0001', 'Sem permissão.', 'profissional sem vínculo não chama da fila');

-- um atendimento em andamento por profissional, garantido pelo banco
select t.logout();
select throws_ok(
  format($$ insert into public.appointments (salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, arrived_at, duration_minutes, total_cents)
            values (%L, %L, %L, 'walk_in', 'in_progress', now(), now() + interval '30 minutes', now(), 30, 4500) $$,
         (select v from ids where k='salon_a'), (select v from ids where k='cli'), (select v from ids where k='p2')),
  '23505', null, 'dois atendimentos em andamento do mesmo profissional');

-- a fila é do dia: quem ficou de outro dia não é chamado
select t.login((select v from ids where k='rec'));
select is((select id from public.call_next_walk_in((select v from ids where k='salon_a'), (select v from ids where k='p1'))),
          (select v from ids where k='w_hoje'), 'chama quem chegou hoje, não quem ficou de outro dia');
select public.complete_appointment((select v from ids where k='w_hoje'));
select throws_ok(format($$ select public.call_next_walk_in(%L, %L) $$, (select v from ids where k='salon_a'), (select v from ids where k='p1')),
  'P0001', 'Fila vazia para este profissional.', 'walk-in de outro dia não volta para a fila');
select is((select status from public.cancel_appointment((select v from ids where k='w_velho'), 'Foi embora')), 'cancelled',
          'walk-in antigo pode ser removido');

select * from finish();
rollback;
