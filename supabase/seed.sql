-- Dados de demonstração (apenas desenvolvimento local). Senha de todos: salonix123

do $$
declare
  v_salon uuid := '00000000-0000-4000-8000-000000000001';
  v_users jsonb := '[
    {"id": "00000000-0000-4000-8000-0000000000a1", "email": "admin@salonix.dev", "name": "Ana Admin", "role": "admin"},
    {"id": "00000000-0000-4000-8000-0000000000a2", "email": "recepcao@salonix.dev", "name": "Rita Recepção", "role": "reception"},
    {"id": "00000000-0000-4000-8000-0000000000a3", "email": "pro@salonix.dev", "name": "Paulo Profissional", "role": "professional"}
  ]';
  v_user jsonb;
begin
  for v_user in select * from jsonb_array_elements(v_users) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', (v_user ->> 'id')::uuid, 'authenticated', 'authenticated',
      v_user ->> 'email', extensions.crypt('salonix123', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('full_name', v_user ->> 'name'), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), (v_user ->> 'id')::uuid, v_user ->> 'id', 'email',
      jsonb_build_object('sub', v_user ->> 'id', 'email', v_user ->> 'email', 'email_verified', true),
      now(), now(), now()
    );
  end loop;

  insert into public.salons (id, name, slug, phone) values (v_salon, 'Barbearia Demo', 'barbearia-demo', '(11) 99999-0000');
  insert into public.feature_flags (salon_id) values (v_salon);
  insert into public.salon_members (salon_id, user_id, role)
  select v_salon, (u ->> 'id')::uuid, (u ->> 'role')::public.salon_role from jsonb_array_elements(v_users) u;
end $$;

-- Cadastros de demonstração (Fase 2) ----------------------------------------

do $$
declare
  v_salon uuid := '00000000-0000-4000-8000-000000000001';
  v_corte uuid := '00000000-0000-4000-8000-0000000000b1';
  v_barba uuid := '00000000-0000-4000-8000-0000000000b2';
  v_combo uuid := '00000000-0000-4000-8000-0000000000b3';
  v_paulo uuid := '00000000-0000-4000-8000-0000000000c1';
  v_marcos uuid := '00000000-0000-4000-8000-0000000000c2';
begin
  insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
    (v_corte, v_salon, 'Corte masculino', 30, 4500),
    (v_barba, v_salon, 'Barba', 30, 3500),
    (v_combo, v_salon, 'Corte + barba', 60, 7000);

  insert into public.professionals (id, salon_id, user_id, name, color) values
    (v_paulo, v_salon, '00000000-0000-4000-8000-0000000000a3', 'Paulo Profissional', '#1B3B4B'),
    (v_marcos, v_salon, null, 'Marcos', '#B45309');

  insert into public.commission_rates (salon_id, professional_id, service_id, percent) values
    (v_salon, v_paulo, null, 40),
    (v_salon, v_paulo, v_barba, 50),
    (v_salon, v_marcos, null, 50);

  -- Terça (2) a sábado (6), 09:00–12:00 e 13:00–19:00.
  insert into public.professional_schedules (salon_id, professional_id, weekday, starts_at, ends_at)
  select v_salon, p, d, t.starts_at, t.ends_at
  from unnest(array[v_paulo, v_marcos]) p
  cross join generate_series(2, 6) d
  cross join (values ('09:00'::time, '12:00'::time), ('13:00'::time, '19:00'::time)) t (starts_at, ends_at);

  insert into public.customers (salon_id, name, phone, notes) values
    (v_salon, 'Carlos Cliente', '11987654321', 'Corte baixo nas laterais'),
    (v_salon, 'Bruna Souza', '11976543210', null),
    (v_salon, 'José Ávila', '11965432109', null);
end $$;

-- Agenda de demonstração (Fase 3) -------------------------------------------

do $$
declare
  v_salon uuid := '00000000-0000-4000-8000-000000000001';
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  -- Próxima terça (dow 2) estritamente depois de hoje.
  v_tuesday date := v_today + coalesce(nullif((2 - extract(dow from v_today)::int + 7) % 7, 0), 7);
  v_starts timestamptz := (v_tuesday + time '10:00') at time zone 'America/Sao_Paulo';
  v_carlos uuid := (select id from public.customers where salon_id = v_salon and name = 'Carlos Cliente');
  v_bruna uuid := (select id from public.customers where salon_id = v_salon and name = 'Bruna Souza');
  v_scheduled uuid := '00000000-0000-4000-8000-0000000000d1';
  v_walk_in uuid := '00000000-0000-4000-8000-0000000000d2';
begin
  insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, duration_minutes, total_cents, created_by)
  values (v_scheduled, v_salon, v_carlos, '00000000-0000-4000-8000-0000000000c1', 'scheduled', 'scheduled',
          v_starts, v_starts + interval '30 minutes', 30, 4500, '00000000-0000-4000-8000-0000000000a2');
  insert into public.appointments (id, salon_id, customer_id, kind, status, arrived_at, duration_minutes, total_cents, created_by)
  values (v_walk_in, v_salon, v_bruna, 'walk_in', 'waiting', now(), 30, 3500, '00000000-0000-4000-8000-0000000000a2');

  insert into public.appointment_items (salon_id, appointment_id, item_type, service_id, unit_price_cents, duration_minutes) values
    (v_salon, v_scheduled, 'service', '00000000-0000-4000-8000-0000000000b1', 4500, 30),
    (v_salon, v_walk_in, 'service', '00000000-0000-4000-8000-0000000000b2', 3500, 30);
  insert into public.appointment_events (salon_id, appointment_id, event, actor) values
    (v_salon, v_scheduled, 'created', '00000000-0000-4000-8000-0000000000a2'),
    (v_salon, v_walk_in, 'created', '00000000-0000-4000-8000-0000000000a2');
end $$;
