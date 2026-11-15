-- Estoque: itens e movimentos. O saldo (quantity) é derivado: só o trigger de
-- stock_movements o altera, então o histórico sempre explica o saldo. Movimentos
-- só por RPC security definer (record_stock_movement e, na Fase 5, dentro do
-- recebimento e do estorno).

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  unit text not null check (unit in ('un', 'ml', 'g')),
  quantity numeric(12, 3) not null default 0,
  min_quantity numeric(12, 3) not null default 0 check (min_quantity >= 0),
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0),
  -- preenchido = item vendável
  sale_price_cents integer check (sale_price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id)
);

create unique index inventory_items_salon_name_idx on public.inventory_items (salon_id, lower(name));

create trigger inventory_items_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  inventory_item_id uuid not null,
  type text not null check (type in ('in', 'out', 'adjust', 'consumption')),
  -- com sinal: entrada positiva, saída e consumo negativos
  quantity numeric(12, 3) not null check (quantity <> 0),
  -- custo do item no momento da saída (para o custo real do atendimento)
  unit_cost_cents integer check (unit_cost_cents >= 0),
  appointment_id uuid,
  appointment_item_id uuid,
  reverses_id uuid,
  reason text check (char_length(reason) <= 200),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, salon_id),
  foreign key (inventory_item_id, salon_id) references public.inventory_items (id, salon_id),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id),
  foreign key (reverses_id, salon_id) references public.stock_movements (id, salon_id),
  check (type <> 'in' or quantity > 0),
  check (type not in ('out', 'consumption') or quantity < 0)
);

create index stock_movements_item_idx on public.stock_movements (inventory_item_id, created_at);
create index stock_movements_appointment_idx on public.stock_movements (appointment_id);

create or replace function public.stock_movements_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inventory_items set quantity = quantity + new.quantity where id = new.inventory_item_id;
  return new;
end;
$$;

revoke execute on function public.stock_movements_apply() from public, anon, authenticated;

create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.stock_movements_apply();

alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;

create policy "membros veem o estoque" on public.inventory_items
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin cria itens de estoque" on public.inventory_items
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin altera itens de estoque" on public.inventory_items
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));
create policy "membros veem movimentos" on public.stock_movements
  for select to authenticated using (public.is_salon_member(salon_id));

-- O saldo fica fora dos grants: só muda pelo trigger.
revoke insert, update on public.inventory_items from authenticated, anon;
grant insert (salon_id, name, unit, min_quantity, unit_cost_cents, sale_price_cents, active),
  update (name, unit, min_quantity, unit_cost_cents, sale_price_cents, active)
  on public.inventory_items to authenticated;
revoke insert, update, delete, truncate on public.stock_movements from authenticated, anon;

-- Movimento manual (admin): entrada e saída recebem a quantidade positiva (o
-- sinal vem do tipo); o ajuste recebe a quantidade CONTADA e grava a diferença.
-- Saída que deixa o saldo negativo é aceita (o alerta aparece na tela).
create or replace function public.record_stock_movement(
  p_item_id uuid,
  p_type text,
  p_quantity numeric,
  p_unit_cost_cents integer default null,
  p_reason text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventory_items;
  v_delta numeric(12, 3);
  v_movement public.stock_movements;
begin
  select * into v_item from public.inventory_items where id = p_item_id for update;
  if not found then
    raise exception 'Item de estoque não encontrado.';
  end if;
  if public.has_salon_role(v_item.salon_id, '{admin}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if not v_item.active then
    raise exception 'Item de estoque não encontrado.';
  end if;
  if p_type is null or p_type not in ('in', 'out', 'adjust') or p_quantity is null
    or (p_unit_cost_cents is not null and p_unit_cost_cents < 0) then
    raise exception 'Quantidade inválida.';
  end if;

  if p_type = 'adjust' then
    if p_quantity < 0 then
      raise exception 'Quantidade inválida.';
    end if;
    v_delta := p_quantity - v_item.quantity;
  elsif p_quantity <= 0 then
    raise exception 'Quantidade inválida.';
  elsif p_type = 'in' then
    v_delta := p_quantity;
  else
    v_delta := -p_quantity;
  end if;
  if v_delta = 0 then
    raise exception 'Quantidade inválida.';
  end if;

  insert into public.stock_movements (salon_id, inventory_item_id, type, quantity, unit_cost_cents, reason)
  values (
    v_item.salon_id, v_item.id, p_type, v_delta,
    case when p_type = 'in' then p_unit_cost_cents else v_item.unit_cost_cents end,
    nullif(btrim(p_reason), '')
  )
  returning * into v_movement;

  if p_type = 'in' and p_unit_cost_cents is not null then
    update public.inventory_items set unit_cost_cents = p_unit_cost_cents where id = v_item.id;
  end if;
  return v_movement;
end;
$$;

revoke execute on function public.record_stock_movement(uuid, text, numeric, integer, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, text, numeric, integer, text) to authenticated;
