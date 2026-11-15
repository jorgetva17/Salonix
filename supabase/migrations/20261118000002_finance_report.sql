-- Relatório financeiro. O recebimento passa a gravar a data (appointments.paid_at)
-- e o valor líquido de cada item (appointment_items.net_cents); o relatório soma
-- tudo no banco, no fuso do salão.

alter table public.appointments add column paid_at timestamptz;
alter table public.appointment_items add column net_cents integer;

create index appointments_paid_idx on public.appointments (salon_id, paid_at) where status = 'paid';

-- Valor líquido de cada item: preço × quantidade menos a parte dele no desconto,
-- repartido como no recebimento (ordem created_at, id).
create or replace function public.set_item_net_cents(p_appointment_id uuid, p_discount_cents integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shares integer[];
begin
  select public.allocate_discount(array_agg(i.unit_price_cents * i.quantity order by i.created_at, i.id), p_discount_cents)
  into v_shares
  from public.appointment_items i
  where i.appointment_id = p_appointment_id;
  update public.appointment_items i
  set net_cents = i.unit_price_cents * i.quantity - v_shares[o.ord]
  from (
    select x.id, row_number() over (order by x.created_at, x.id) as ord
    from public.appointment_items x
    where x.appointment_id = p_appointment_id
  ) o
  where i.id = o.id;
end;
$$;

revoke execute on function public.set_item_net_cents(uuid, integer) from public, anon, authenticated;

-- Atendimentos já pagos: data do evento 'paid' e o valor líquido dos itens.
update public.appointments a
set paid_at = e.created_at
from (
  select appointment_id, max(created_at) as created_at
  from public.appointment_events
  where event = 'paid'
  group by appointment_id
) e
where e.appointment_id = a.id and a.status = 'paid' and a.paid_at is null;

select public.set_item_net_cents(id, discount_cents) from public.appointments where status = 'paid';

-- Mesmo recebimento da Fase 5, agora gravando net_cents e paid_at.
create or replace function public.receive_payment(p_appointment_id uuid, p_payments jsonb, p_discount_cents integer default 0)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments := public.lock_appointment(p_appointment_id);
  v_session uuid;
  v_paid bigint;
  v_valid boolean;
  v_has_pix boolean;
  v_shares integer[];
  v_month date;
begin
  if public.has_salon_role(v_appt.salon_id, '{admin,reception}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if v_appt.status <> 'awaiting_payment' then
    raise exception 'Atendimento não pode mudar deste status.';
  end if;
  v_session := public.open_cash_session_id(v_appt.salon_id);
  if v_session is null then
    raise exception 'Abra o caixa antes de receber.';
  end if;
  if p_discount_cents is null or p_discount_cents < 0 or p_discount_cents > v_appt.total_cents then
    raise exception 'Desconto maior que o total.';
  end if;

  if jsonb_typeof(p_payments) is distinct from 'array' then
    raise exception 'Valor pago não confere com o total.';
  end if;
  -- Cada linha com forma conhecida e valor inteiro positivo; a soma fecha o total.
  -- coalesce por linha: um campo ausente dá NULL, que o bool_and ignoraria.
  select coalesce(bool_and(coalesce(
           p->>'method' in ('cash', 'debit', 'credit', 'pix')
           and jsonb_typeof(p->'amount_cents') = 'number'
           and (p->>'amount_cents')::numeric = trunc((p->>'amount_cents')::numeric)
           and (p->>'amount_cents')::numeric > 0, false)), true),
         coalesce(sum((p->>'amount_cents')::numeric), 0),
         coalesce(bool_or(p->>'method' = 'pix'), false)
  into v_valid, v_paid, v_has_pix
  from jsonb_array_elements(p_payments) p;
  if not v_valid or v_paid <> v_appt.total_cents - p_discount_cents then
    raise exception 'Valor pago não confere com o total.';
  end if;

  insert into public.transactions (salon_id, type, category, amount_cents, method, status, paid_at, appointment_id, cash_session_id)
  select v_appt.salon_id, 'income', 'atendimento', (p->>'amount_cents')::integer, p->>'method',
         case when p->>'method' = 'pix' then 'pending' else 'paid' end,
         case when p->>'method' = 'pix' then null else now() end,
         v_appt.id, v_session
  from jsonb_array_elements(p_payments) p;

  select public.allocate_discount(array_agg(i.unit_price_cents * i.quantity order by i.created_at, i.id), p_discount_cents)
  into v_shares
  from public.appointment_items i
  where i.appointment_id = v_appt.id;
  v_month := public.salon_month(v_appt.salon_id);

  insert into public.commissions (salon_id, appointment_id, appointment_item_id, professional_id, base_cents, percent, amount_cents, reference_month, status)
  select v_appt.salon_id, v_appt.id, x.id, x.professional_id, x.base, x.percent,
         round(x.base * x.percent / 100)::integer, v_month,
         case when v_has_pix then 'blocked' else 'available' end
  from (
    select i.id, coalesce(i.professional_id, v_appt.professional_id) as professional_id,
           i.unit_price_cents * i.quantity - v_shares[i.ord] as base,
           public.commission_percent_for(coalesce(i.professional_id, v_appt.professional_id), i.service_id) as percent
    from (
      select i.*, row_number() over (order by i.created_at, i.id) as ord
      from public.appointment_items i
      where i.appointment_id = v_appt.id
    ) i
    where i.item_type = 'service'
  ) x
  where x.professional_id is not null;

  -- Valor líquido de cada item, base do relatório por serviço e produto.
  perform public.set_item_net_cents(v_appt.id, p_discount_cents);

  -- Baixa do estoque na mesma transação; saldo insuficiente nunca recusa.
  perform public.apply_stock_for_appointment(v_appt.id);

  update public.appointments set status = 'paid', discount_cents = p_discount_cents, paid_at = now()
  where id = v_appt.id returning * into v_appt;
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'paid', jsonb_build_object('payments', p_payments, 'discount_cents', p_discount_cents));
  return v_appt;
end;
$$;

-- Relatório do admin, de p_from a p_to (inclusive, no fuso do salão, até 366 dias).
-- Entram os atendimentos recebidos no período e não estornados; os estornados
-- aparecem só em "refunded". Por forma, por item e total fecham em centavos.
create or replace function public.finance_report(p_salon_id uuid, p_from date, p_to date)
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
  v_result jsonb;
begin
  if public.has_salon_role(p_salon_id, '{admin}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 365 then
    raise exception 'Período inválido.';
  end if;
  select timezone into v_tz from public.salons where id = p_salon_id;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;

  with paid as (
    select a.*
    from public.appointments a
    where a.salon_id = p_salon_id and a.status = 'paid' and a.paid_at >= v_start and a.paid_at < v_end
  ),
  included as (
    select * from paid where refunded_at is null
  ),
  items as (
    select i.item_type, i.service_id, i.inventory_item_id, i.quantity, i.appointment_id,
           coalesce(i.professional_id, a.professional_id) as professional_id,
           coalesce(i.net_cents, i.unit_price_cents * i.quantity) as amount
    from public.appointment_items i
    join included a on a.id = i.appointment_id
  ),
  incomes as (
    select t.method, t.status, t.amount_cents
    from public.transactions t
    join included a on a.id = t.appointment_id
    where t.type = 'income' and t.status in ('paid', 'pending')
  ),
  per_appt as (
    select a.id, a.paid_at, coalesce(c.name, 'Venda no balcão') as label,
           a.total_cents - a.discount_cents as revenue,
           (select round(coalesce(sum(-m.quantity * coalesce(m.unit_cost_cents, 0)), 0))::integer
            from public.stock_movements m
            where m.appointment_id = a.id and m.type in ('consumption', 'out') and m.reverses_id is null) as material
    from included a
    left join public.customers c on c.id = a.customer_id
  )
  select jsonb_build_object(
    'revenue_cents', coalesce((select sum(revenue) from per_appt), 0),
    'appointments', (select count(*) from included),
    'discount_cents', coalesce((select sum(discount_cents) from included), 0),
    'services_cents', coalesce((select sum(amount) from items where item_type = 'service'), 0),
    'products_cents', coalesce((select sum(amount) from items where item_type = 'product'), 0),
    'by_method', (
      select jsonb_build_object(
        'cash', coalesce(sum(amount_cents) filter (where method = 'cash'), 0),
        'debit', coalesce(sum(amount_cents) filter (where method = 'debit'), 0),
        'credit', coalesce(sum(amount_cents) filter (where method = 'credit'), 0),
        'pix', coalesce(sum(amount_cents) filter (where method = 'pix'), 0))
      from incomes),
    'pix_pending_cents', coalesce((select sum(amount_cents) from incomes where method = 'pix' and status = 'pending'), 0),
    'by_item', coalesce((
      select jsonb_agg(jsonb_build_object('type', x.item_type, 'name', x.name, 'quantity', x.quantity, 'amount_cents', x.amount)
                       order by x.amount desc, x.name)
      from (
        select i.item_type, coalesce(s.name, inv.name) as name, sum(i.quantity) as quantity, sum(i.amount) as amount
        from items i
        left join public.services s on s.id = i.service_id
        left join public.inventory_items inv on inv.id = i.inventory_item_id
        group by i.item_type, coalesce(i.service_id, i.inventory_item_id), coalesce(s.name, inv.name)
      ) x), '[]'::jsonb),
    'by_professional', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'appointments', x.appointments, 'amount_cents', x.amount)
                       order by x.amount desc, x.name)
      from (
        select p.name, count(distinct i.appointment_id) as appointments, sum(i.amount) as amount
        from items i
        join public.professionals p on p.id = i.professional_id
        where i.item_type = 'service'
        group by p.id, p.name
      ) x), '[]'::jsonb),
    'material_cost_cents', coalesce((select sum(material) from per_appt), 0),
    'commission_cents', coalesce((
      select sum(c.amount_cents)
      from public.commissions c
      join included a on a.id = c.appointment_id
      where c.reverses_id is null and c.status <> 'reversed'), 0),
    'refunded', (
      select jsonb_build_object('appointments', count(*), 'amount_cents', coalesce(sum(total_cents - discount_cents), 0))
      from paid where refunded_at is not null),
    'bills_paid_cents', coalesce((
      select sum(amount_cents)
      from public.transactions
      where salon_id = p_salon_id and type = 'expense' and status = 'paid' and public.is_bill_category(category)
        and paid_at >= v_start and paid_at < v_end), 0),
    'costs', coalesce((
      select jsonb_agg(jsonb_build_object('appointment_id', x.id, 'paid_at', x.paid_at, 'label', x.label,
                                          'revenue_cents', x.revenue, 'material_cost_cents', x.material)
                       order by x.paid_at desc)
      from (select * from per_appt order by paid_at desc limit 200) x), '[]'::jsonb)
  )
  into v_result;
  return v_result;
end;
$$;

revoke execute on function public.finance_report(uuid, date, date) from public, anon;
grant execute on function public.finance_report(uuid, date, date) to authenticated;
