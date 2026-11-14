-- Serviços do salão: nome, duração e preço (centavos). Não são apagados, só
-- desativados, porque atendimentos vão referenciá-los.

create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  duration_minutes integer not null check (duration_minutes between 5 and 480 and duration_minutes % 5 = 0),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- alvo das FKs compostas: filhos nunca apontam para serviço de outro salão
  unique (id, salon_id)
);

create unique index services_salon_name_idx on public.services (salon_id, lower(name));

create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;

create policy "membros veem serviços" on public.services
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin cria serviços" on public.services
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin altera serviços" on public.services
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));
