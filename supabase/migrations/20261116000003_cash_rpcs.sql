-- Abrir e fechar o caixa. Uma sessão aberta por salão (índice único parcial).

create or replace function public.open_cash_session(p_salon_id uuid, p_opening_cents integer)
returns public.cash_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_sessions;
begin
  if public.has_salon_role(p_salon_id, '{admin,reception}') is not true then
    raise exception 'Sem permissão.';
  end if;
  begin
    insert into public.cash_sessions (salon_id, opening_cents) values (p_salon_id, p_opening_cents)
    returning * into v_session;
  exception when unique_violation then
    raise exception 'Já existe um caixa aberto.';
  end;
  return v_session;
end;
$$;

-- Esperado por forma: entradas pagas − saídas pagas da sessão; o dinheiro soma a
-- abertura. Pix pendente fica fora das formas, em "pix_pending" (uso interno).
create or replace function public.cash_session_expected(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'cash', s.opening_cents + coalesce(sum(t.signed) filter (where t.method = 'cash' and t.status = 'paid'), 0),
    'debit', coalesce(sum(t.signed) filter (where t.method = 'debit' and t.status = 'paid'), 0),
    'credit', coalesce(sum(t.signed) filter (where t.method = 'credit' and t.status = 'paid'), 0),
    'pix', coalesce(sum(t.signed) filter (where t.method = 'pix' and t.status = 'paid'), 0),
    'pix_pending', coalesce(sum(t.amount_cents) filter (where t.method = 'pix' and t.status = 'pending' and t.type = 'income'), 0)
  )
  from public.cash_sessions s
  left join lateral (
    select x.method, x.status, x.type, x.amount_cents,
           case when x.type = 'income' then x.amount_cents else -x.amount_cents end as signed
    from public.transactions x
    where x.cash_session_id = s.id
  ) t on true
  where s.id = p_session_id
  group by s.id, s.opening_cents;
$$;

revoke execute on function public.cash_session_expected(uuid) from public, anon, authenticated;

create or replace function public.close_cash_session(p_session_id uuid, p_counted jsonb)
returns public.cash_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_sessions;
  v_expected jsonb;
  v_counted jsonb;
begin
  select * into v_session from public.cash_sessions where id = p_session_id for update;
  if public.has_salon_role(v_session.salon_id, '{admin,reception}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if v_session.closed_at is not null then
    raise exception 'Caixa já fechado.';
  end if;

  v_expected := public.cash_session_expected(p_session_id);
  v_counted := jsonb_build_object(
    'cash', coalesce((p_counted->>'cash')::integer, 0),
    'debit', coalesce((p_counted->>'debit')::integer, 0),
    'credit', coalesce((p_counted->>'credit')::integer, 0),
    'pix', coalesce((p_counted->>'pix')::integer, 0)
  );

  update public.cash_sessions
  set closed_at = now(),
      closed_by = auth.uid(),
      expected = v_expected,
      counted = v_counted,
      difference_cents =
        ((v_counted->>'cash')::int + (v_counted->>'debit')::int + (v_counted->>'credit')::int + (v_counted->>'pix')::int)
        - ((v_expected->>'cash')::int + (v_expected->>'debit')::int + (v_expected->>'credit')::int + (v_expected->>'pix')::int)
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

revoke execute on function public.open_cash_session(uuid, integer) from public, anon;
revoke execute on function public.close_cash_session(uuid, jsonb) from public, anon;
grant execute on function public.open_cash_session(uuid, integer) to authenticated;
grant execute on function public.close_cash_session(uuid, jsonb) to authenticated;
