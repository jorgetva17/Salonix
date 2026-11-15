-- Salonix · Fase 7 · Endurecimento de privilégios
--
-- O Supabase concede ALL a anon/authenticated em tabelas e funções novas do schema public.
-- Aqui tiramos o que o app não usa: a segurança deixa de depender só de RLS/políticas ausentes.

-- 1) anon (visitante sem login) não acessa nada do schema public.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- 2) authenticated nunca precisa de TRUNCATE/REFERENCES/TRIGGER.
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- 3) Tabelas só-RPC: toda escrita passa por funções com checagem de perfil.
revoke insert, update, delete on
  public.appointments, public.appointment_items, public.appointment_events,
  public.cash_sessions, public.transactions, public.commissions, public.stock_movements
from authenticated;

-- 4) Funções internas (prefixo _) e de gatilho não são chamáveis pela API.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like '\_%' escape '\' or p.prorettype = 'trigger'::regtype)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
