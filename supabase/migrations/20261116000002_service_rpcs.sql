-- Ajustes do atendimento: adicionar/remover serviço e desfazer um início por engano.

-- Itens passam a gravar o profissional que executou (o do atendimento).
create or replace function public.insert_service_items(p_salon_id uuid, p_appointment_id uuid, p_service_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, professional_id, unit_price_cents, duration_minutes)
  select p_salon_id, p_appointment_id, 'service', s.id, a.professional_id, s.price_cents, s.duration_minutes
  from unnest(p_service_ids) with ordinality as sid (id, ord)
  join public.services s on s.id = sid.id
  join public.appointments a on a.id = p_appointment_id
  order by sid.ord;
$$;

-- No walk-in, o profissional só é conhecido na chamada: completa os itens sem profissional.
create or replace function public.call_next_walk_in(p_salon_id uuid, p_professional_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_next public.appointments;
  v_appt public.appointments;
begin
  -- Permissão primeiro (e "is not true" barra NULL de quem não tem profissional vinculado).
  if (
    public.has_salon_role(p_salon_id, '{admin,reception}')
    or coalesce(public.my_professional_id(p_salon_id) = p_professional_id, false)
  ) is not true then
    raise exception 'Sem permissão.';
  end if;
  if not exists (select 1 from public.professionals where id = p_professional_id and salon_id = p_salon_id and active) then
    raise exception 'Profissional não encontrado.';
  end if;
  select timezone into v_timezone from public.salons where id = p_salon_id;
  if exists (select 1 from public.appointments where professional_id = p_professional_id and status = 'in_progress') then
    raise exception 'Profissional já está em atendimento.';
  end if;

  select * into v_next from public.appointments
  where salon_id = p_salon_id and kind = 'walk_in' and status = 'waiting'
    and (professional_id is null or professional_id = p_professional_id)
    -- A fila é do dia (no fuso do salão): quem ficou de outro dia não volta a ser chamado.
    and arrived_at >= (date_trunc('day', now() at time zone v_timezone) at time zone v_timezone)
  order by arrived_at, created_at
  limit 1
  for update skip locked;
  if not found then
    raise exception 'Fila vazia para este profissional.';
  end if;

  begin
    update public.appointments
    set professional_id = p_professional_id,
        status = 'in_progress',
        starts_at = now(),
        ends_at = now() + make_interval(mins => duration_minutes)
    where id = v_next.id
    returning * into v_appt;
  exception when unique_violation then
    raise exception 'Profissional já está em atendimento.';
  end;

  update public.appointment_items set professional_id = p_professional_id
  where appointment_id = v_appt.id and professional_id is distinct from p_professional_id;

  -- Guarda a preferência de antes para "Desfazer início" devolver o cliente ao mesmo lugar.
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (p_salon_id, v_appt.id, 'called', jsonb_build_object('from_professional_id', v_next.professional_id));
  return v_appt;
end;
$$;

-- Auxiliares internos ----------------------------------------------------------

-- Ajustar itens: em curso, admin/recepção ou o próprio profissional; aguardando
-- pagamento, só admin/recepção. Devolve o atendimento travado.
create or replace function public.lock_adjustable_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments := public.lock_appointment(p_appointment_id);
begin
  if (case when v_appt.status = 'in_progress' then public.can_act_on_appointment(v_appt.salon_id, v_appt.professional_id)
           else public.has_salon_role(v_appt.salon_id, '{admin,reception}') end) is not true then
    raise exception 'Sem permissão.';
  end if;
  if v_appt.status not in ('in_progress', 'awaiting_payment') then
    raise exception 'Atendimento não pode mudar deste status.';
  end if;
  return v_appt;
end;
$$;

-- O total é sempre a soma dos itens (a duração não muda: ver o plano da Fase 4).
create or replace function public.recalc_appointment_total(p_appointment_id uuid)
returns public.appointments
language sql
security definer
set search_path = ''
as $$
  update public.appointments a
  set total_cents = (select coalesce(sum(i.unit_price_cents * i.quantity), 0) from public.appointment_items i where i.appointment_id = a.id)
  where a.id = p_appointment_id
  returning *;
$$;

revoke execute on function public.lock_adjustable_appointment(uuid) from public, anon, authenticated;
revoke execute on function public.recalc_appointment_total(uuid) from public, anon, authenticated;

-- RPCs -----------------------------------------------------------------------

create or replace function public.add_appointment_item(
  p_appointment_id uuid,
  p_service_id uuid,
  p_professional_id uuid default null
)
returns public.appointment_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments := public.lock_adjustable_appointment(p_appointment_id);
  v_service public.services;
  v_item public.appointment_items;
begin
  -- Mesma checagem dos outros RPCs: serviço ativo do salão.
  perform public.services_totals(v_appt.salon_id, array[p_service_id]);
  select * into v_service from public.services where id = p_service_id;
  if p_professional_id is not null
     and not exists (select 1 from public.professionals where id = p_professional_id and salon_id = v_appt.salon_id and active) then
    raise exception 'Profissional não encontrado.';
  end if;

  insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, professional_id, unit_price_cents, duration_minutes)
  values (v_appt.salon_id, v_appt.id, 'service', v_service.id, coalesce(p_professional_id, v_appt.professional_id),
          v_service.price_cents, v_service.duration_minutes)
  returning * into v_item;

  perform public.recalc_appointment_total(v_appt.id);
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'item_added', jsonb_build_object('service_id', v_service.id, 'item_id', v_item.id));
  return v_item;
