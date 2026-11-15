-- Salonix · Fase 1 · Convites de equipe

create extension if not exists citext with schema extensions;

create table public.salon_invites (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  email extensions.citext not null,
  role public.salon_role not null,
  invited_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index salon_invites_pending_unique
  on public.salon_invites (salon_id, email) where status = 'pending';
create index salon_invites_email_idx on public.salon_invites (email);

alter table public.salon_invites enable row level security;

create policy salon_invites_admin_all on public.salon_invites
  for all to authenticated
  using (public.has_salon_role(salon_id, array['admin']::public.salon_role[]))
  with check (public.has_salon_role(salon_id, array['admin']::public.salon_role[]));

grant select, insert, update, delete on public.salon_invites to authenticated;
grant all on public.salon_invites to service_role;

-- Convites pendentes do usuário logado (casados pelo e-mail da conta).
create function public.my_pending_invites()
returns table (
  id uuid,
  salon_id uuid,
  salon_name text,
  role public.salon_role,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.salon_id, s.name, i.role, i.created_at
  from public.salon_invites i
  join public.salons s on s.id = i.salon_id
  join auth.users u on u.id = (select auth.uid())
  where i.status = 'pending'
    and lower(i.email::text) = lower(u.email)
  order by i.created_at;
$$;

create function public.accept_invite(p_invite_id uuid)
returns public.salon_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.salon_invites;
  v_member public.salon_members;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  select i.* into v_invite
  from public.salon_invites i
  join auth.users u on u.id = v_uid
  where i.id = p_invite_id
    and i.status = 'pending'
    and lower(i.email::text) = lower(u.email)
  for update of i;

  if not found then
    raise exception 'Convite inválido ou expirado';
  end if;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  insert into public.salon_members (salon_id, user_id, role, active)
  values (v_invite.salon_id, v_uid, v_invite.role, true)
  on conflict (salon_id, user_id)
  do update set role = excluded.role, active = true
  returning * into v_member;

  update public.salon_invites
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  return v_member;
end;
$$;

create function public.decline_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.salon_invites i
  set status = 'revoked'
  from auth.users u
  where u.id = (select auth.uid())
    and i.id = p_invite_id
    and i.status = 'pending'
    and lower(i.email::text) = lower(u.email);
end;
$$;

revoke all on function public.my_pending_invites() from public, anon;
revoke all on function public.accept_invite(uuid) from public, anon;
revoke all on function public.decline_invite(uuid) from public, anon;
grant execute on function public.my_pending_invites() to authenticated, service_role;
grant execute on function public.accept_invite(uuid) to authenticated, service_role;
grant execute on function public.decline_invite(uuid) to authenticated, service_role;
