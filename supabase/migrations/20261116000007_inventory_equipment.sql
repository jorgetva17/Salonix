-- Salonix · Fase 5 · Estoque, consumo por serviço, venda de produtos e equipamentos

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  unit text not null default 'un' check (char_length(trim(unit)) between 1 and 12),
  quantity numeric(12, 3) not null default 0, -- cache das movimentações (somente por trigger)
  min_quantity numeric(12, 3) not null default 0 check (min_quantity >= 0),
  sale_price_cents integer check (sale_price_cents is null or sale_price_cents >= 0), -- preenchido = vendável
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id)
);
create index inventory_items_salon_idx on public.inventory_items (salon_id, lower(name));

-- Custo unitário: informação financeira (só admin).
create table public.inventory_item_costs (
  item_id uuid primary key,
  salon_id uuid not null references public.salons (id) on delete cascade,
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0),
  updated_at timestamptz not null default now(),
  foreign key (item_id, salon_id) references public.inventory_items (id, salon_id) on delete cascade
);

create table public.service_consumables (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  service_id uuid not null,
  item_id uuid not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (service_id, item_id),
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade,
  foreign key (item_id, salon_id) references public.inventory_items (id, salon_id) on delete cascade
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  item_id uuid not null,
  type text not null check (type in ('in', 'out', 'adjust', 'consumption')),
  delta numeric(12, 3) not null check (delta <> 0),
  unit_cost_cents integer,
  reason text not null default '',
  appointment_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (item_id, salon_id) references public.inventory_items (id, salon_id) on delete cascade,
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete restrict
);
create index stock_movements_item_idx on public.stock_movements (item_id, created_at desc);
create index stock_movements_appointment_idx on public.stock_movements (appointment_id);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  responsible_id uuid,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id),
  foreign key (responsible_id, salon_id) references public.professionals (id, salon_id) on delete restrict
);

create table public.equipment_maintenance (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  equipment_id uuid not null,
  performed_on date not null default current_date,
  description text not null check (char_length(trim(description)) >= 2),
  next_due_on date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, salon_id),
  foreign key (equipment_id, salon_id) references public.equipment (id, salon_id) on delete cascade,
  check (next_due_on is null or next_due_on >= performed_on)
);
create index equipment_maintenance_equipment_idx on public.equipment_maintenance (equipment_id, performed_on desc);

create table public.equipment_maintenance_costs (
  maintenance_id uuid primary key,
  salon_id uuid not null references public.salons (id) on delete cascade,
  cost_cents integer not null check (cost_cents >= 0),
  foreign key (maintenance_id, salon_id) references public.equipment_maintenance (id, salon_id) on delete cascade
);

create trigger inventory_items_set_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();
create trigger equipment_set_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

alter table public.appointment_items
  add constraint appointment_items_inventory_fk
  foreign key (inventory_item_id, salon_id) references public.inventory_items (id, salon_id);
alter table public.appointment_items
  add constraint appointment_items_product_check check (item_type <> 'product' or inventory_item_id is not null);

-- ---------------------------------------------------------------------------
-- Quantidade só muda por movimentação
-- ---------------------------------------------------------------------------
create function public.guard_inventory_quantity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('salonix.stock_move', true) = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.quantity := 0;
  elsif new.quantity is distinct from old.quantity then
    raise exception 'A quantidade só pode ser alterada por movimentações de estoque';
  end if;
  return new;
end;
$$;
create trigger inventory_items_guard_quantity before insert or update on public.inventory_items
  for each row execute function public.guard_inventory_quantity();

create function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('salonix.stock_move', '1', true);
  update public.inventory_items set quantity = quantity + new.delta where id = new.item_id;
  perform set_config('salonix.stock_move', '0', true);
  return new;
end;
$$;
create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------------------------------------------------------------------------
-- RLS: leitura para membros (sem custos); escrita só do admin
-- ---------------------------------------------------------------------------
alter table public.inventory_items enable row level security;
alter table public.inventory_item_costs enable row level security;
alter table public.service_consumables enable row level security;
alter table public.stock_movements enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_maintenance enable row level security;
alter table public.equipment_maintenance_costs enable row level security;

create policy inventory_items_select on public.inventory_items for select to authenticated using (public.is_salon_member(salon_id));
create policy inventory_items_write on public.inventory_items for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy inventory_item_costs_admin on public.inventory_item_costs for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy service_consumables_select on public.service_consumables for select to authenticated using (public.is_salon_member(salon_id));
create policy service_consumables_write on public.service_consumables for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy equipment_select on public.equipment for select to authenticated using (public.is_salon_member(salon_id));
create policy equipment_write on public.equipment for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));
create policy equipment_maintenance_select on public.equipment_maintenance for select to authenticated using (public.is_salon_member(salon_id));
create policy equipment_maintenance_write on public.equipment_maintenance for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));
create policy equipment_maintenance_costs_admin on public.equipment_maintenance_costs for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

