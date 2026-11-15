begin;
set local search_path to public, extensions;
select plan(3);

create function pg_temp.make_user(p_id uuid, p_email text) returns void language sql as $$
  insert into auth.users (id, email) values (p_id, p_email);
$$;
create function pg_temp.claims(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
    set_config('request.jwt.claim.sub', p_uid::text, true);
$$;

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'admin@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'paulo@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'adminb@t.dev');

select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated; select public.create_salon('Salão A'); reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated; select public.create_salon('Salão B'); reset role;

insert into public.professionals (id, salon_id, name)
select '00000000-0000-0000-0000-0000000000f1', id, 'Paulo' from public.salons where name = 'Salão A';

-- convite vinculado ao profissional
select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
insert into public.salon_invites (salon_id, email, role, professional_id)
select id, 'paulo@t.dev', 'professional', '00000000-0000-0000-0000-0000000000f1' from public.salons where name = 'Salão A';
reset role;

select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select public.accept_invite((select id from public.my_pending_invites() limit 1));
reset role;

select is((select user_id from public.professionals where id = '00000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-0000000000a2'::uuid, 'aceitar o convite vincula o login ao profissional');

-- convite do salão B não pode apontar para profissional do salão A
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select throws_ok($$insert into public.salon_invites (salon_id, email, role, professional_id)
  select id, 'x@t.dev', 'professional', '00000000-0000-0000-0000-0000000000f1' from public.salons where name = 'Salão B'$$,
  '23503', null, 'convite não vincula profissional de outro salão');
reset role;

select is((select status from public.salon_invites where email = 'paulo@t.dev'), 'accepted', 'convite aceito');

select * from finish();
rollback;
