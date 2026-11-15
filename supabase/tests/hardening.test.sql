begin;
set local search_path to public, extensions;
select plan(9);

-- Invariantes de segurança que valem para qualquer migration futura -----------------------------
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0,
  'toda tabela de public tem RLS habilitado');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')), 0,
  'toda função security definer fixa o search_path');

select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
      or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))), 0,
  'anon não tem privilégio em nenhuma tabela de public');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), 0,
  'anon não executa nenhuma função de public');

select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('appointments', 'appointment_items', 'appointment_events', 'cash_sessions',
    'transactions', 'commissions', 'stock_movements')
    and (has_table_privilege('authenticated', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'update')
      or has_table_privilege('authenticated', c.oid, 'delete'))), 0,
  'tabelas só-RPC não aceitam escrita direta de authenticated');

select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('authenticated', c.oid, 'truncate') or has_table_privilege('authenticated', c.oid, 'references')
      or has_table_privilege('authenticated', c.oid, 'trigger'))), 0,
  'authenticated não tem TRUNCATE/REFERENCES/TRIGGER');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like '\_%' escape '\' or p.prorettype = 'trigger'::regtype)
    and has_function_privilege('authenticated', p.oid, 'execute')), 0,
  'funções internas e de gatilho não são chamáveis por authenticated');

-- Dados sensíveis só aparecem para quem deve (regressão das políticas qualificadas) --------------
create function pg_temp.claims(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
    set_config('request.jwt.claim.sub', p_uid::text, true);
$$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'a@t.dev'), ('00000000-0000-0000-0000-0000000000b1', 'b@t.dev');
select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated; select public.create_salon('Salão A'); reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated; select public.create_salon('Salão B'); reset role;
select set_config('t.a', (select id::text from public.salons where name = 'Salão A'), true);
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values ('00000000-0000-0000-0000-0000000000e1', current_setting('t.a')::uuid, 'Corte', 30, 4500);
insert into public.professionals (id, salon_id, name) values ('00000000-0000-0000-0000-0000000000f1', current_setting('t.a')::uuid, 'Paulo');
insert into public.appointments (id, salon_id, guest_name, professional_id, kind, status, arrived_at, total_cents)
values ('00000000-0000-0000-0000-0000000000c1', current_setting('t.a')::uuid, 'Cliente', '00000000-0000-0000-0000-0000000000f1', 'walk_in', 'waiting', now(), 4500);
insert into public.appointment_items (appointment_id, salon_id, service_id, description, unit_price_cents)
values ('00000000-0000-0000-0000-0000000000c1', current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000e1', 'Corte', 4500);
insert into public.appointment_events (appointment_id, salon_id, event_type) values ('00000000-0000-0000-0000-0000000000c1', current_setting('t.a')::uuid, 'created');

select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select is((select count(*)::int from public.appointment_items) + (select count(*)::int from public.appointment_events), 2, 'admin do salão vê itens e histórico');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select is((select count(*)::int from public.appointment_items) + (select count(*)::int from public.appointment_events), 0, 'admin de outro salão não vê itens nem histórico');
reset role;

select * from finish();
rollback;