grant select, insert, update, delete on public.inventory_items, public.inventory_item_costs, public.service_consumables,
  public.equipment, public.equipment_maintenance, public.equipment_maintenance_costs to authenticated;
grant select on public.stock_movements to authenticated;
grant all on public.inventory_items, public.inventory_item_costs, public.service_consumables, public.stock_movements,
  public.equipment, public.equipment_maintenance, public.equipment_maintenance_costs to service_role;

-- ---------------------------------------------------------------------------
-- Movimentações
-- ---------------------------------------------------------------------------
create function public._stock_move(p_salon_id uuid, p_item_id uuid, p_type text, p_delta numeric, p_reason text, p_appointment_id uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.stock_movements (salon_id, item_id, type, delta, unit_cost_cents, reason, appointment_id, created_by)
  values (p_salon_id, p_item_id, p_type, p_delta,
    (select c.unit_cost_cents from public.inventory_item_costs c where c.item_id = p_item_id),
    coalesce(p_reason, ''), p_appointment_id, (select auth.uid()));
$$;

-- Entrada (compra), saída (perda/uso) ou contagem (ajuste para o valor contado).
create function public.record_stock_movement(p_item_id uuid, p_type text, p_quantity numeric, p_reason text default '', p_unit_cost_cents integer default null)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventory_items;
  v_delta numeric;
begin
  select * into v_item from public.inventory_items where id = p_item_id for update;
  if not found then raise exception 'Item não encontrado'; end if;
  if not public.has_salon_role(v_item.salon_id, array['admin']::public.salon_role[]) then
    raise exception 'Só o administrador movimenta o estoque' using errcode = '42501';
  end if;
  if p_type not in ('in', 'out', 'adjust') then raise exception 'Tipo de movimentação inválido'; end if;
  if p_quantity is null or (p_type <> 'adjust' and p_quantity <= 0) or (p_type = 'adjust' and p_quantity < 0) then
    raise exception 'Informe uma quantidade válida';
  end if;

  v_delta := case p_type when 'in' then p_quantity when 'out' then -p_quantity else p_quantity - v_item.quantity end;
  if v_delta = 0 then raise exception 'A contagem é igual ao estoque atual'; end if;

  if p_type = 'in' and p_unit_cost_cents is not null then
    if p_unit_cost_cents < 0 then raise exception 'Custo inválido'; end if;
    insert into public.inventory_item_costs (item_id, salon_id, unit_cost_cents)
    values (v_item.id, v_item.salon_id, p_unit_cost_cents)
    on conflict (item_id) do update set unit_cost_cents = excluded.unit_cost_cents, updated_at = now();
  end if;

  perform public._stock_move(v_item.salon_id, v_item.id, p_type, v_delta, p_reason);
  select * into v_item from public.inventory_items where id = p_item_id;
  return v_item;
end;
$$;

-- ---------------------------------------------------------------------------
-- Produtos nos atendimentos e venda de balcão
-- ---------------------------------------------------------------------------
create function public.add_product_item(p_appointment_id uuid, p_inventory_item_id uuid, p_quantity integer default 1)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_item public.inventory_items;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Atendimento não encontrado'; end if;
  if not public._can_serve(v_appt.salon_id, v_appt.professional_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_appt.status not in ('in_progress', 'awaiting_payment') then
    raise exception 'Só é possível alterar itens de atendimentos em andamento ou aguardando pagamento';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then raise exception 'Quantidade inválida'; end if;
  select * into v_item from public.inventory_items i where i.id = p_inventory_item_id and i.salon_id = v_appt.salon_id and i.active;
  if not found then raise exception 'Produto não encontrado ou inativo'; end if;
  if v_item.sale_price_cents is null then raise exception 'Este item não está à venda'; end if;

  insert into public.appointment_items (appointment_id, salon_id, item_type, inventory_item_id, description, quantity, unit_price_cents, duration_minutes)
  values (v_appt.id, v_appt.salon_id, 'product', v_item.id, v_item.name, p_quantity, v_item.sale_price_cents, 0);
  perform public._recalc_total(v_appt.id);
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'item_added',
    jsonb_build_object('inventory_item_id', v_item.id, 'quantity', p_quantity, 'price_cents', v_item.sale_price_cents));
  select * into v_appt from public.appointments where id = v_appt.id;
  return v_appt;
end;
$$;

create function public.create_counter_sale(p_salon_id uuid, p_customer_id uuid, p_guest_name text, p_inventory_item_id uuid, p_quantity integer)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventory_items;
  v_appt public.appointments;
begin
  if (select auth.uid()) is null then raise exception 'Não autenticado' using errcode = '28000'; end if;
  if not public.has_salon_role(p_salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão para vender no balcão' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then raise exception 'Quantidade inválida'; end if;
  select * into v_item from public.inventory_items i where i.id = p_inventory_item_id and i.salon_id = p_salon_id and i.active;
  if not found then raise exception 'Produto não encontrado ou inativo'; end if;
  if v_item.sale_price_cents is null then raise exception 'Este item não está à venda'; end if;
  if p_customer_id is not null and not exists (select 1 from public.customers c where c.id = p_customer_id and c.salon_id = p_salon_id) then
    raise exception 'Cliente não encontrado';
  end if;

  insert into public.appointments (salon_id, customer_id, guest_name, kind, status, arrived_at, total_cents, created_by)
  values (p_salon_id, p_customer_id, case when p_customer_id is null then coalesce(nullif(trim(p_guest_name), ''), 'Venda no balcão') end,
    'walk_in', 'awaiting_payment', clock_timestamp(), v_item.sale_price_cents * p_quantity, (select auth.uid()))
  returning * into v_appt;
  insert into public.appointment_items (appointment_id, salon_id, item_type, inventory_item_id, description, quantity, unit_price_cents, duration_minutes)
  values (v_appt.id, p_salon_id, 'product', v_item.id, v_item.name, p_quantity, v_item.sale_price_cents, 0);
  perform public._log_appointment_event(v_appt.id, p_salon_id, 'created', jsonb_build_object('kind', 'counter_sale'));
  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- receive_payment: agora também dá baixa no estoque (mesma transação)
-- ---------------------------------------------------------------------------
create or replace function public.receive_payment(p_appointment_id uuid, p_payments jsonb, p_discount_cents integer default 0)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_session public.cash_sessions;
  v_due integer;
  v_sum integer := 0;
  v_discount integer := coalesce(p_discount_cents, 0);
  v_pay jsonb;
  v_method text;
  v_amount integer;
  v_has_pix boolean := false;
  v_item record;
  v_cons record;
  v_pct numeric;
  v_prof uuid;
  v_amt integer;
  v_month date;
  v_tz text;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Atendimento não encontrado'; end if;
  if not public.has_salon_role(v_appt.salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão para receber pagamentos' using errcode = '42501';
  end if;
  if v_appt.status <> 'awaiting_payment' then
    raise exception 'Só é possível receber atendimentos concluídos e ainda não pagos';
  end if;
  select * into v_session from public.cash_sessions c where c.salon_id = v_appt.salon_id and c.closed_at is null;
  if not found then raise exception 'Abra o caixa antes de receber'; end if;
  if v_discount < 0 or v_discount > v_appt.total_cents then raise exception 'Desconto inválido'; end if;
  v_due := v_appt.total_cents - v_discount;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then raise exception 'Informe as formas de pagamento'; end if;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    v_method := v_pay ->> 'method';
    v_amount := (v_pay ->> 'amount_cents')::integer;
    if v_method not in ('cash', 'debit', 'credit', 'pix') or v_amount is null or v_amount <= 0 then
      raise exception 'Pagamento inválido';
    end if;
    v_sum := v_sum + v_amount;
    if v_method = 'pix' then v_has_pix := true; end if;
  end loop;
  if v_sum <> v_due then
    raise exception 'A soma dos pagamentos deve ser igual ao valor a receber';
  end if;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    insert into public.transactions (salon_id, type, category, description, amount_cents, payment_method, status, paid_at, appointment_id, cash_session_id, created_by)
    values (v_appt.salon_id, 'income', 'service', 'Atendimento', (v_pay ->> 'amount_cents')::integer, (v_pay ->> 'method')::public.payment_method,
      case when v_pay ->> 'method' = 'pix' then 'pending' else 'paid' end,
      case when v_pay ->> 'method' = 'pix' then null else now() end,
      v_appt.id, v_session.id, (select auth.uid()));
  end loop;

  update public.appointments set status = 'paid', discount_cents = v_discount where id = v_appt.id returning * into v_appt;

  select s.timezone into v_tz from public.salons s where s.id = v_appt.salon_id;
  v_month := date_trunc('month', now() at time zone v_tz)::date;
  for v_item in select * from public.appointment_items i where i.appointment_id = v_appt.id loop
    if v_item.item_type = 'service' then
      -- comissão
      v_prof := coalesce(v_item.professional_id, v_appt.professional_id);
      if v_prof is not null then
        select coalesce(
          (select c.commission_percent from public.professional_service_commissions c where c.professional_id = v_prof and c.service_id = v_item.service_id),
          (select d.commission_percent from public.professional_default_commissions d where d.professional_id = v_prof),
          0) into v_pct;
        v_amt := round(v_item.unit_price_cents * v_item.quantity * v_pct / 100.0)::integer;
        if v_amt > 0 then
          insert into public.commissions (salon_id, appointment_id, item_id, professional_id, base_cents, percent, amount_cents, reference_month, status)
          values (v_appt.salon_id, v_appt.id, v_item.id, v_prof, v_item.unit_price_cents * v_item.quantity, v_pct, v_amt, v_month,
            case when v_has_pix then 'blocked' else 'available' end);
        end if;
      end if;
      -- baixa dos materiais consumidos pelo serviço
      for v_cons in select c.item_id, c.quantity from public.service_consumables c where c.service_id = v_item.service_id and c.salon_id = v_appt.salon_id loop
        perform public._stock_move(v_appt.salon_id, v_cons.item_id, 'consumption', -(v_cons.quantity * v_item.quantity), 'Consumo de serviço', v_appt.id);
      end loop;
    elsif v_item.item_type = 'product' then
      perform public._stock_move(v_appt.salon_id, v_item.inventory_item_id, 'out', -v_item.quantity, 'Venda de produto', v_appt.id);
    end if;
  end loop;

  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'paid',
    jsonb_build_object('payments', p_payments, 'discount_cents', v_discount, 'total_cents', v_appt.total_cents));
  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- reverse_appointment: também devolve o estoque
-- ---------------------------------------------------------------------------
create or replace function public.reverse_appointment(p_appointment_id uuid, p_reason text default '')
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_session public.cash_sessions;
  v_tx public.transactions;
  v_paid_commission integer;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Atendimento não encontrado'; end if;
  if not public.has_salon_role(v_appt.salon_id, array['admin']::public.salon_role[]) then
    raise exception 'Só o administrador pode estornar' using errcode = '42501';
  end if;
  if v_appt.status <> 'paid' then raise exception 'Só é possível estornar atendimentos pagos'; end if;
  select * into v_session from public.cash_sessions c where c.salon_id = v_appt.salon_id and c.closed_at is null;
  if not found then raise exception 'Abra o caixa antes de estornar'; end if;

  for v_tx in
    select * from public.transactions t
    where t.appointment_id = v_appt.id and t.type = 'income' and t.status in ('paid', 'pending') for update
  loop
    update public.transactions set status = 'reversed' where id = v_tx.id;
    if v_tx.status = 'paid' then
      insert into public.transactions (salon_id, type, category, description, amount_cents, payment_method, status, paid_at, appointment_id, cash_session_id, reverses_id, created_by)
      values (v_tx.salon_id, 'expense', 'refund', 'Estorno de atendimento', v_tx.amount_cents, v_tx.payment_method, 'paid', now(),
        v_appt.id, v_session.id, v_tx.id, (select auth.uid()));
    end if;
  end loop;

  select coalesce(sum(c.amount_cents), 0) into v_paid_commission
  from public.commissions c where c.appointment_id = v_appt.id and c.status = 'paid';
  update public.commissions set status = 'reversed' where appointment_id = v_appt.id and status <> 'reversed';

  -- devolve ao estoque o que foi baixado no recebimento
  insert into public.stock_movements (salon_id, item_id, type, delta, unit_cost_cents, reason, appointment_id, created_by)
  select m.salon_id, m.item_id, 'in', -m.delta, m.unit_cost_cents, 'Estorno de atendimento', m.appointment_id, (select auth.uid())
  from public.stock_movements m
  where m.appointment_id = v_appt.id and m.type in ('consumption', 'out');

  update public.appointments set status = 'cancelled' where id = v_appt.id returning * into v_appt;
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'reversed',
    jsonb_build_object('reason', coalesce(p_reason, ''), 'commission_already_paid_cents', v_paid_commission));
  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------
revoke all on function public._stock_move(uuid, uuid, text, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.record_stock_movement(uuid, text, numeric, text, integer) from public, anon;
revoke all on function public.add_product_item(uuid, uuid, integer) from public, anon;
revoke all on function public.create_counter_sale(uuid, uuid, text, uuid, integer) from public, anon;
grant execute on function public.record_stock_movement(uuid, text, numeric, text, integer) to authenticated, service_role;
grant execute on function public.add_product_item(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.create_counter_sale(uuid, uuid, text, uuid, integer) to authenticated, service_role;
