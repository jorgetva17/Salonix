-- RPCs de agenda e atendimento. security definer com checagem explícita de perfil:
-- cada mudança de status confere quem pede, o status atual e grava o evento junto.

-- Auxiliares internos (sem execute para a API) -------------------------------

-- Soma duração e preço dos serviços ativos do salão; repetidos contam de novo.
create or replace function public.services_totals(p_salon_id uuid, p_service_ids uuid[], out duration_minutes integer, out total_cents integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_found integer;
begin
  select count(*), sum(s.duration_minutes), sum(s.price_cents)
  into v_found, duration_minutes, total_cents
  from unnest(p_service_ids) as sid (id)
  join public.services s on s.id = sid.id and s.salon_id = p_salon_id and s.active;
  if coalesce(cardinality(p_service_ids), 0) = 0 or v_found <> cardinality(p_service_ids) then
    raise exception 'Serviço inválido.';
  end if;
end;
$$;

-- Um item por serviço, com o preço e a duração de agora (snapshot).
create or replace function public.insert_service_items(p_salon_id uuid, p_appointment_id uuid, p_service_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, unit_price_cents, duration_minutes)
  select p_salon_id, p_appointment_id, 'service', s.id, s.price_cents, s.duration_minutes
  from unnest(p_service_ids) with ordinality as sid (id, ord)
  join public.services s on s.id = sid.id
  order by sid.ord;
$$;

-- O intervalo cabe inteiro num trecho da jornada do dia (horário do salão) e
-- não cruza bloqueio. Não confere outros agendamentos: a exclusion constraint faz isso.
create or replace function public.assert_slot_available(
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamp := p_starts_at at time zone p_timezone;
  v_end timestamp := p_ends_at at time zone p_timezone;
begin
  if v_end::date <> v_start::date or not exists (
    select 1 from public.professional_schedules ps
    where ps.professional_id = p_professional_id
      and ps.weekday = extract(dow from v_start)
      and ps.starts_at <= v_start::time
      and ps.ends_at >= v_end::time
  ) then
    raise exception 'Fora da jornada do profissional.';
  end if;

  if exists (
    select 1 from public.schedule_blocks b
    where b.professional_id = p_professional_id and b.starts_at < p_ends_at and b.ends_at > p_starts_at
  ) then
    raise exception 'Profissional bloqueado neste horário.';
  end if;
end;
$$;

-- Admin/recepção do salão, ou o próprio profissional do atendimento.
create or replace function public.can_act_on_appointment(p_salon_id uuid, p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_salon_role(p_salon_id, '{admin,reception}')
    or (p_professional_id is not null and p_professional_id = public.my_professional_id(p_salon_id));
$$;

-- Carrega e trava o atendimento; erro se não existir.
create or replace function public.lock_appointment(p_appointment_id uuid)
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
    raise exception 'Atendimento não encontrado.';
  end if;
  return v_appt;
end;
$$;

revoke execute on function public.services_totals(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.insert_service_items(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.assert_slot_available(uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.can_act_on_appointment(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.lock_appointment(uuid) from public, anon, authenticated;

-- Agenda -----------------------------------------------------------------------

create or replace function public.create_appointment(
  p_salon_id uuid,
  p_customer_id uuid,
  p_professional_id uuid,
  p_service_ids uuid[],
  p_starts_local timestamp,
  p_notes text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_totals record;
  v_starts_at timestamptz;
  v_appt public.appointments;
begin
  if not public.has_salon_role(p_salon_id, '{admin,reception}') then
    raise exception 'Sem permissão.';
  end if;
  select timezone into v_timezone from public.salons where id = p_salon_id;
  if not exists (select 1 from public.professionals where id = p_professional_id and salon_id = p_salon_id and active) then
    raise exception 'Profissional não encontrado.';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and salon_id = p_salon_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  select * into v_totals from public.services_totals(p_salon_id, p_service_ids);
  v_starts_at := p_starts_local at time zone v_timezone;
  perform public.assert_slot_available(
    p_professional_id, v_starts_at, v_starts_at + make_interval(mins => v_totals.duration_minutes), v_timezone);

  begin
    insert into public.appointments (
      salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, duration_minutes, total_cents, notes
    ) values (
      p_salon_id, p_customer_id, p_professional_id, 'scheduled', 'scheduled', v_starts_at,
      v_starts_at + make_interval(mins => v_totals.duration_minutes), v_totals.duration_minutes, v_totals.total_cents,
      nullif(trim(p_notes), '')
    )
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'Horário indisponível para este profissional.';
  end;

  perform public.insert_service_items(p_salon_id, v_appt.id, p_service_ids);
  insert into public.appointment_events (salon_id, appointment_id, event) values (p_salon_id, v_appt.id, 'created');
  return v_appt;
end;
$$;

create or replace function public.reschedule_appointment(p_appointment_id uuid, p_professional_id uuid, p_starts_local timestamp)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.appointments := public.lock_appointment(p_appointment_id);
  v_timezone text;
  v_starts_at timestamptz;
  v_appt public.appointments;
begin
  if not public.has_salon_role(v_old.salon_id, '{admin,reception}') then
    raise exception 'Sem permissão.';
  end if;
  if v_old.status <> 'scheduled' then
    raise exception 'Atendimento não pode mudar deste status.';
  end if;
  if not exists (select 1 from public.professionals where id = p_professional_id and salon_id = v_old.salon_id and active) then
    raise exception 'Profissional não encontrado.';
  end if;

  select timezone into v_timezone from public.salons where id = v_old.salon_id;
  v_starts_at := p_starts_local at time zone v_timezone;
  perform public.assert_slot_available(
    p_professional_id, v_starts_at, v_starts_at + make_interval(mins => v_old.duration_minutes), v_timezone);

  begin
    update public.appointments
    set professional_id = p_professional_id,
        starts_at = v_starts_at,
        ends_at = v_starts_at + make_interval(mins => v_old.duration_minutes)
    where id = p_appointment_id
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'Horário indisponível para este profissional.';
  end;

  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_old.salon_id, p_appointment_id, 'rescheduled', jsonb_build_object(
    'from', jsonb_build_object('starts_at', v_old.starts_at, 'professional_id', v_old.professional_id)));
  return v_appt;
end;
$$;

-- Muda o status de um atendimento conferindo origem e permissão (uso interno).
create or replace function public.transition_appointment(
  p_appointment_id uuid,
  p_from text[],
  p_to text,
  p_event text,
  p_reception_only boolean,
  p_data jsonb default '{}'
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.appointments := public.lock_appointment(p_appointment_id);
  v_appt public.appointments;
begin
  if (p_reception_only and not public.has_salon_role(v_old.salon_id, '{admin,reception}'))
     or (not p_reception_only and not public.can_act_on_appointment(v_old.salon_id, v_old.professional_id)) then
    raise exception 'Sem permissão.';
  end if;
  if not (v_old.status = any (p_from)) then
    raise exception 'Atendimento não pode mudar deste status.';
  end if;
  if p_to = 'in_progress' and exists (
    select 1 from public.appointments
    where professional_id = v_old.professional_id and status = 'in_progress' and id <> p_appointment_id
  ) then
    raise exception 'Profissional já está em atendimento.';
  end if;

  update public.appointments set status = p_to where id = p_appointment_id returning * into v_appt;
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_old.salon_id, p_appointment_id, p_event, p_data);
  return v_appt;
end;
$$;

revoke execute on function public.transition_appointment(uuid, text[], text, text, boolean, jsonb) from public, anon, authenticated;

create or replace function public.cancel_appointment(p_appointment_id uuid, p_reason text default null)
returns public.appointments
language sql
security definer
set search_path = ''
as $$
  select * from public.transition_appointment(
    p_appointment_id, '{scheduled,waiting}', 'cancelled', 'cancelled', true,
    case when nullif(trim(p_reason), '') is null then '{}'::jsonb else jsonb_build_object('reason', trim(p_reason)) end);
$$;

create or replace function public.mark_no_show(p_appointment_id uuid)
returns public.appointments
language sql
security definer
set search_path = ''
as $$
  select * from public.transition_appointment(p_appointment_id, '{scheduled,waiting}', 'no_show', 'no_show', true);
$$;

create or replace function public.start_appointment(p_appointment_id uuid)
returns public.appointments
language sql
security definer
set search_path = ''
as $$
  select * from public.transition_appointment(p_appointment_id, '{scheduled}', 'in_progress', 'started', false);
$$;

create or replace function public.complete_appointment(p_appointment_id uuid)
returns public.appointments
language sql
security definer
set search_path = ''
as $$
  select * from public.transition_appointment(p_appointment_id, '{in_progress}', 'awaiting_payment', 'completed', false);
$$;

revoke execute on function public.create_appointment(uuid, uuid, uuid, uuid[], timestamp, text) from public, anon;
revoke execute on function public.reschedule_appointment(uuid, uuid, timestamp) from public, anon;
revoke execute on function public.cancel_appointment(uuid, text) from public, anon;
revoke execute on function public.mark_no_show(uuid) from public, anon;
revoke execute on function public.start_appointment(uuid) from public, anon;
revoke execute on function public.complete_appointment(uuid) from public, anon;
grant execute on function public.create_appointment(uuid, uuid, uuid, uuid[], timestamp, text) to authenticated;
grant execute on function public.reschedule_appointment(uuid, uuid, timestamp) to authenticated;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;
grant execute on function public.mark_no_show(uuid) to authenticated;
grant execute on function public.start_appointment(uuid) to authenticated;
grant execute on function public.complete_appointment(uuid) to authenticated;
