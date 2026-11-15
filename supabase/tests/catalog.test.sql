begin;
set local search_path to public, extensions;
select plan(19);

create function pg_temp.make_user(p_id uuid, p_email text) returns void language sql as $$
  insert into auth.users (id, email) values (p_id, p_email);
$$;
create function pg_temp.claims(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
    set_config('request.jwt.claim.sub', p_uid::text, true);
$$;

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'admin-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'rec-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a3', 'pro-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a4', 'pro2-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'admin-b@t.dev');

select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated; select public.create_salon('Salão A'); reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated; select public.create_salon('Salão B'); reset role;

insert into public.salon_members (salon_id, user_id, role)
select s.id, v.uid, v.r from public.salons s,
  (values ('00000000-0000-0000-0000-0000000000a2'::uuid, 'reception'::public.salon_role),
          ('00000000-0000-0000-0000-0000000000a3'::uuid, 'professional'::public.salon_role),
          ('00000000-0000-0000-0000-0000000000a4'::uuid, 'professional'::public.salon_role)) v(uid, r)
where s.name = 'Salão A';

select set_config('t.a', (select id::text from public.salons where name = 'Salão A'), true);
select set_config('t.b', (select id::text from public.salons where name = 'Salão B'), true);

-- dados base (como superusuário)
insert into public.services (id, salon_id, name, duration_minutes, price_cents)
values ('00000000-0000-0000-0000-0000000000e1', current_setting('t.a')::uuid, 'Corte', 30, 4500);
insert into public.professionals (id, salon_id, user_id, name)
values ('00000000-0000-0000-0000-0000000000f1', current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a3', 'Paulo');
insert into public.professionals (id, salon_id, user_id, name)
values ('00000000-0000-0000-0000-0000000000f2', current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a4', 'Pedro');
insert into public.professional_service_commissions (salon_id, professional_id, service_id, commission_percent)
values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 40);

insert into public.professional_default_commissions (salon_id, professional_id, commission_percent)
values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', 35);

-- serviços: só admin escreve
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$insert into public.services (salon_id, name, duration_minutes, price_cents)
  values (current_setting('t.a')::uuid, 'Barba', 20, 3000)$$, '42501', null, 'recepção não cria serviço');
reset role;

select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select lives_ok($$insert into public.services (salon_id, name, duration_minutes, price_cents)
  values (current_setting('t.a')::uuid, 'Barba', 20, 3000)$$, 'admin cria serviço');
select throws_ok($$insert into public.services (salon_id, name, duration_minutes, price_cents)
  values (current_setting('t.a')::uuid, 'Grátis negativo', 20, -1)$$, '23514', null, 'preço negativo é rejeitado');
select throws_ok($$insert into public.professional_service_commissions (salon_id, professional_id, service_id, commission_percent)
  values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1', 101)$$,
  '23514', null, 'comissão acima de 100% é rejeitada');
select throws_ok($$insert into public.professional_schedules (salon_id, professional_id, weekday, start_time, end_time)
  values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', 1, '18:00', '09:00')$$,
  '23514', null, 'jornada com fim antes do início é rejeitada');
reset role;

-- profissional: lê, não escreve
select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select cmp_ok((select count(*)::int from public.services), '>=', 2, 'profissional lê serviços');
with u as (update public.professionals set name = 'Hack' where id = '00000000-0000-0000-0000-0000000000f2' returning 1)
select is((select count(*)::int from u), 0, 'profissional não altera profissionais');
select throws_ok($$insert into public.customers (salon_id, name) values (current_setting('t.a')::uuid, 'Cliente X')$$,
  '42501', null, 'profissional não cria cliente');
select throws_ok($$insert into public.schedule_blocks (salon_id, professional_id, starts_at, ends_at)
  values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', now(), now() + interval '1 hour')$$,
  '42501', null, 'profissional não cria bloqueio');
reset role;

-- comissões: admin e o próprio profissional
select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select is((select count(*)::int from public.professional_service_commissions), 1, 'profissional vê a própria comissão');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000a4');
set local role authenticated;
select is((select count(*)::int from public.professional_service_commissions), 0, 'outro profissional não vê comissão alheia');
reset role;

select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select is((select count(*)::int from public.professional_default_commissions), 1, 'profissional vê a própria comissão padrão');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select count(*)::int from public.professional_default_commissions), 0, 'recepção não vê comissão padrão');
reset role;

-- recepção: clientes e bloqueios
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select lives_ok($$insert into public.customers (salon_id, name, phone) values (current_setting('t.a')::uuid, 'Maria', '85999990000')$$,
  'recepção cria cliente');
select throws_ok($$insert into public.customers (salon_id, name, phone) values (current_setting('t.a')::uuid, 'Zé', '(85) 9999')$$,
  '23514', null, 'telefone só aceita dígitos');
select lives_ok($$insert into public.schedule_blocks (salon_id, professional_id, starts_at, ends_at, reason)
  values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', now(), now() + interval '1 day', 'Folga')$$,
  'recepção cria bloqueio');
select is((select count(*)::int from public.professional_service_commissions), 0, 'recepção não vê comissões');
reset role;

-- isolamento entre salões
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select is((select count(*)::int from public.customers) + (select count(*)::int from public.services)
  + (select count(*)::int from public.professionals), 0, 'admin de outro salão não vê nada do salão A');
select throws_ok($$insert into public.professional_schedules (salon_id, professional_id, weekday, start_time, end_time)
  values (current_setting('t.b')::uuid, '00000000-0000-0000-0000-0000000000f1', 1, '09:00', '18:00')$$,
  '23503', null, 'FK composta impede jornada de outro salão');
reset role;

select * from finish();
rollback;
