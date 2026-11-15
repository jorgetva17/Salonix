-- Salonix · Fase 1 · Tenancy multi-salão com RLS
-- Isolamento por salon_id; funções auxiliares is_salon_member / has_salon_role.

create extension if not exists unaccent with schema extensions;

create type public.salon_role as enum ('admin', 'reception', 'professional');

-- ---------------------------------------------------------------------------
-- Utilitário: updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  phone text,
  logo_light_path text,
  logo_dark_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
create index salon_members_user_id_idx on public.salon_members (user_id);

create table public.feature_flags (
  salon_id uuid primary key references public.salons (id) on delete cascade,
  card_reconciliation boolean not null default false,
  pix_webhook boolean not null default false
);

create trigger salons_set_updated_at before update on public.salons
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger salon_members_set_updated_at before update on public.salon_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funções auxiliares de autorização (security definer: evitam recursão de RLS)
-- ---------------------------------------------------------------------------
create function public.is_salon_member(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.salon_members m
    where m.salon_id = p_salon_id
      and m.user_id = (select auth.uid())
      and m.active
  );
$$;

create function public.has_salon_role(p_salon_id uuid, p_roles public.salon_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.salon_members m
    where m.salon_id = p_salon_id
      and m.user_id = (select auth.uid())
      and m.active
      and m.role = any (p_roles)
  );
$$;

create function public.shares_salon_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.salon_members me
    join public.salon_members other on other.salon_id = me.salon_id
    where me.user_id = (select auth.uid())
      and me.active
      and other.user_id = p_user_id
      and other.active
  );
$$;

-- ---------------------------------------------------------------------------
-- Perfil automático ao criar usuário
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Nunca deixar um salão sem admin ativo
-- ---------------------------------------------------------------------------
create function public.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active)
     and exists (select 1 from public.salons s where s.id = old.salon_id)
     and not exists (
       select 1 from public.salon_members m
       where m.salon_id = old.salon_id
         and m.id <> old.id
         and m.role = 'admin'
         and m.active
     )
  then
    raise exception 'O salão precisa ter pelo menos um administrador ativo';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger salon_members_guard_last_admin
  before update or delete on public.salon_members
  for each row execute function public.guard_last_admin();

-- ---------------------------------------------------------------------------
-- RPC: criar salão (+ vínculo admin + feature flags), com slug único
-- ---------------------------------------------------------------------------
create function public.create_salon(p_name text, p_phone text default null)
returns public.salons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_base text;
  v_slug text;
  v_n integer := 1;
  v_salon public.salons;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Informe o nome do salão';
  end if;

  perform pg_advisory_xact_lock(hashtext('salonix.create_salon'));

  v_base := trim(both '-' from regexp_replace(
    lower(extensions.unaccent(trim(p_name))), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then
    v_base := 'salao';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.salons s where s.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  insert into public.salons (name, slug, phone)
  values (trim(p_name), v_slug, nullif(trim(coalesce(p_phone, '')), ''))
  returning * into v_salon;

  insert into public.salon_members (salon_id, user_id, role)
  values (v_salon.id, v_uid, 'admin');

  insert into public.feature_flags (salon_id) values (v_salon.id);

  return v_salon;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.salons enable row level security;
alter table public.profiles enable row level security;
alter table public.salon_members enable row level security;
alter table public.feature_flags enable row level security;

create policy salons_select on public.salons
  for select to authenticated
  using (public.is_salon_member(id));
create policy salons_update on public.salons
  for update to authenticated
  using (public.has_salon_role(id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(id, array['admin']::public.salon_role[]));

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_salon_with(id));
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy salon_members_select on public.salon_members
  for select to authenticated
  using (public.is_salon_member(salon_id) or user_id = (select auth.uid()));
create policy salon_members_insert on public.salon_members
  for insert to authenticated
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));
create policy salon_members_update on public.salon_members
  for update to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));
create policy salon_members_delete on public.salon_members
  for delete to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy feature_flags_select on public.feature_flags
  for select to authenticated
  using (public.is_salon_member(salon_id));
create policy feature_flags_update on public.feature_flags
  for update to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos; RLS faz o filtro fino)
-- ---------------------------------------------------------------------------
grant select, update on public.salons to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.salon_members to authenticated;
grant select, update on public.feature_flags to authenticated;
grant all on public.salons, public.profiles, public.salon_members,
  public.feature_flags to service_role;

revoke all on function public.is_salon_member(uuid) from public, anon;
revoke all on function public.has_salon_role(uuid, public.salon_role[]) from public, anon;
revoke all on function public.shares_salon_with(uuid) from public, anon;
revoke all on function public.create_salon(text, text) from public, anon;
grant execute on function public.is_salon_member(uuid) to authenticated, service_role;
grant execute on function public.has_salon_role(uuid, public.salon_role[]) to authenticated, service_role;
grant execute on function public.shares_salon_with(uuid) to authenticated, service_role;
grant execute on function public.create_salon(text, text) to authenticated, service_role;
