-- Salonix · Fase 3 · Agenda e fila de walk-in

create extension if not exists btree_gist with schema extensions;

create type public.appointment_kind as enum ('scheduled', 'walk_in');
create type public.appointment_status as enum
  ('scheduled', 'waiting', 'in_progress', 'awaiting_payment', 'paid', 'cancelled', 'no_show');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid,
  guest_name text,
  professional_id uuid,
  kind public.appointment_kind not null,
  status public.appointment_status not null default 'scheduled',
  starts_at timestamptz,
  ends_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  notes text not null default '',
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id),
  foreign key (customer_id, salon_id) references public.customers (id, salon_id) on delete restrict,
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete restrict,
  check (customer_id is not null or char_length(trim(coalesce(guest_name, ''))) > 0),
  check (kind <> 'scheduled' or (starts_at is not null and ends_at is not null and professional_id is not null)),
  check (kind <> 'walk_in' or arrived_at is not null),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint appointments_no_overlap exclude using gist (
    professional_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (
    professional_id is not null and starts_at is not null and ends_at is not null
    and status not in ('cancelled', 'no_show')
  )
);
create index appointments_day_idx on public.appointments (salon_id, starts_at);
create index appointments_queue_idx on public.appointments (salon_id, status, arrived_at);
create index appointments_professional_idx on public.appointments (professional_id, starts_at);

create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid not null,
  item_type text not null default 'service' check (item_type in ('service', 'product')),
  service_id uuid,
  inventory_item_id uuid, -- FK entra na Fase 5 (estoque)
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  professional_id uuid,
  created_at timestamptz not null default now(),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id),
  check (item_type <> 'service' or service_id is not null)
);
create index appointment_items_appointment_idx on public.appointment_items (appointment_id);

create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid not null,
  event_type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete cascade
);
create index appointment_events_appointment_idx on public.appointment_events (appointment_id, created_at);

create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;
alter table public.appointment_events enable row level security;

-- ---------------------------------------------------------------------------
-- Autorização
-- ---------------------------------------------------------------------------
create function public.my_professional_id(p_salon_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.professionals p
  where p.salon_id = p_salon_id
    and p.user_id = (select auth.uid())
    and public.is_salon_member(p_salon_id)
  limit 1;
$$;

-- Admin/recepção veem tudo; profissional vê a própria agenda e a fila sem dono.
create policy appointments_select on public.appointments for select to authenticated
  using (
    public.has_salon_role(salon_id, array['admin', 'reception']::public.salon_role[])
    or (
      public.is_salon_member(salon_id)
      and (
        professional_id = public.my_professional_id(salon_id)
        or (kind = 'walk_in' and status = 'waiting' and professional_id is null)
      )
    )
  );
create policy appointment_items_select on public.appointment_items for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_items.appointment_id and a.salon_id = appointment_items.salon_id));
create policy appointment_events_select on public.appointment_events for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_events.appointment_id and a.salon_id = appointment_events.salon_id));

