-- Convites de equipe: única forma de um usuário entrar em um salão existente.

create table public.salon_invites (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+$'),
  role public.salon_role not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index salon_invites_one_pending
  on public.salon_invites (salon_id, email) where status = 'pending';
create index salon_invites_email_idx on public.salon_invites (email) where status = 'pending';

create or replace function public.normalize_invite_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$;

create trigger salon_invites_normalize before insert or update of email on public.salon_invites
  for each row execute function public.normalize_invite_email();
create trigger salon_invites_updated_at before update on public.salon_invites
  for each row execute function public.set_updated_at();

alter table public.salon_invites enable row level security;

create policy "admin vê convites" on public.salon_invites
  for select to authenticated using (public.has_salon_role(salon_id, '{admin}'));
create policy "admin cria convites" on public.salon_invites
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin altera convites" on public.salon_invites
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));

-- E-mail confirmado do usuário logado (ou erro). -----------------------------

create or replace function public.current_confirmed_email()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_confirmed timestamptz;
begin
  select lower(email), email_confirmed_at into v_email, v_confirmed
  from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'É preciso estar autenticado.' using errcode = '42501';
  end if;
  if v_confirmed is null then
    raise exception 'Confirme seu e-mail antes de aceitar o convite.';
  end if;
  return v_email;
end;
$$;

revoke execute on function public.current_confirmed_email() from public, anon, authenticated;

create or replace function public.my_pending_invites()
returns table (id uuid, salon_id uuid, salon_name text, role public.salon_role, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.salon_id, s.name, i.role, i.created_at
  from public.salon_invites i
  join public.salons s on s.id = i.salon_id
  join auth.users u on u.id = auth.uid()
  where i.status = 'pending' and i.email = lower(u.email) and u.email_confirmed_at is not null
  order by i.created_at;
$$;

create or replace function public.accept_invite(p_invite_id uuid)
returns public.salon_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := public.current_confirmed_email();
  v_invite public.salon_invites;
  v_member public.salon_members;
begin
  select * into v_invite from public.salon_invites
  where id = p_invite_id and status = 'pending' and email = v_email
  for update;
  if not found then
    raise exception 'Convite não encontrado.';
  end if;

  insert into public.salon_members (salon_id, user_id, role)
  values (v_invite.salon_id, auth.uid(), v_invite.role)
  on conflict (salon_id, user_id) do update set role = excluded.role, active = true
  returning * into v_member;

  update public.salon_invites
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = v_invite.id;

  return v_member;
end;
$$;

create or replace function public.decline_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := public.current_confirmed_email();
begin
  update public.salon_invites set status = 'declined'
  where id = p_invite_id and status = 'pending' and email = v_email;
  if not found then
    raise exception 'Convite não encontrado.';
  end if;
end;
$$;

revoke execute on function public.my_pending_invites() from public, anon;
revoke execute on function public.accept_invite(uuid) from public, anon;
revoke execute on function public.decline_invite(uuid) from public, anon;
grant execute on function public.my_pending_invites() to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.decline_invite(uuid) to authenticated;
