-- Produtos: viram itens do atendimento (item_type = 'product') e podem ser
-- vendidos sem serviço, na venda no balcão (kind = 'sale': sem horário, sem
-- profissional e com cliente opcional), recebida pelo mesmo receive_payment.

-- Esquema -------------------------------------------------------------------------

alter table public.appointment_items
  drop constraint appointment_items_item_type_check,
  add constraint appointment_items_item_type_check check (item_type in ('service', 'product')),
  alter column service_id drop not null,
  add column inventory_item_id uuid,
  add foreign key (inventory_item_id, salon_id) references public.inventory_items (id, salon_id),
  add check ((item_type = 'service') = (service_id is not null)),
  add check ((item_type = 'product') = (inventory_item_id is not null));

alter table public.appointments
  drop constraint appointments_kind_check,
  add constraint appointments_kind_check check (kind in ('scheduled', 'walk_in', 'sale')),
  -- Em curso/aguardando exige profissional e início, menos na venda no balcão.
  drop constraint appointments_check2,
  add constraint appointments_check2 check (
    kind = 'sale' or status not in ('in_progress', 'awaiting_payment') or (professional_id is not null and starts_at is not null)
  ),
  alter column customer_id drop not null,
  add constraint appointments_customer_check check (kind = 'sale' or customer_id is not null),
  add constraint appointments_sale_check check (kind <> 'sale' or (professional_id is null and starts_at is null));

-- Linha de produto com o preço de venda de agora (snapshot). Valida item ativo,
-- vendável e do salão; a quantidade é inteira ≥ 1.
create or replace function public.insert_product_item(p_appt public.appointments, p_inventory_item_id uuid, p_quantity numeric)
returns public.appointment_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock public.inventory_items;
  v_item public.appointment_items;
begin
  select * into v_stock from public.inventory_items
  where id = p_inventory_item_id and salon_id = p_appt.salon_id and active;
  if not found then
    raise exception 'Item de estoque não encontrado.';
  end if;
  if v_stock.sale_price_cents is null then
    raise exception 'Produto sem preço de venda.';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity <> trunc(p_quantity) or p_quantity > 1000 then
    raise exception 'Quantidade inválida.';
  end if;

  insert into public.appointment_items (salon_id, appointment_id, item_type, inventory_item_id, professional_id, quantity, unit_price_cents, duration_minutes)
  values (p_appt.salon_id, p_appt.id, 'product', v_stock.id, p_appt.professional_id, p_quantity::integer, v_stock.sale_price_cents, 0)
  returning * into v_item;
  return v_item;
end;
$$;

revoke execute on function public.insert_product_item(public.appointments, uuid, numeric) from public, anon, authenticated;

-- RPCs ----------------------------------------------------------------------------

-- Mesma regra de ajustar itens da Fase 4 (lock_adjustable_appointment).
create or replace function public.add_product_item(p_appointment_id uuid, p_inventory_item_id uuid, p_quantity integer default 1)
returns public.appointment_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments := public.lock_adjustable_appointment(p_appointment_id);
  v_item public.appointment_items := public.insert_product_item(v_appt, p_inventory_item_id, p_quantity);
begin
  perform public.recalc_appointment_total(v_appt.id);
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'item_added',
          jsonb_build_object('inventory_item_id', p_inventory_item_id, 'item_id', v_item.id, 'quantity', v_item.quantity));
  return v_item;
end;
$$;

-- Recriada: atendimento continua precisando de um serviço; venda, de um produto.
create or replace function public.remove_appointment_item(p_item_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointment_items;
  v_appt public.appointments;
begin
  select * into v_row from public.appointment_items where id = p_item_id;
  if not found then
    raise exception 'Atendimento não encontrado.';
  end if;
  v_appt := public.lock_adjustable_appointment(v_row.appointment_id);
  -- Item de outro profissional (a comissão é dele): só admin/recepção remove.
  if v_row.professional_id is distinct from v_appt.professional_id
     and public.has_salon_role(v_appt.salon_id, '{admin,reception}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if v_appt.kind = 'sale' then
    if (select count(*) from public.appointment_items where appointment_id = v_appt.id) <= 1 then
      raise exception 'Venda precisa de pelo menos um produto.';
    end if;
  elsif v_row.item_type = 'service'
    and (select count(*) from public.appointment_items where appointment_id = v_appt.id and item_type = 'service') <= 1 then
    raise exception 'Atendimento precisa de pelo menos um serviço.';
  end if;

  delete from public.appointment_items where id = p_item_id;
  v_appt := public.recalc_appointment_total(v_appt.id);
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'item_removed',
          jsonb_strip_nulls(jsonb_build_object('service_id', v_row.service_id, 'inventory_item_id', v_row.inventory_item_id)));
  return v_appt;
end;
$$;

-- Venda no balcão (admin/recepção): nasce aguardando pagamento.
-- p_items: [{"inventory_item_id": "...", "quantity": 2}, ...]
create or replace function public.create_counter_sale(p_salon_id uuid, p_customer_id uuid, p_items jsonb)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_line jsonb;
begin
  if public.has_salon_role(p_salon_id, '{admin,reception}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Venda precisa de pelo menos um produto.';
  end if;
  if p_customer_id is not null
     and not exists (select 1 from public.customers where id = p_customer_id and salon_id = p_salon_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  insert into public.appointments (salon_id, customer_id, kind, status, arrived_at, duration_minutes, total_cents)
  values (p_salon_id, p_customer_id, 'sale', 'awaiting_payment', now(), 1, 0)
  returning * into v_appt;
  for v_line in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_line->'quantity') is distinct from 'number' then
      raise exception 'Quantidade inválida.';
    end if;
    -- Texto que não é uuid vira "não encontrado", não erro de conversão.
    perform public.insert_product_item(
      v_appt,
      case when v_line->>'inventory_item_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then (v_line->>'inventory_item_id')::uuid end,
      (v_line->>'quantity')::numeric
    );
  end loop;

  v_appt := public.recalc_appointment_total(v_appt.id);
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'created', jsonb_build_object('items', p_items));
  return v_appt;
end;
$$;

-- Recebimento recriado: o desconto é repartido entre TODOS os itens (serviços e
-- produtos); a comissão continua só nos serviços, sobre o valor menos a parte dele.
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

  update public.appointments set status = 'paid', discount_cents = p_discount_cents where id = v_appt.id returning * into v_appt;
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'paid', jsonb_build_object('payments', p_payments, 'discount_cents', p_discount_cents));
  return v_appt;
end;
$$;

revoke execute on function public.add_product_item(uuid, uuid, integer) from public, anon;
revoke execute on function public.create_counter_sale(uuid, uuid, jsonb) from public, anon;
grant execute on function public.add_product_item(uuid, uuid, integer) to authenticated;
grant execute on function public.create_counter_sale(uuid, uuid, jsonb) to authenticated;
