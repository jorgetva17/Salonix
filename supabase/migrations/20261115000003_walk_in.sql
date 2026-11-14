-- Fila de walk-in: ordem de chegada (arrived_at), sem reservar horário.
-- Remover da fila e marcar falta usam cancel_appointment e mark_no_show.

create or replace function public.enqueue_walk_in(
  p_salon_id uuid,
  p_customer_id uuid,
  p_service_ids uuid[],
  p_professional_id uuid default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_totals record;
  v_appt public.appointments;
begin
  if not public.has_salon_role(p_salon_id, '{admin,reception}') then
    raise exception 'Sem permissão.';
  end if;
  if p_professional_id is not null
     and not exists (select 1 from public.professionals where id = p_professional_id and salon_id = p_salon_id and active) then
    raise exception 'Profissional não encontrado.';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and salon_id = p_salon_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  select * into v_totals from public.services_totals(p_salon_id, p_service_ids);
  insert into public.appointments (
    salon_id, customer_id, professional_id, kind, status, arrived_at, duration_minutes, total_cents
  ) values (
    p_salon_id, p_customer_id, p_professional_id, 'walk_in', 'waiting', now(), v_totals.duration_minutes, v_totals.total_cents
  )
  returning * into v_appt;

  perform public.insert_service_items(p_salon_id, v_appt.id, p_service_ids);
  insert into public.appointment_events (salon_id, appointment_id, event) values (p_salon_id, v_appt.id, 'created');
  return v_appt;
end;
$$;

-- Chama o próximo da fila para o profissional: o mais antigo que espera por ele
-- ou por qualquer um. Quem espera outro profissional é pulado, não reordenado.
create or replace function public.call_next_walk_in(p_salon_id uuid, p_professional_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next public.appointments;
  v_appt public.appointments;
begin
  if not exists (select 1 from public.professionals where id = p_professional_id and salon_id = p_salon_id and active) then
    raise exception 'Profissional não encontrado.';
  end if;
  if not (
    public.has_salon_role(p_salon_id, '{admin,reception}')
    or public.my_professional_id(p_salon_id) = p_professional_id
  ) then
    raise exception 'Sem permissão.';
  end if;
  if exists (select 1 from public.appointments where professional_id = p_professional_id and status = 'in_progress') then
    raise exception 'Profissional já está em atendimento.';
  end if;

  select * into v_next from public.appointments
  where salon_id = p_salon_id and kind = 'walk_in' and status = 'waiting'
    and (professional_id is null or professional_id = p_professional_id)
  order by arrived_at, created_at
  limit 1
  for update skip locked;
  if not found then
    raise exception 'Fila vazia para este profissional.';
  end if;

  update public.appointments
  set professional_id = p_professional_id,
      status = 'in_progress',
      starts_at = now(),
      ends_at = now() + make_interval(mins => duration_minutes)
  where id = v_next.id
  returning * into v_appt;

  insert into public.appointment_events (salon_id, appointment_id, event) values (p_salon_id, v_appt.id, 'called');
  return v_appt;
end;
$$;

revoke execute on function public.enqueue_walk_in(uuid, uuid, uuid[], uuid) from public, anon;
revoke execute on function public.call_next_walk_in(uuid, uuid) from public, anon;
grant execute on function public.enqueue_walk_in(uuid, uuid, uuid[], uuid) to authenticated;
grant execute on function public.call_next_walk_in(uuid, uuid) to authenticated;
