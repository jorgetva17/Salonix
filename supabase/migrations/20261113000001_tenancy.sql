-- Salonix: base multi-tenant (salões, perfis, membros) com RLS por salão.

create extension if not exists unaccent with schema extensions;

create type public.salon_role as enum ('admin', 'reception', 'professional');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Salões -------------------------------------------------------------------

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  phone text,
  logo_light_path text,
  logo_dark_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger salons_updated_at before update on public.salons
  for each row execute function public.set_updated_at();

-- Perfis ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Membros --------------------------------------------------------------------

create table public.salon_members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.salon_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, user_id)
);

create index salon_members_user_idx on public.salon_members (user_id);

create trigger salon_members_updated_at before update on public.salon_members
  for each row execute function public.set_updated_at();

-- Flags de funcionalidades futuras (desligadas no MVP) ----------------------

create table public.feature_flags (
  salon_id uuid primary key references public.salons (id) on delete cascade,
  card_reconciliation boolean not null default false,
  pix_webhook boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger feature_flags_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- Funções de autorização ----------------------------------------------------
-- security definer: leem salon_members sem passar pelo RLS (evita recursão).

create or replace function public.is_salon_member(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id and user_id = auth.uid() and active
  );
$$;

create or replace function public.has_salon_role(p_salon_id uuid, p_roles public.salon_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id and user_id = auth.uid() and active and role = any (p_roles)
  );
$$;

create or replace function public.shares_salon_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.salon_members mine
    join public.salon_members theirs on theirs.salon_id = mine.salon_id
    where mine.user_id = auth.uid() and mine.active and theirs.user_id = p_user_id
  );
$$;

-- Garante pelo menos um admin ativo por salão --------------------------------

create or replace function public.ensure_salon_has_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active)
     and exists (select 1 from public.salons where id = old.salon_id)
     and not exists (
       select 1 from public.salon_members
       where salon_id = old.salon_id and id <> old.id and role = 'admin' and active
     ) then
    raise exception 'O salão precisa de pelo menos um administrador ativo.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger salon_members_keep_admin before update or delete on public.salon_members
  for each row execute function public.ensure_salon_has_admin();

-- Criação de salão ----------------------------------------------------------

create or replace function public.slugify(p_text text)
returns text
language sql
stable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(p_text)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.create_salon(p_name text, p_phone text default null)
returns public.salons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_base text;
  v_slug text;
  v_n int := 1;
  v_salon public.salons;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para criar um salão.' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) < 2 then
    raise exception 'Informe o nome do salão.' using errcode = '22023';
  end if;

  v_base := coalesce(nullif(public.slugify(p_name), ''), 'salao');
  v_slug := v_base;
  while exists (select 1 from public.salons where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.salons (name, slug, phone)
  values (trim(p_name), v_slug, p_phone)
  returning * into v_salon;

  insert into public.salon_members (salon_id, user_id, role) values (v_salon.id, v_user, 'admin');
  insert into public.feature_flags (salon_id) values (v_salon.id);

  return v_salon;
end;
$$;

revoke execute on function public.create_salon(text, text) from public, anon;
grant execute on function public.create_salon(text, text) to authenticated;

-- RLS -----------------------------------------------------------------------

alter table public.salons enable row level security;
alter table public.profiles enable row level security;
alter table public.salon_members enable row level security;
alter table public.feature_flags enable row level security;

create policy "membros veem o salão" on public.salons
  for select to authenticated using (public.is_salon_member(id));
create policy "admin altera o salão" on public.salons
  for update to authenticated
  using (public.has_salon_role(id, '{admin}'))
  with check (public.has_salon_role(id, '{admin}'));

create policy "ver o próprio perfil e de colegas" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_salon_with(id));
create policy "alterar o próprio perfil" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "membros veem a equipe" on public.salon_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_salon_member(salon_id));
create policy "admin adiciona membros" on public.salon_members
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin altera membros" on public.salon_members
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin remove membros" on public.salon_members
  for delete to authenticated using (public.has_salon_role(salon_id, '{admin}'));

create policy "membros veem flags" on public.feature_flags
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin altera flags" on public.feature_flags
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));
