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
