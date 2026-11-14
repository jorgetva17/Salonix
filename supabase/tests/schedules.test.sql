begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
  ('bia', t.create_user('bia@b.com'));

select t.login((select v from ids where k='ana'));
insert into ids select 'salon_a', id from public.create_salon('Salão A');
insert into ids select 'paulo', id from public.save_professional((select v from ids where k='salon_a'), 'Paulo', '#1B3B4B', 40);
select t.login((select v from ids where k='bia'));
insert into ids select 'salon_b', id from public.create_salon('Salão B');
select t.logout();
insert into public.salon_members (salon_id, user_id, role) values
  ((select v from ids where k='salon_a'), (select v from ids where k='rec'), 'reception');

-- jornada
select t.login((select v from ids where k='ana'));
select is(
  (select count(*)::int from public.set_professional_schedule((select v from ids where k='paulo'),
    '[{"weekday":2,"starts_at":"09:00","ends_at":"12:00"},{"weekday":2,"starts_at":"13:00","ends_at":"19:00"}]')),
  2, 'admin grava jornada com dois intervalos');

select throws_ok(
  format($$ select public.set_professional_schedule(%L, '[{"weekday":2,"starts_at":"09:00","ends_at":"12:00"},{"weekday":2,"starts_at":"11:00","ends_at":"14:00"}]') $$,
         (select v from ids where k='paulo')),
  'P0001', 'Horários se sobrepõem na jornada.', 'jornada sobreposta é recusada');
select is((select count(*)::int from public.professional_schedules where professional_id = (select v from ids where k='paulo')),
          2, 'jornada anterior continua intacta');

select lives_ok(
  format($$ select public.set_professional_schedule(%L, '[{"weekday":3,"starts_at":"09:00","ends_at":"12:00"},{"weekday":3,"starts_at":"12:00","ends_at":"18:00"}]') $$,
         (select v from ids where k='paulo')),
  'intervalos encostados são aceitos');

-- bloqueios no fuso do salão
insert into ids select 'almoco', id from public.create_schedule_block(
  (select v from ids where k='paulo'), '2026-11-20 12:00', '2026-11-20 13:00', 'break');
select is((select starts_at from public.schedule_blocks where id = (select v from ids where k='almoco')),
          '2026-11-20 15:00:00+00'::timestamptz, 'bloqueio usa o fuso do salão (São Paulo → UTC)');

-- recepção
select t.login((select v from ids where k='rec'));
select throws_ok(
  format($$ select public.set_professional_schedule(%L, '[{"weekday":1,"starts_at":"09:00","ends_at":"12:00"}]') $$,
         (select v from ids where k='paulo')),
  '42501', null, 'recepção não grava jornada');
select throws_ok(
  format($$ select public.create_schedule_block(%L, '2026-11-21 09:00', '2026-11-21 10:00', 'other') $$,
         (select v from ids where k='paulo')),
  '42501', null, 'recepção não cria bloqueio');

-- outro salão
select t.login((select v from ids where k='bia'));
select is((select count(*)::int from public.professional_schedules), 0, 'outro salão não vê jornada');
select is((select count(*)::int from public.schedule_blocks), 0, 'outro salão não vê bloqueios');

select * from finish();
rollback;
