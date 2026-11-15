-- Salonix · Fase 6 · Contas a pagar e relatórios financeiros

-- ---------------------------------------------------------------------------
-- Despesas (contas a pagar)
-- ---------------------------------------------------------------------------
create function public._expense_categories()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['aluguel', 'energia', 'agua', 'internet', 'produtos', 'manutencao', 'impostos', 'salarios', 'marketing', 'outros']; $$;

create function public.create_expense(
  p_salon_id uuid, p_category text, p_description text, p_amount_cents integer,
  p_due_date date, p_paid boolean default false, p_method public.payment_method default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  if (select auth.uid()) is null then raise exception 'Não autenticado' using errcode = '28000'; end if;
  if not public.has_salon_role(p_salon_id, array['admin']::public.salon_role[]) then
    raise exception 'Só o administrador lança despesas' using errcode = '42501';
  end if;
  if p_category is null or not (p_category = any (public._expense_categories())) then raise exception 'Categoria inválida'; end if;
  if char_length(trim(coalesce(p_description, ''))) < 2 then raise exception 'Informe a descrição da despesa'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Informe um valor maior que zero'; end if;
  if not p_paid and p_due_date is null then raise exception 'Informe o vencimento'; end if;
  if p_paid and p_method is null then raise exception 'Informe a forma de pagamento'; end if;

  insert into public.transactions (salon_id, type, category, description, amount_cents, payment_method, status, due_date, paid_at, created_by)
  values (p_salon_id, 'expense', p_category, trim(p_description), p_amount_cents,
    case when p_paid then p_method end,
    case when p_paid then 'paid' else 'pending' end,
    p_due_date, case when p_paid then now() end, (select auth.uid()))
  returning * into v_tx;
  return v_tx;
end;
$$;

create function public.pay_expense(p_transaction_id uuid, p_method public.payment_method, p_paid_on date default null)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_tz text;
begin
  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found or v_tx.type <> 'expense' then raise exception 'Despesa não encontrada'; end if;
  if not public.has_salon_role(v_tx.salon_id, array['admin']::public.salon_role[]) then
    raise exception 'Só o administrador paga despesas' using errcode = '42501';
  end if;
  if v_tx.status <> 'pending' then raise exception 'Esta despesa não está pendente'; end if;
  if p_method is null then raise exception 'Informe a forma de pagamento'; end if;
  select s.timezone into v_tz from public.salons s where s.id = v_tx.salon_id;
  update public.transactions
  set status = 'paid', payment_method = p_method,
      paid_at = case when p_paid_on is null then now() else (p_paid_on::timestamp + interval '12 hours') at time zone v_tz end
  where id = v_tx.id returning * into v_tx;
  return v_tx;
end;
$$;

create function public.delete_expense(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found or v_tx.type <> 'expense' then raise exception 'Despesa não encontrada'; end if;
  if not public.has_salon_role(v_tx.salon_id, array['admin']::public.salon_role[]) then
    raise exception 'Só o administrador exclui despesas' using errcode = '42501';
  end if;
  if v_tx.status <> 'pending' or v_tx.category in ('refund', 'commission') then
    raise exception 'Só é possível excluir despesas pendentes lançadas manualmente';
  end if;
  delete from public.transactions where id = v_tx.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Relatório financeiro (admin)
-- ---------------------------------------------------------------------------
create function public.financial_report(p_salon_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_today date;
  v_result jsonb;
begin
  if not public.has_salon_role(p_salon_id, array['admin']::public.salon_role[]) then
    raise exception 'Só o administrador acessa os relatórios' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Período inválido'; end if;
  if p_to - p_from > 366 then raise exception 'O período máximo é de 1 ano'; end if;
  select s.timezone into v_tz from public.salons s where s.id = p_salon_id;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;
  v_today := (now() at time zone v_tz)::date;

  with paid_appts as (
    select a.id, a.professional_id, a.total_cents, a.discount_cents,
           (select max(ev.created_at) from public.appointment_events ev where ev.appointment_id = a.id and ev.event_type = 'paid') as paid_at
    from public.appointments a
    where a.salon_id = p_salon_id and a.status = 'paid'
  ),
  in_period as (select * from paid_appts where paid_at >= v_start and paid_at < v_end),
  items as (
    select i.id, i.appointment_id, i.item_type, i.description, i.quantity,
           coalesce(i.professional_id, ip.professional_id) as professional_id,
           i.unit_price_cents * i.quantity as gross,
           sum(i.unit_price_cents * i.quantity) over (partition by i.appointment_id order by i.created_at, i.id) as cum_gross,
           ip.total_cents, ip.discount_cents
    from public.appointment_items i join in_period ip on ip.id = i.appointment_id
  ),
  items_net as (
    select it.*,
      it.gross - case when it.total_cents = 0 then 0
        else (round(it.cum_gross::numeric * it.discount_cents / it.total_cents)
            - round((it.cum_gross - it.gross)::numeric * it.discount_cents / it.total_cents))::bigint end as net
    from items it
  ),
  revenue as (select coalesce(sum(total_cents - discount_cents), 0)::bigint as v, count(*)::int as n, coalesce(sum(discount_cents), 0)::bigint as d from in_period),
  materials as (
    select coalesce(round(sum(-m.delta * coalesce(m.unit_cost_cents, 0))), 0)::bigint as v
    from public.stock_movements m
    where m.appointment_id in (select id from in_period) and m.type in ('consumption', 'out')
  ),
  commissions_sum as (
    select coalesce(sum(c.amount_cents), 0)::bigint as v
    from public.commissions c where c.appointment_id in (select id from in_period) and c.status <> 'reversed'
  ),
  expenses_paid as (
    select t.category, sum(t.amount_cents)::bigint as v
    from public.transactions t
    where t.salon_id = p_salon_id and t.type = 'expense' and t.status = 'paid'
      and t.category not in ('refund', 'commission') and t.paid_at >= v_start and t.paid_at < v_end
    group by t.category
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'revenue_cents', (select v from revenue),
    'appointments_count', (select n from revenue),
    'avg_ticket_cents', (select case when n = 0 then 0 else round(v::numeric / n) end::bigint from revenue),
    'discount_cents', (select d from revenue),
    'pending_pix_cents', coalesce((select sum(t.amount_cents) from public.transactions t
        where t.appointment_id in (select id from in_period) and t.type = 'income' and t.status = 'pending' and t.payment_method = 'pix'), 0),
    'refunds_cents', coalesce((select sum(t.amount_cents) from public.transactions t
        where t.salon_id = p_salon_id and t.type = 'expense' and t.category = 'refund' and t.status = 'paid'
          and t.paid_at >= v_start and t.paid_at < v_end), 0),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'revenue_cents', rev, 'count', n) order by d)
        from (select (paid_at at time zone v_tz)::date as d, sum(total_cents - discount_cents)::bigint as rev, count(*)::int as n
              from in_period group by 1) x), '[]'::jsonb),
    'by_method', coalesce((select jsonb_agg(jsonb_build_object('method', m, 'cents', c) order by c desc)
        from (select t.payment_method as m, sum(t.amount_cents)::bigint as c from public.transactions t
              where t.appointment_id in (select id from in_period) and t.type = 'income' and t.status in ('paid', 'pending')
              group by t.payment_method) x), '[]'::jsonb),
    'by_service', coalesce((select jsonb_agg(jsonb_build_object('name', description, 'count', q, 'cents', c) order by c desc)
        from (select description, sum(quantity)::int as q, sum(net)::bigint as c from items_net where item_type = 'service' group by description) x), '[]'::jsonb),
    'products_cents', coalesce((select sum(net) from items_net where item_type = 'product'), 0),
    'by_professional', coalesce((select jsonb_agg(jsonb_build_object('professional_id', pid, 'name', name, 'count', n, 'cents', c) order by c desc)
        from (select n.professional_id as pid, p.name, count(distinct n.appointment_id)::int as n, sum(n.net)::bigint as c
              from items_net n left join public.professionals p on p.id = n.professional_id
              where n.item_type = 'service' group by n.professional_id, p.name) x), '[]'::jsonb),
    'materials_cost_cents', (select v from materials),
    'cost_per_appointment_cents', (select case when (select n from revenue) = 0 then 0 else round((select v from materials)::numeric / (select n from revenue)) end::bigint),
    'commissions_cents', (select v from commissions_sum),
    'expenses_cents', coalesce((select sum(v) from expenses_paid), 0),
    'expenses_by_category', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'cents', v) order by v desc) from expenses_paid), '[]'::jsonb),
    'payable_pending_cents', coalesce((select sum(t.amount_cents) from public.transactions t
        where t.salon_id = p_salon_id and t.type = 'expense' and t.status = 'pending'), 0),
    'payable_overdue_cents', coalesce((select sum(t.amount_cents) from public.transactions t
        where t.salon_id = p_salon_id and t.type = 'expense' and t.status = 'pending' and t.due_date < v_today), 0),
    'result_cents', (select v from revenue) - (select v from materials) - (select v from commissions_sum)
        - coalesce((select sum(v) from expenses_paid), 0)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public._expense_categories() from public, anon, authenticated;
revoke all on function public.create_expense(uuid, text, text, integer, date, boolean, public.payment_method) from public, anon;
revoke all on function public.pay_expense(uuid, public.payment_method, date) from public, anon;
revoke all on function public.delete_expense(uuid) from public, anon;
revoke all on function public.financial_report(uuid, date, date) from public, anon;
grant execute on function public.create_expense(uuid, text, text, integer, date, boolean, public.payment_method) to authenticated, service_role;
grant execute on function public.pay_expense(uuid, public.payment_method, date) to authenticated, service_role;
grant execute on function public.delete_expense(uuid) to authenticated, service_role;
grant execute on function public.financial_report(uuid, date, date) to authenticated, service_role;
