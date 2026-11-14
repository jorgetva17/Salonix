-- Recebimento, Pix pendente, estorno e pagamento de comissões. Cada RPC é uma
-- transação: pagamentos + comissões + status acontecem juntos ou nada acontece.

-- Auxiliares internos ----------------------------------------------------------

-- Reparte o desconto entre os valores na proporção de cada um, em centavos
-- inteiros: parte inteira primeiro, o resto para as maiores frações (empate: o
-- primeiro). A soma do resultado é sempre exatamente p_discount.
create or replace function public.allocate_discount(p_amounts integer[], p_discount integer)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_total bigint := (select coalesce(sum(a), 0) from unnest(p_amounts) a);
  v_result integer[];
  v_left integer;
  v_i bigint;
begin
  if v_total = 0 or p_discount = 0 then
    return array_fill(0, array[coalesce(cardinality(p_amounts), 0)]);
  end if;
  select array_agg((p_discount::bigint * a / v_total)::integer order by ord)
  into v_result
  from unnest(p_amounts) with ordinality as x (a, ord);
  v_left := p_discount - (select sum(r) from unnest(v_result) r);
  -- Um centavo para cada um dos v_left itens de maior resto.
  for v_i in
    select ord from unnest(p_amounts) with ordinality as x (a, ord)
    order by (p_discount::bigint * a) % v_total desc, ord
    limit v_left
  loop
    v_result[v_i] := v_result[v_i] + 1;
  end loop;
  return v_result;
end;
$$;

-- Caixa aberto do salão (ou nulo).
create or replace function public.open_cash_session_id(p_salon_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.cash_sessions where salon_id = p_salon_id and closed_at is null;
$$;

-- Primeiro dia do mês corrente no fuso do salão.
create or replace function public.salon_month(p_salon_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select date_trunc('month', now() at time zone s.timezone)::date from public.salons s where s.id = p_salon_id;
$$;

revoke execute on function public.allocate_discount(integer[], integer) from public, anon, authenticated;
revoke execute on function public.open_cash_session_id(uuid) from public, anon, authenticated;
revoke execute on function public.salon_month(uuid) from public, anon, authenticated;

-- Receber -----------------------------------------------------------------------

-- p_payments: [{"method": "cash", "amount_cents": 4000}, ...]
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

  -- Cada linha com forma conhecida e valor inteiro positivo; a soma fecha o total.
  select coalesce(bool_and(
           p->>'method' in ('cash', 'debit', 'credit', 'pix')
           and jsonb_typeof(p->'amount_cents') = 'number'
           and (p->>'amount_cents')::numeric = trunc((p->>'amount_cents')::numeric)
           and (p->>'amount_cents')::numeric > 0), true),
         coalesce(sum((p->>'amount_cents')::numeric), 0),
         coalesce(bool_or(p->>'method' = 'pix'), false)
  into v_valid, v_paid, v_has_pix
  from jsonb_array_elements(case when jsonb_typeof(p_payments) = 'array' then p_payments else '[{}]'::jsonb end) p;
  if not v_valid or v_paid <> v_appt.total_cents - p_discount_cents then
    raise exception 'Valor pago não confere com o total.';
  end if;

  insert into public.transactions (salon_id, type, category, amount_cents, method, status, paid_at, appointment_id, cash_session_id)
  select v_appt.salon_id, 'income', 'atendimento', (p->>'amount_cents')::integer, p->>'method',
         case when p->>'method' = 'pix' then 'pending' else 'paid' end,
         case when p->>'method' = 'pix' then null else now() end,
         v_appt.id, v_session
  from jsonb_array_elements(p_payments) p;

  -- Comissão por item de serviço, sobre o valor do item menos a parte dele no desconto.
  select public.allocate_discount(array_agg(i.unit_price_cents * i.quantity order by i.created_at, i.id), p_discount_cents)
  into v_shares
  from public.appointment_items i
  where i.appointment_id = v_appt.id and i.item_type = 'service';
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
      where i.appointment_id = v_appt.id and i.item_type = 'service'
    ) i
  ) x
  where x.professional_id is not null;

  update public.appointments set status = 'paid', discount_cents = p_discount_cents where id = v_appt.id returning * into v_appt;
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'paid', jsonb_build_object('payments', p_payments, 'discount_cents', p_discount_cents));
  return v_appt;
end;
$$;

-- Confirma um Pix recebido; sem Pix pendente no atendimento, a comissão é liberada.
create or replace function public.confirm_pix(p_transaction_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if public.has_salon_role(v_tx.salon_id, '{admin,reception}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if v_tx.type <> 'income' or v_tx.method is distinct from 'pix' or v_tx.status <> 'pending' then
    raise exception 'Pix já confirmado.';
  end if;

  update public.transactions set status = 'paid', paid_at = now() where id = p_transaction_id returning * into v_tx;
  if v_tx.appointment_id is not null then
    if not exists (
      select 1 from public.transactions
      where appointment_id = v_tx.appointment_id and method = 'pix' and status = 'pending'
    ) then
      update public.commissions set status = 'available' where appointment_id = v_tx.appointment_id and status = 'blocked';
    end if;
    insert into public.appointment_events (salon_id, appointment_id, event, data)
    values (v_tx.salon_id, v_tx.appointment_id, 'pix_confirmed', jsonb_build_object('transaction_id', v_tx.id));
  end if;
  return v_tx;
end;
$$;

revoke execute on function public.receive_payment(uuid, jsonb, integer) from public, anon;
revoke execute on function public.confirm_pix(uuid) from public, anon;
grant execute on function public.receive_payment(uuid, jsonb, integer) to authenticated;
grant execute on function public.confirm_pix(uuid) to authenticated;
