-- Profissionais (com ou sem login) e taxas de comissão.
-- A comissão fica fora de "professionals" porque a equipe toda lê os
-- profissionais (agenda), mas só o admin e o próprio profissional leem a taxa.

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id),
  unique (salon_id, user_id)
);

create trigger professionals_updated_at before update on public.professionals
  for each row execute function public.set_updated_at();

alter table public.professionals enable row level security;

create policy "membros veem profissionais" on public.professionals
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin cria profissionais" on public.professionals
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin altera profissionais" on public.professionals
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));

-- user_id só muda por link_professional_user, que confere se a pessoa é da equipe.
revoke insert, update on public.professionals from authenticated, anon;
grant insert (salon_id, name, color, active), update (name, color, active) on public.professionals to authenticated;

-- Comissões ------------------------------------------------------------------
-- service_id nulo = taxa padrão do profissional.

create table public.commission_rates (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  professional_id uuid not null,
  service_id uuid,
  percent numeric(5, 2) not null check (percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade
);

create unique index commission_rates_default_idx on public.commission_rates (professional_id) where service_id is null;
create unique index commission_rates_service_idx on public.commission_rates (professional_id, service_id)
  where service_id is not null;

create trigger commission_rates_updated_at before update on public.commission_rates
  for each row execute function public.set_updated_at();

alter table public.commission_rates enable row level security;

create policy "admin ou o próprio profissional veem comissões" on public.commission_rates
  for select to authenticated using (
    public.has_salon_role(salon_id, '{admin}')
    or exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.user_id = auth.uid() and public.is_salon_member(p.salon_id)
    )
  );
create policy "admin cria comissões" on public.commission_rates
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin altera comissões" on public.commission_rates
  for update to authenticated
  using (public.has_salon_role(salon_id, '{admin}'))
  with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin remove comissões" on public.commission_rates
  for delete to authenticated using (public.has_salon_role(salon_id, '{admin}'));

-- RPCs -----------------------------------------------------------------------

-- Cria (p_id nulo) ou atualiza o profissional e a comissão padrão juntos.
-- p_active nulo mantém o status atual (novo profissional nasce ativo).
-- security invoker: a RLS barra quem não é admin de p_salon_id.
create or replace function public.save_professional(
  p_salon_id uuid,
  p_name text,
  p_color text,
  p_commission_percent numeric,
  p_id uuid default null,
  p_active boolean default null
)
returns public.professionals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_professional public.professionals;
begin
  if p_id is null then
    insert into public.professionals (salon_id, name, color, active)
    values (p_salon_id, p_name, p_color, coalesce(p_active, true))
    returning * into v_professional;
  else
    update public.professionals
    set name = p_name, color = p_color, active = coalesce(p_active, active)
    where id = p_id and salon_id = p_salon_id
    returning * into v_professional;
    if not found then
      raise exception 'Profissional não encontrado.';
    end if;
  end if;

  insert into public.commission_rates (salon_id, professional_id, service_id, percent)
  values (p_salon_id, v_professional.id, null, p_commission_percent)
  on conflict (professional_id) where service_id is null
  do update set percent = excluded.percent;

  return v_professional;
end;
$$;

-- Liga o profissional a um membro ativo do salão (ou desliga, com p_user_id nulo).
create or replace function public.link_professional_user(p_professional_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salon_id uuid;
begin
  select salon_id into v_salon_id from public.professionals where id = p_professional_id;
  if v_salon_id is null or not public.has_salon_role(v_salon_id, '{admin}') then
    raise exception 'Profissional não encontrado.';
  end if;
  if p_user_id is not null and not exists (
    select 1 from public.salon_members
    where salon_id = v_salon_id and user_id = p_user_id and active
  ) then
    raise exception 'Pessoa não faz parte da equipe.';
  end if;

  update public.professionals set user_id = p_user_id where id = p_professional_id;
end;
$$;

-- Taxa que vale para o serviço: sobrescrita, senão a padrão, senão 0.
create or replace function public.commission_percent_for(p_professional_id uuid, p_service_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select percent from public.commission_rates where professional_id = p_professional_id and service_id = p_service_id),
    (select percent from public.commission_rates where professional_id = p_professional_id and service_id is null),
    0
  );
$$;

revoke execute on function public.save_professional(uuid, text, text, numeric, uuid, boolean) from public, anon;
revoke execute on function public.link_professional_user(uuid, uuid) from public, anon;
revoke execute on function public.commission_percent_for(uuid, uuid) from public, anon;
grant execute on function public.save_professional(uuid, text, text, numeric, uuid, boolean) to authenticated;
grant execute on function public.link_professional_user(uuid, uuid) to authenticated;
grant execute on function public.commission_percent_for(uuid, uuid) to authenticated;
