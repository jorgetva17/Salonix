-- Clientes do salão. Telefone (WhatsApp) só com dígitos: DDD + número.

-- Imutável para poder alimentar coluna gerada; o dicionário é passado explicitamente
-- para não depender do search_path.
create or replace function public.search_normalize(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_text));
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  phone text check (phone ~ '^\d{10,11}$'),
  notes text check (char_length(notes) <= 500),
  name_search text generated always as (public.search_normalize(name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id)
);

create unique index customers_salon_phone_idx on public.customers (salon_id, phone) where phone is not null;
create index customers_salon_name_idx on public.customers (salon_id, name_search);

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

create policy "membros veem clientes" on public.customers
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin e recepção criam clientes" on public.customers
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin,reception}'));
create policy "admin e recepção alteram clientes" on public.customers
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin,reception}'))
  with check (public.has_salon_role(salon_id, '{admin,reception}'));
create policy "admin remove clientes" on public.customers
  for delete to authenticated using (public.has_salon_role(salon_id, '{admin}'));
