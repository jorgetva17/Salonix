-- Equipamentos e histórico de manutenção. Cadastro simples: leitura para todo
-- membro, escrita do admin por policy. A manutenção não lança despesa (Fase 6).

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  -- responsável
  professional_id uuid,
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id)
);

create trigger equipment_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

create table public.equipment_maintenance (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  equipment_id uuid not null,
  performed_on date not null,
  description text not null check (char_length(description) between 2 and 300),
  cost_cents integer not null default 0 check (cost_cents >= 0),
  next_due date check (next_due is null or next_due >= performed_on),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (equipment_id, salon_id) references public.equipment (id, salon_id) on delete cascade
);

create index equipment_maintenance_equipment_idx on public.equipment_maintenance (equipment_id, performed_on);

alter table public.equipment enable row level security;
alter table public.equipment_maintenance enable row level security;

create policy "membros veem equipamentos" on public.equipment
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin cria equipamentos" on public.equipment
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin altera equipamentos" on public.equipment
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin remove equipamentos" on public.equipment
  for delete to authenticated using (public.has_salon_role(salon_id, '{admin}'));

create policy "membros veem manutenções" on public.equipment_maintenance
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin registra manutenções" on public.equipment_maintenance
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin altera manutenções" on public.equipment_maintenance
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin remove manutenções" on public.equipment_maintenance
  for delete to authenticated using (public.has_salon_role(salon_id, '{admin}'));
