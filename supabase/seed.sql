-- Dados de demonstração (apenas desenvolvimento local).
-- Usuários: admin@salonix.dev, recepcao@salonix.dev, pro@salonix.dev — senha: salonix123

do $$
declare
  v_salon uuid := '5a10a000-0000-4000-8000-000000000001';
  r record;
begin
  for r in
    select * from (values
      ('5a10a000-0000-4000-8000-0000000000a1'::uuid, 'admin@salonix.dev',    'Diego Admin',        'admin'::public.salon_role),
      ('5a10a000-0000-4000-8000-0000000000a2'::uuid, 'recepcao@salonix.dev', 'Rita Recepção',      'reception'::public.salon_role),
      ('5a10a000-0000-4000-8000-0000000000a3'::uuid, 'pro@salonix.dev',      'Paulo Profissional', 'professional'::public.salon_role)
    ) as t(id, email, full_name, role)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      r.email, extensions.crypt('salonix123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', r.full_name),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), r.id, r.id::text,
      jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
      'email', now(), now(), now())
    on conflict do nothing;

    if r.role = 'admin' then
      insert into public.salons (id, name, slug) values (v_salon, 'Barbearia Demo', 'barbearia-demo')
      on conflict (id) do nothing;
      insert into public.feature_flags (salon_id) values (v_salon) on conflict do nothing;
    end if;

    insert into public.salon_members (salon_id, user_id, role)
    values (v_salon, r.id, r.role)
    on conflict (salon_id, user_id) do nothing;
  end loop;
end $$;

-- Cadastros de demonstração
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ('5a10a000-0000-4000-8000-0000000000c1', '5a10a000-0000-4000-8000-000000000001', 'Corte', 30, 4500),
  ('5a10a000-0000-4000-8000-0000000000c2', '5a10a000-0000-4000-8000-000000000001', 'Barba', 20, 3000),
  ('5a10a000-0000-4000-8000-0000000000c3', '5a10a000-0000-4000-8000-000000000001', 'Corte + Barba', 50, 7000)
on conflict (id) do nothing;

insert into public.professionals (id, salon_id, user_id, name, color) values
  ('5a10a000-0000-4000-8000-0000000000d1', '5a10a000-0000-4000-8000-000000000001', '5a10a000-0000-4000-8000-0000000000a3', 'Paulo', '#1B3B4B'),
  ('5a10a000-0000-4000-8000-0000000000d2', '5a10a000-0000-4000-8000-000000000001', null, 'Marcos', '#F59E0B')
on conflict (id) do nothing;

insert into public.professional_default_commissions (professional_id, salon_id, commission_percent) values
  ('5a10a000-0000-4000-8000-0000000000d1', '5a10a000-0000-4000-8000-000000000001', 40),
  ('5a10a000-0000-4000-8000-0000000000d2', '5a10a000-0000-4000-8000-000000000001', 35)
on conflict (professional_id) do nothing;

insert into public.professional_schedules (salon_id, professional_id, weekday, start_time, end_time)
select '5a10a000-0000-4000-8000-000000000001', p.id, d, t.s, t.e
from (values ('5a10a000-0000-4000-8000-0000000000d1'::uuid), ('5a10a000-0000-4000-8000-0000000000d2'::uuid)) p(id),
     generate_series(1, 6) d,
     (values ('09:00'::time, '12:00'::time), ('13:00'::time, '18:00'::time)) t(s, e)
where not exists (select 1 from public.professional_schedules);

insert into public.customers (salon_id, name, phone)
select '5a10a000-0000-4000-8000-000000000001', v.n, v.p
from (values ('Maria Souza', '85999990001'), ('João Pereira', '85999990002'), ('Ana Lima', null)) v(n, p)
where not exists (select 1 from public.customers);

-- Agenda de demonstração: um agendamento amanhã às 10h (São Paulo) e dois clientes na fila
do $$
declare
  v_salon uuid := '5a10a000-0000-4000-8000-000000000001';
  v_start timestamptz := ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day 10 hours') at time zone 'America/Sao_Paulo');
  v_appt uuid;
  v_maria uuid;
begin
  if exists (select 1 from public.appointments) then
    return;
  end if;
  select id into v_maria from public.customers where salon_id = v_salon and name = 'Maria Souza';

  insert into public.appointments (salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, total_cents)
  values (v_salon, v_maria, '5a10a000-0000-4000-8000-0000000000d1', 'scheduled', 'scheduled', v_start, v_start + interval '30 minutes', 4500)
  returning id into v_appt;
  insert into public.appointment_items (appointment_id, salon_id, service_id, description, unit_price_cents, duration_minutes, professional_id)
  values (v_appt, v_salon, '5a10a000-0000-4000-8000-0000000000c1', 'Corte', 4500, 30, '5a10a000-0000-4000-8000-0000000000d1');

  insert into public.appointments (salon_id, guest_name, kind, status, arrived_at, total_cents)
  values (v_salon, 'Carlos (sem hora)', 'walk_in', 'waiting', clock_timestamp() - interval '12 minutes', 3000)
  returning id into v_appt;
  insert into public.appointment_items (appointment_id, salon_id, service_id, description, unit_price_cents, duration_minutes)
  values (v_appt, v_salon, '5a10a000-0000-4000-8000-0000000000c2', 'Barba', 3000, 20);

  insert into public.appointments (salon_id, guest_name, professional_id, kind, status, arrived_at, total_cents)
  values (v_salon, 'Rafael (quer o Paulo)', '5a10a000-0000-4000-8000-0000000000d1', 'walk_in', 'waiting', clock_timestamp() - interval '5 minutes', 4500)
  returning id into v_appt;
  insert into public.appointment_items (appointment_id, salon_id, service_id, description, unit_price_cents, duration_minutes, professional_id)
  values (v_appt, v_salon, '5a10a000-0000-4000-8000-0000000000c1', 'Corte', 4500, 30, '5a10a000-0000-4000-8000-0000000000d1');
end $$;
