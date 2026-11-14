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

-- Caixa aberto do salão (ou nulo), travado em modo compartilhado até o fim da
-- transação: um fechamento simultâneo espera, ou já fechou e aqui vem nulo. Sem a
-- trava, um lançamento podia cair num caixa que acabou de ser fechado.
create or replace function public.open_cash_session_id(p_salon_id uuid)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select id from public.cash_sessions where salon_id = p_salon_id and closed_at is null for share;
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
  select * into v_tx from public.transactions where id = p_transaction_id;
  if public.has_salon_role(v_tx.salon_id, '{admin,reception}') is not true then
    raise exception 'Sem permissão.';
  end if;
  -- Trava o atendimento primeiro: dois Pix do mesmo atendimento, ou Pix e estorno,
  -- passam um de cada vez e cada um enxerga o que o outro gravou.
  if v_tx.appointment_id is not null then
    perform public.lock_appointment(v_tx.appointment_id);
  end if;
  select * into v_tx from public.transactions where id = p_transaction_id for update;
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

-- Estorno (só admin): nada é apagado. Entradas recebidas viram reversed com uma
-- saída igual no caixa aberto; Pix nunca recebido só vira reversed; comissão ainda
-- não paga vira reversed; comissão já paga ganha um abatimento negativo no mês atual.
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

  update public.appointments set refunded_at = now() where id = v_appt.id returning * into v_appt;
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'refunded', jsonb_build_object('reason', trim(p_reason)));
  return v_appt;
end;
$$;

-- Admin marca como pagas as comissões disponíveis do profissional até o mês
-- escolhido, inclusive sobras de meses anteriores (as negativas de estorno entram e
-- abatem, mesmo vindas de outro mês). Saldo ≤ 0: nada muda. Com p_expense_method,
-- lança a despesa, no caixa aberto se houver. Devolve o valor pago.
create or replace function public.pay_commissions(
  p_salon_id uuid,
  p_professional_id uuid,
  p_month date,
  p_expense_method text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_total integer;
  v_name text;
begin
  if public.has_salon_role(p_salon_id, '{admin}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if p_expense_method is not null and p_expense_method not in ('cash', 'debit', 'credit', 'pix') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  -- Trava as linhas antes de somar, para dois cliques não pagarem duas vezes.
  perform 1 from public.commissions
  where salon_id = p_salon_id and professional_id = p_professional_id and reference_month <= v_month and status = 'available'
  for update;
  select coalesce(sum(amount_cents), 0) into v_total
  from public.commissions
  where salon_id = p_salon_id and professional_id = p_professional_id and reference_month <= v_month and status = 'available';
  if v_total <= 0 then
    return 0;
  end if;

  update public.commissions set status = 'paid', paid_at = now()
  where salon_id = p_salon_id and professional_id = p_professional_id and reference_month <= v_month and status = 'available';

  if p_expense_method is not null then
    select name into v_name from public.professionals where id = p_professional_id;
    insert into public.transactions (salon_id, type, category, amount_cents, method, status, paid_at, cash_session_id, description)
    values (p_salon_id, 'expense', 'comissao', v_total, p_expense_method, 'paid', now(),
            public.open_cash_session_id(p_salon_id), left('Comissão ' || v_name || ' ' || to_char(v_month, 'MM/YYYY'), 200));
  end if;
  return v_total;
end;
$$;

revoke execute on function public.pay_commissions(uuid, uuid, date, text) from public, anon;
grant execute on function public.pay_commissions(uuid, uuid, date, text) to authenticated;

revoke execute on function public.refund_appointment(uuid, text) from public, anon;
grant execute on function public.refund_appointment(uuid, text) to authenticated;

revoke execute on function public.receive_payment(uuid, jsonb, integer) from public, anon;
revoke execute on function public.confirm_pix(uuid) from public, anon;
grant execute on function public.receive_payment(uuid, jsonb, integer) to authenticated;
grant execute on function public.confirm_pix(uuid) to authenticated;
