-- Salonix · Fase 2 · Cadastros: serviços, profissionais, jornada, bloqueios, comissões, clientes

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id)
);
create index services_salon_idx on public.services (salon_id);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(trim(name)) >= 2),
  color text not null default '#1B3B4B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id)
);
create index professionals_salon_idx on public.professionals (salon_id);
-- Um login só pode ser um profissional por salão.
create unique index professionals_user_unique on public.professionals (salon_id, user_id) where user_id is not null;

create table public.professional_schedules (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  professional_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);
create index professional_schedules_prof_idx on public.professional_schedules (professional_id);

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);
create index schedule_blocks_prof_idx on public.schedule_blocks (professional_id, starts_at);

-- Comissão padrão em tabela própria: percentuais são sensíveis (só admin e o próprio profissional).
create table public.professional_default_commissions (
  professional_id uuid primary key,
  salon_id uuid not null references public.salons (id) on delete cascade,
  commission_percent numeric(5, 2) not null check (commission_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);

create table public.professional_service_commissions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  professional_id uuid not null,
  service_id uuid not null,
  commission_percent numeric(5, 2) not null check (commission_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, service_id),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  phone text check (phone is null or phone ~ '^[0-9]{10,13}$'), -- só dígitos (WhatsApp)
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id)
);
create index customers_salon_name_idx on public.customers (salon_id, lower(name));

do $$
declare t text;
begin
  foreach t in array array['services','professionals','professional_schedules','schedule_blocks','professional_service_commissions','professional_default_commissions','customers']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Policies: leitura para membros; escrita conforme o perfil
-- ---------------------------------------------------------------------------
create policy services_select on public.services for select to authenticated
  using (public.is_salon_member(salon_id));
create policy services_write on public.services for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy professionals_select on public.professionals for select to authenticated
  using (public.is_salon_member(salon_id));
create policy professionals_write on public.professionals for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy professional_schedules_select on public.professional_schedules for select to authenticated
  using (public.is_salon_member(salon_id));
create policy professional_schedules_write on public.professional_schedules for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy schedule_blocks_select on public.schedule_blocks for select to authenticated
  using (public.is_salon_member(salon_id));
create policy schedule_blocks_write on public.schedule_blocks for all to authenticated
  using (public.has_salon_role(salon_id, array['admin', 'reception']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin', 'reception']::public.salon_role[]));

-- Comissões são sensíveis: só o admin e o próprio profissional enxergam.
create policy commissions_select on public.professional_service_commissions for select to authenticated
  using (
    public.has_salon_role(salon_id, array['admin']::public.salon_role[])
    or exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.user_id = (select auth.uid())
    )
  );
create policy commissions_write on public.professional_service_commissions for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy default_commissions_select on public.professional_default_commissions for select to authenticated
  using (
    public.has_salon_role(salon_id, array['admin']::public.salon_role[])
    or exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.user_id = (select auth.uid())
    )
  );
create policy default_commissions_write on public.professional_default_commissions for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

create policy customers_select on public.customers for select to authenticated
  using (public.is_salon_member(salon_id));
create policy customers_write on public.customers for all to authenticated
  using (public.has_salon_role(salon_id, array['admin', 'reception']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin', 'reception']::public.salon_role[]));

grant select, insert, update, delete on
  public.services, public.professionals, public.professional_schedules, public.schedule_blocks,
  public.professional_service_commissions, public.professional_default_commissions, public.customers to authenticated;
grant all on
  public.services, public.professionals, public.professional_schedules, public.schedule_blocks,
  public.professional_service_commissions, public.professional_default_commissions, public.customers to service_role;

-- ---------------------------------------------------------------------------
-- Convite vinculado a profissional existente (spec §12)
-- ---------------------------------------------------------------------------
alter table public.salon_invites add column professional_id uuid;
alter table public.salon_invites
  add constraint salon_invites_professional_fk
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete set null (professional_id);

create or replace function public.accept_invite(p_invite_id uuid)
returns public.salon_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.salon_invites;
  v_member public.salon_members;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  select i.* into v_invite
  from public.salon_invites i
  join auth.users u on u.id = v_uid
  where i.id = p_invite_id
    and i.status = 'pending'
    and lower(i.email::text) = lower(u.email)
  for update of i;

  if not found then
    raise exception 'Convite inválido ou expirado';
  end if;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  insert into public.salon_members (salon_id, user_id, role, active)
  values (v_invite.salon_id, v_uid, v_invite.role, true)
  on conflict (salon_id, user_id)
  do update set role = excluded.role, active = true
  returning * into v_member;

  if v_invite.professional_id is not null then
    update public.professionals
    set user_id = v_uid
    where id = v_invite.professional_id
      and salon_id = v_invite.salon_id
      and user_id is null;
  end if;

  update public.salon_invites
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  return v_member;
end;
$$;
