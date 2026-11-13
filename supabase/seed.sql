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
