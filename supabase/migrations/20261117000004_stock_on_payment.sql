-- Baixa automática do estoque no recebimento e devolução no estorno. O estoque
-- pode ficar negativo: a baixa nunca recusa o recebimento (só gera o alerta).

-- Para cada serviço, os consumíveis configurados × quantidade do item; para cada
-- produto, a quantidade vendida. Item de estoque inativo também baixa. O custo do
-- item no momento fica no movimento (custo real do atendimento na Fase 6).
create or replace function public.apply_stock_for_appointment(p_appointment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.stock_movements (salon_id, inventory_item_id, type, quantity, unit_cost_cents, appointment_id, appointment_item_id)
  select i.salon_id, c.inventory_item_id, 'consumption', -(c.quantity * i.quantity), s.unit_cost_cents, i.appointment_id, i.id
  from public.appointment_items i
  join public.service_consumables c on c.service_id = i.service_id
  join public.inventory_items s on s.id = c.inventory_item_id
  where i.appointment_id = p_appointment_id and i.item_type = 'service'
  union all
  select i.salon_id, i.inventory_item_id, 'out', -i.quantity, s.unit_cost_cents, i.appointment_id, i.id
  from public.appointment_items i
  join public.inventory_items s on s.id = i.inventory_item_id
  where i.appointment_id = p_appointment_id and i.item_type = 'product';
$$;

revoke execute on function public.apply_stock_for_appointment(uuid) from public, anon, authenticated;

-- Recebimento recriado (Fase 5, Tarefa 4) com a baixa antes de marcar pago.
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

  -- Baixa do estoque na mesma transação; saldo insuficiente nunca recusa.
  perform public.apply_stock_for_appointment(v_appt.id);

  update public.appointments set status = 'paid', discount_cents = p_discount_cents where id = v_appt.id returning * into v_appt;
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'paid', jsonb_build_object('payments', p_payments, 'discount_cents', p_discount_cents));
  return v_appt;
end;
$$;

-- Estorno recriado (Fase 4) com a devolução do estoque.
create or replace function public.refund_appointment(p_appointment_id uuid, p_reason text)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments := public.lock_appointment(p_appointment_id);
  v_session uuid;
begin
  if public.has_salon_role(v_appt.salon_id, '{admin}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if v_appt.refunded_at is not null then
    raise exception 'Atendimento já estornado.';
  end if;
  if v_appt.status <> 'paid' then
    raise exception 'Atendimento não pode mudar deste status.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Informe o motivo do estorno.';
  end if;
  v_session := public.open_cash_session_id(v_appt.salon_id);
  if v_session is null then
    raise exception 'Abra o caixa antes de estornar.';
  end if;

  insert into public.transactions (salon_id, type, category, amount_cents, method, status, paid_at, appointment_id, cash_session_id, reverses_id, description)
  select salon_id, 'expense', 'estorno', amount_cents, method, 'paid', now(), appointment_id, v_session, id, left(trim(p_reason), 200)
  from public.transactions
  where appointment_id = v_appt.id and type = 'income' and status = 'paid';
  update public.transactions set status = 'reversed'
  where appointment_id = v_appt.id and type = 'income' and status in ('paid', 'pending');

  insert into public.commissions (salon_id, appointment_id, appointment_item_id, professional_id, base_cents, percent, amount_cents, reference_month, status, reverses_id)
  select salon_id, appointment_id, appointment_item_id, professional_id, -base_cents, percent, -amount_cents,
         public.salon_month(v_appt.salon_id), 'available', id
  from public.commissions
  where appointment_id = v_appt.id and status = 'paid' and reverses_id is null and amount_cents > 0;
  update public.commissions set status = 'reversed'
  where appointment_id = v_appt.id and status in ('blocked', 'available') and reverses_id is null;

  -- Devolve ao estoque o que saiu pelo atendimento (uma vez: o refunded_at acima barra a segunda).
  insert into public.stock_movements (salon_id, inventory_item_id, type, quantity, unit_cost_cents, appointment_id, appointment_item_id, reverses_id, reason)
  select m.salon_id, m.inventory_item_id, 'in', -m.quantity, m.unit_cost_cents, m.appointment_id, m.appointment_item_id, m.id, left(trim(p_reason), 200)
  from public.stock_movements m
  where m.appointment_id = v_appt.id and m.type in ('consumption', 'out')
    and not exists (select 1 from public.stock_movements r where r.reverses_id = m.id);

  update public.appointments set refunded_at = now() where id = v_appt.id returning * into v_appt;
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'refunded', jsonb_build_object('reason', trim(p_reason)));
  return v_appt;
end;
$$;
