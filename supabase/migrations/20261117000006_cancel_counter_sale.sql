-- Venda no balcão criada por engano (produto errado, duplicada) é cancelada antes
-- de receber; nada foi lançado no caixa nem no estoque ainda. Venda paga se
-- desfaz pelo estorno (refund_appointment), como qualquer atendimento.
create or replace function public.cancel_counter_sale(p_appointment_id uuid, p_reason text default null)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments := public.lock_appointment(p_appointment_id);
begin
  if public.has_salon_role(v_appt.salon_id, '{admin,reception}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if v_appt.kind <> 'sale' or v_appt.status <> 'awaiting_payment' then
    raise exception 'Atendimento não pode mudar deste status.';
  end if;
  update public.appointments set status = 'cancelled' where id = v_appt.id returning * into v_appt;
  insert into public.appointment_events (salon_id, appointment_id, event, data)
  values (v_appt.salon_id, v_appt.id, 'cancelled',
          case when nullif(trim(p_reason), '') is null then '{}'::jsonb else jsonb_build_object('reason', left(trim(p_reason), 200)) end);
  return v_appt;
end;
$$;

revoke execute on function public.cancel_counter_sale(uuid, text) from public, anon;
grant execute on function public.cancel_counter_sale(uuid, text) to authenticated;
