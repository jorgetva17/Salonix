-- Consumo de estoque por serviço: cada atendimento do serviço baixa a quantidade
-- configurada do item (a baixa entra no recebimento).

create table public.service_consumables (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  service_id uuid not null,
  inventory_item_id uuid not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, inventory_item_id),
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade,
  foreign key (inventory_item_id, salon_id) references public.inventory_items (id, salon_id) on delete cascade
);

create index service_consumables_item_idx on public.service_consumables (inventory_item_id);

create trigger service_consumables_updated_at before update on public.service_consumables
  for each row execute function public.set_updated_at();

alter table public.service_consumables enable row level security;

create policy "membros veem consumos" on public.service_consumables
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin cria consumos" on public.service_consumables
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin altera consumos" on public.service_consumables
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin remove consumos" on public.service_consumables
  for delete to authenticated using (public.has_salon_role(salon_id, '{admin}'));