grant select on public.appointments, public.appointment_items, public.appointment_events to authenticated;
grant all on public.appointments, public.appointment_items, public.appointment_events to service_role;

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------
create function public._log_appointment_event(p_appointment_id uuid, p_salon_id uuid, p_type text, p_data jsonb default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.appointment_events (appointment_id, salon_id, event_type, actor_id, data)
  values (p_appointment_id, p_salon_id, p_type, (select auth.uid()), p_data);
$$;

-- Valida jornada e bloqueios (conflito com outros atendimentos é da exclusion constraint).
create function public._validate_slot(p_salon_id uuid, p_professional_id uuid, p_starts timestamptz, p_ends timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  if p_starts < now() - interval '5 minutes' then
    raise exception 'Não é possível agendar no passado';
  end if;
  select s.timezone into v_tz from public.salons s where s.id = p_salon_id;
  v_local_start := p_starts at time zone v_tz;
  v_local_end := p_ends at time zone v_tz;
  if v_local_start::date <> v_local_end::date then
    raise exception 'O atendimento não pode atravessar a meia-noite';
  end if;
  if not exists (
    select 1 from public.professional_schedules ps
    where ps.salon_id = p_salon_id
      and ps.professional_id = p_professional_id
      and ps.weekday = extract(dow from v_local_start)::int
      and ps.start_time <= v_local_start::time
      and ps.end_time >= v_local_end::time
  ) then
    raise exception 'Fora da jornada do profissional';
  end if;
  if exists (
    select 1 from public.schedule_blocks b
    where b.professional_id = p_professional_id
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_starts, p_ends)
  ) then
    raise exception 'Profissional com bloqueio nesse horário';
  end if;
end;
$$;

-- Insere cabeçalho + itens a partir dos serviços; devolve o atendimento.
create function public._build_appointment(
  p_salon_id uuid,
  p_customer_id uuid,
  p_guest_name text,
  p_professional_id uuid,
  p_service_ids uuid[],
  p_kind public.appointment_kind,
  p_starts timestamptz,
  p_notes text
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_found integer;
  v_minutes integer;
  v_total integer;
  v_appt public.appointments;
begin
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_service_ids, '{}')) x;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Escolha pelo menos um serviço';
  end if;
  if p_customer_id is null and char_length(trim(coalesce(p_guest_name, ''))) = 0 then
    raise exception 'Informe o cliente';
  end if;
  if p_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = p_customer_id and c.salon_id = p_salon_id
  ) then
    raise exception 'Cliente não encontrado';
  end if;
  if p_professional_id is not null and not exists (
    select 1 from public.professionals p where p.id = p_professional_id and p.salon_id = p_salon_id and p.active
  ) then
    raise exception 'Profissional não encontrado ou inativo';
  end if;

  select count(*), coalesce(sum(s.duration_minutes), 0), coalesce(sum(s.price_cents), 0)
    into v_found, v_minutes, v_total
  from public.services s
  where s.salon_id = p_salon_id and s.active and s.id = any (v_ids);
  if v_found <> array_length(v_ids, 1) then
    raise exception 'Serviço não encontrado ou inativo';
  end if;

  if p_kind = 'scheduled' then
    perform public._validate_slot(p_salon_id, p_professional_id, p_starts, p_starts + make_interval(mins => v_minutes));
  end if;

  begin
    insert into public.appointments (
      salon_id, customer_id, guest_name, professional_id, kind, status,
      starts_at, ends_at, arrived_at, notes, total_cents, created_by
    ) values (
      p_salon_id, p_customer_id, nullif(trim(coalesce(p_guest_name, '')), ''), p_professional_id, p_kind,
      case when p_kind = 'scheduled' then 'scheduled' else 'waiting' end::public.appointment_status,
      case when p_kind = 'scheduled' then p_starts end,
      case when p_kind = 'scheduled' then p_starts + make_interval(mins => v_minutes) end,
      case when p_kind = 'walk_in' then clock_timestamp() end,
      coalesce(p_notes, ''), v_total, (select auth.uid())
    ) returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'Horário indisponível: já existe outro atendimento nesse período';
  end;

  insert into public.appointment_items (appointment_id, salon_id, item_type, service_id, description, quantity, unit_price_cents, duration_minutes, professional_id)
  select v_appt.id, p_salon_id, 'service', s.id, s.name, 1, s.price_cents, s.duration_minutes, p_professional_id
  from public.services s
  where s.salon_id = p_salon_id and s.id = any (v_ids);

  perform public._log_appointment_event(v_appt.id, p_salon_id, 'created',
    jsonb_build_object('kind', p_kind, 'starts_at', v_appt.starts_at, 'professional_id', p_professional_id));
  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs públicas
