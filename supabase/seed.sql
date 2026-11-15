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

-- Caixa de demonstração (Fase 4) ---------------------------------------------
-- Caixa aberto pela recepção com R$ 100,00; dois atendimentos de hoje já pagos em
-- dinheiro (com comissão disponível) e o Diego aguardando pagamento.

do $$
declare
  v_salon uuid := '00000000-0000-4000-8000-000000000001';
  v_rec uuid := '00000000-0000-4000-8000-0000000000a2';
  v_paulo uuid := '00000000-0000-4000-8000-0000000000c1';
  v_marcos uuid := '00000000-0000-4000-8000-0000000000c2';
  v_corte uuid := '00000000-0000-4000-8000-0000000000b1';
  v_barba uuid := '00000000-0000-4000-8000-0000000000b2';
  v_month date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_session uuid := '00000000-0000-4000-8000-0000000000e1';
  v_paid_paulo uuid := '00000000-0000-4000-8000-0000000000d3';
  v_paid_marcos uuid := '00000000-0000-4000-8000-0000000000d4';
  v_diego_appt uuid := '00000000-0000-4000-8000-0000000000d5';
  v_carlos uuid := (select id from public.customers where salon_id = v_salon and name = 'Carlos Cliente');
  v_jose uuid := (select id from public.customers where salon_id = v_salon and name = 'José Ávila');
  v_diego uuid;
begin
  insert into public.customers (salon_id, name, phone) values (v_salon, 'Diego Souza', '11954321098') returning id into v_diego;
  insert into public.cash_sessions (id, salon_id, opened_by, opened_at, opening_cents)
  values (v_session, v_salon, v_rec, now() - interval '4 hours', 10000);

  insert into public.appointments (id, salon_id, customer_id, professional_id, kind, status, starts_at, ends_at, arrived_at, duration_minutes, total_cents, created_by) values
    (v_paid_paulo, v_salon, v_carlos, v_paulo, 'walk_in', 'paid', now() - interval '3 hours', now() - interval '150 minutes', now() - interval '3 hours', 30, 4500, v_rec),
    (v_paid_marcos, v_salon, v_jose, v_marcos, 'walk_in', 'paid', now() - interval '3 hours', now() - interval '150 minutes', now() - interval '3 hours', 30, 3500, v_rec),
    (v_diego_appt, v_salon, v_diego, v_paulo, 'walk_in', 'awaiting_payment', now() - interval '1 hour', now() - interval '30 minutes', now() - interval '1 hour', 30, 3500, v_rec);
  insert into public.appointment_items (id, salon_id, appointment_id, item_type, service_id, professional_id, unit_price_cents, duration_minutes) values
    ('00000000-0000-4000-8000-0000000000f3', v_salon, v_paid_paulo, 'service', v_corte, v_paulo, 4500, 30),
    ('00000000-0000-4000-8000-0000000000f4', v_salon, v_paid_marcos, 'service', v_barba, v_marcos, 3500, 30),
    ('00000000-0000-4000-8000-0000000000f5', v_salon, v_diego_appt, 'service', v_barba, v_paulo, 3500, 30);
  insert into public.appointment_events (salon_id, appointment_id, event, actor) values
    (v_salon, v_paid_paulo, 'created', v_rec), (v_salon, v_paid_paulo, 'called', v_rec), (v_salon, v_paid_paulo, 'completed', v_rec),
    (v_salon, v_paid_paulo, 'paid', v_rec),
    (v_salon, v_paid_marcos, 'created', v_rec), (v_salon, v_paid_marcos, 'called', v_rec), (v_salon, v_paid_marcos, 'completed', v_rec),
    (v_salon, v_paid_marcos, 'paid', v_rec),
    (v_salon, v_diego_appt, 'created', v_rec), (v_salon, v_diego_appt, 'called', v_rec), (v_salon, v_diego_appt, 'completed', v_rec);

  insert into public.transactions (salon_id, type, category, amount_cents, method, status, paid_at, appointment_id, cash_session_id, created_by) values
    (v_salon, 'income', 'atendimento', 4500, 'cash', 'paid', now() - interval '150 minutes', v_paid_paulo, v_session, v_rec),
    (v_salon, 'income', 'atendimento', 3500, 'cash', 'paid', now() - interval '150 minutes', v_paid_marcos, v_session, v_rec);
  -- Paulo: 40% padrão no corte; Marcos: 50% padrão.
  insert into public.commissions (salon_id, appointment_id, appointment_item_id, professional_id, base_cents, percent, amount_cents, reference_month, status) values
    (v_salon, v_paid_paulo, '00000000-0000-4000-8000-0000000000f3', v_paulo, 4500, 40, 1800, v_month, 'available'),
    (v_salon, v_paid_marcos, '00000000-0000-4000-8000-0000000000f4', v_marcos, 3500, 50, 1750, v_month, 'available');
end $$;

-- Estoque e equipamentos de demonstração (Fase 5) ----------------------------
-- Shampoo abaixo do mínimo, Pomada vendável, consumo no Corte e na Barba e a
-- Máquina de corte com manutenção próxima. Os atendimentos pagos acima não
-- geram baixa retroativa.

do $$
declare
  v_salon uuid := '00000000-0000-4000-8000-000000000001';
  v_admin uuid := '00000000-0000-4000-8000-0000000000a1';
  v_paulo uuid := '00000000-0000-4000-8000-0000000000c1';
  v_corte uuid := '00000000-0000-4000-8000-0000000000b1';
  v_barba uuid := '00000000-0000-4000-8000-0000000000b2';
  v_shampoo uuid := '00000000-0000-4000-8000-000000000101';
  v_pomada uuid := '00000000-0000-4000-8000-000000000102';
  v_lamina uuid := '00000000-0000-4000-8000-000000000103';
  v_maquina uuid := '00000000-0000-4000-8000-000000000111';
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into public.inventory_items (id, salon_id, name, unit, min_quantity, unit_cost_cents, sale_price_cents) values
    (v_shampoo, v_salon, 'Shampoo', 'ml', 500, 3, null),
    (v_pomada, v_salon, 'Pomada modeladora', 'un', 5, 1500, 3500),
    (v_lamina, v_salon, 'Lâmina descartável', 'un', 20, 50, null);
  -- O saldo sai do trigger dos movimentos.
  insert into public.stock_movements (salon_id, inventory_item_id, type, quantity, unit_cost_cents, reason, created_by) values
    (v_salon, v_shampoo, 'in', 300, 3, 'Estoque inicial', v_admin),
    (v_salon, v_pomada, 'in', 12, 1500, 'Estoque inicial', v_admin),
    (v_salon, v_lamina, 'in', 40, 50, 'Estoque inicial', v_admin);
  insert into public.service_consumables (salon_id, service_id, inventory_item_id, quantity) values
    (v_salon, v_corte, v_shampoo, 15),
    (v_salon, v_corte, v_lamina, 1),
    (v_salon, v_barba, v_lamina, 1);

  insert into public.equipment (id, salon_id, name, professional_id) values
    (v_maquina, v_salon, 'Máquina de corte', v_paulo);
  insert into public.equipment (salon_id, name) values (v_salon, 'Cadeira 1');
  insert into public.equipment_maintenance (salon_id, equipment_id, performed_on, description, cost_cents, next_due, created_by)
  values (v_salon, v_maquina, v_today - 80, 'Revisão e afiação', 8000, v_today + 5, v_admin);
end $$;