end;
$$;

create or replace function public.remove_appointment_item(p_item_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment_id uuid;
  v_appt public.appointments;
  v_service_id uuid;
begin
  select appointment_id, service_id into v_appointment_id, v_service_id from public.appointment_items where id = p_item_id;
  if v_appointment_id is null then
    raise exception 'Atendimento não encontrado.';
  end if;
  v_appt := public.lock_adjustable_appointment(v_appointment_id);
  if (select count(*) from public.appointment_items where appointment_id = v_appt.id and item_type = 'service') <= 1 then
    raise exception 'Atendimento precisa de pelo menos um serviço.';
  end if;

  delete from public.appointment_items where id = p_item_id;
  v_appt := public.recalc_appointment_total(v_appt.id);
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'item_removed', jsonb_build_object('service_id', v_service_id));
  return v_appt;
end;
$$;

-- Desfaz um "Iniciar" ou "Chamar próximo" por engano (admin/recepção).
create or replace function public.revert_appointment_start(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.appointments := public.lock_appointment(p_appointment_id);
  v_appt public.appointments;
  v_from_professional uuid;
begin
  if public.has_salon_role(v_old.salon_id, '{admin,reception}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if v_old.status <> 'in_progress' then
    raise exception 'Atendimento não pode mudar deste status.';
  end if;

  if v_old.kind = 'scheduled' then
    -- Iniciar não mexe no horário agendado; basta voltar o status.
    update public.appointments set status = 'scheduled' where id = p_appointment_id returning * into v_appt;
  else
    select (data->>'from_professional_id')::uuid into v_from_professional
    from public.appointment_events
    where appointment_id = p_appointment_id and event = 'called'
    order by created_at desc
    limit 1;
    update public.appointments
    set status = 'waiting', professional_id = v_from_professional, starts_at = null, ends_at = null
    where id = p_appointment_id
    returning * into v_appt;
  end if;

  insert into public.appointment_events (salon_id, appointment_id, event) values (v_old.salon_id, p_appointment_id, 'reverted');
  return v_appt;
end;
$$;

revoke execute on function public.add_appointment_item(uuid, uuid, uuid) from public, anon;
revoke execute on function public.remove_appointment_item(uuid) from public, anon;
revoke execute on function public.revert_appointment_start(uuid) from public, anon;
grant execute on function public.add_appointment_item(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_appointment_item(uuid) to authenticated;
grant execute on function public.revert_appointment_start(uuid) to authenticated;