-- ---------------------------------------------------------------------------
create function public.create_appointment(
  p_salon_id uuid, p_customer_id uuid, p_guest_name text, p_professional_id uuid,
  p_starts_at timestamptz, p_service_ids uuid[], p_notes text default ''
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if not public.has_salon_role(p_salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão para agendar' using errcode = '42501';
  end if;
  if p_professional_id is null or p_starts_at is null then
    raise exception 'Informe o profissional e o horário';
  end if;
  return public._build_appointment(p_salon_id, p_customer_id, p_guest_name, p_professional_id, p_service_ids, 'scheduled', p_starts_at, p_notes);
end;
$$;

create function public.enqueue_walk_in(
  p_salon_id uuid, p_customer_id uuid, p_guest_name text, p_professional_id uuid, p_service_ids uuid[]
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if not public.has_salon_role(p_salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão para registrar cliente na fila' using errcode = '42501';
  end if;
  return public._build_appointment(p_salon_id, p_customer_id, p_guest_name, p_professional_id, p_service_ids, 'walk_in', null, '');
end;
$$;

create function public.reschedule_appointment(p_appointment_id uuid, p_starts_at timestamptz, p_professional_id uuid default null)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_old public.appointments;
  v_minutes integer;
  v_prof uuid;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Agendamento não encontrado';
  end if;
  if not public.has_salon_role(v_appt.salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão para reagendar' using errcode = '42501';
  end if;
  if v_appt.status <> 'scheduled' or v_appt.kind <> 'scheduled' then
    raise exception 'Só é possível reagendar atendimentos agendados e ainda não iniciados';
  end if;
  v_old := v_appt;
  v_prof := coalesce(p_professional_id, v_appt.professional_id);
  if not exists (select 1 from public.professionals p where p.id = v_prof and p.salon_id = v_appt.salon_id and p.active) then
    raise exception 'Profissional não encontrado ou inativo';
  end if;
  select coalesce(sum(i.duration_minutes), 0) into v_minutes from public.appointment_items i where i.appointment_id = v_appt.id;
  perform public._validate_slot(v_appt.salon_id, v_prof, p_starts_at, p_starts_at + make_interval(mins => v_minutes));
  begin
    update public.appointments
    set starts_at = p_starts_at,
        ends_at = p_starts_at + make_interval(mins => v_minutes),
        professional_id = v_prof
    where id = v_appt.id
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'Horário indisponível: já existe outro atendimento nesse período';
  end;
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'rescheduled',
    jsonb_build_object('from', v_old.starts_at, 'to', v_appt.starts_at, 'from_professional', v_old.professional_id, 'to_professional', v_appt.professional_id));
  return v_appt;
end;
$$;

create function public._close_appointment(p_appointment_id uuid, p_new_status public.appointment_status, p_event text, p_reason text)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Agendamento não encontrado';
  end if;
  if not public.has_salon_role(v_appt.salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_appt.status not in ('scheduled', 'waiting') then
    raise exception 'Só é possível alterar atendimentos agendados ou na fila';
  end if;
  update public.appointments set status = p_new_status where id = v_appt.id returning * into v_appt;
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, p_event, jsonb_build_object('reason', coalesce(p_reason, '')));
  return v_appt;
end;
$$;

create function public.cancel_appointment(p_appointment_id uuid, p_reason text default '')
returns public.appointments language sql security definer set search_path = '' as $$
  select public._close_appointment(p_appointment_id, 'cancelled', 'cancelled', p_reason);
$$;

create function public.mark_no_show(p_appointment_id uuid)
returns public.appointments language sql security definer set search_path = '' as $$
  select public._close_appointment(p_appointment_id, 'no_show', 'no_show', '');
$$;

create function public.start_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Agendamento não encontrado';
  end if;
  if not (
    public.has_salon_role(v_appt.salon_id, array['admin', 'reception']::public.salon_role[])
    or (v_appt.professional_id is not null and v_appt.professional_id = public.my_professional_id(v_appt.salon_id))
  ) then
    raise exception 'Sem permissão para iniciar este atendimento' using errcode = '42501';
  end if;
  if v_appt.status <> 'scheduled' then
    raise exception 'Só é possível iniciar atendimentos agendados';
  end if;
  update public.appointments set status = 'in_progress', started_at = now() where id = v_appt.id returning * into v_appt;
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'started');
  return v_appt;
end;
$$;

-- Chama o próximo da fila (ordem de chegada) para o profissional.
create function public.call_next(p_salon_id uuid, p_professional_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_minutes integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if not (
    public.has_salon_role(p_salon_id, array['admin', 'reception']::public.salon_role[])
    or p_professional_id = public.my_professional_id(p_salon_id)
  ) then
    raise exception 'Sem permissão para chamar o próximo' using errcode = '42501';
  end if;
  if not exists (select 1 from public.professionals p where p.id = p_professional_id and p.salon_id = p_salon_id and p.active) then
    raise exception 'Profissional não encontrado ou inativo';
  end if;
  if exists (
    select 1 from public.appointments a
    where a.salon_id = p_salon_id and a.professional_id = p_professional_id and a.status = 'in_progress'
  ) then
    raise exception 'Profissional já está em atendimento';
  end if;

  select * into v_appt
  from public.appointments a
  where a.salon_id = p_salon_id and a.kind = 'walk_in' and a.status = 'waiting'
    and (a.professional_id is null or a.professional_id = p_professional_id)
  order by a.arrived_at, a.id
  limit 1
  for update skip locked;
  if not found then
    return null;
  end if;

  select coalesce(sum(i.duration_minutes), 0) into v_minutes from public.appointment_items i where i.appointment_id = v_appt.id;
  begin
    update public.appointments
    set professional_id = p_professional_id,
        status = 'in_progress',
        started_at = now(),
        starts_at = now(),
        ends_at = now() + make_interval(mins => greatest(v_minutes, 1))
    where id = v_appt.id
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'O profissional tem um agendamento que conflita com este atendimento';
  end;
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'called',
    jsonb_build_object('professional_id', p_professional_id));
  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------
revoke all on function public.my_professional_id(uuid) from public, anon;
revoke all on function public._log_appointment_event(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public._validate_slot(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public._build_appointment(uuid, uuid, text, uuid, uuid[], public.appointment_kind, timestamptz, text) from public, anon, authenticated;
revoke all on function public._close_appointment(uuid, public.appointment_status, text, text) from public, anon, authenticated;
revoke all on function public.create_appointment(uuid, uuid, text, uuid, timestamptz, uuid[], text) from public, anon;
revoke all on function public.enqueue_walk_in(uuid, uuid, text, uuid, uuid[]) from public, anon;
revoke all on function public.reschedule_appointment(uuid, timestamptz, uuid) from public, anon;
revoke all on function public.cancel_appointment(uuid, text) from public, anon;
revoke all on function public.mark_no_show(uuid) from public, anon;
revoke all on function public.start_appointment(uuid) from public, anon;
revoke all on function public.call_next(uuid, uuid) from public, anon;
grant execute on function public.my_professional_id(uuid) to authenticated, service_role;
grant execute on function public.create_appointment(uuid, uuid, text, uuid, timestamptz, uuid[], text) to authenticated, service_role;
grant execute on function public.enqueue_walk_in(uuid, uuid, text, uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reschedule_appointment(uuid, timestamptz, uuid) to authenticated, service_role;
grant execute on function public.cancel_appointment(uuid, text) to authenticated, service_role;
grant execute on function public.mark_no_show(uuid) to authenticated, service_role;
grant execute on function public.start_appointment(uuid) to authenticated, service_role;
grant execute on function public.call_next(uuid, uuid) to authenticated, service_role;

-- Realtime (fila e agenda ao vivo)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;
