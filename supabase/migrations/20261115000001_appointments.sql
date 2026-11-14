-- Atendimentos (agendados e walk-in), itens e histórico.
-- Leitura por RLS; escrita SOMENTE pelas RPCs security definer (migrations
-- seguintes), que conferem perfil e status e gravam o evento junto.

create extension if not exists btree_gist with schema extensions;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_id uuid not null,
  professional_id uuid,
  kind text not null check (kind in ('scheduled', 'walk_in')),
  status text not null check (
    status in ('scheduled', 'waiting', 'in_progress', 'awaiting_payment', 'paid', 'cancelled', 'no_show')
  ),
  starts_at timestamptz,
  ends_at timestamptz,
  arrived_at timestamptz,
  duration_minutes integer not null check (duration_minutes > 0),
  total_cents integer not null check (total_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  notes text check (char_length(notes) <= 300),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id),
  foreign key (customer_id, salon_id) references public.customers (id, salon_id),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id),
  check (kind <> 'scheduled' or (starts_at is not null and ends_at is not null and professional_id is not null)),
  check (kind <> 'walk_in' or arrived_at is not null),
  check (status not in ('in_progress', 'awaiting_payment') or (professional_id is not null and starts_at is not null)),
  check (ends_at is null or ends_at > starts_at),
  -- Trava no banco: dois agendados ativos do mesmo profissional nunca se sobrepõem,
  -- mesmo com duas recepções gravando ao mesmo tempo. Walk-in não entra na trava.
  constraint appointments_no_overlap exclude using gist (
    professional_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (kind = 'scheduled' and status not in ('cancelled', 'no_show'))
);

create index appointments_salon_starts_idx on public.appointments (salon_id, starts_at);
create index appointments_queue_idx on public.appointments (salon_id, status, arrived_at) where kind = 'walk_in';

create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid not null,
  -- A Fase 5 amplia para 'product'.
  item_type text not null check (item_type = 'service'),
  service_id uuid not null,
  professional_id uuid,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  duration_minutes integer not null check (duration_minutes >= 0),
  created_at timestamptz not null default now(),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id)
);

create index appointment_items_appointment_idx on public.appointment_items (appointment_id);

create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid not null,
  event text not null check (
    event in ('created', 'rescheduled', 'cancelled', 'no_show', 'called', 'started', 'completed')
  ),
  actor uuid references auth.users (id) on delete set null default auth.uid(),
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete cascade
);

create index appointment_events_appointment_idx on public.appointment_events (appointment_id, created_at);

-- Autorização ----------------------------------------------------------------

-- Profissional do salão vinculado ao usuário logado (ou nulo).
create or replace function public.my_professional_id(p_salon_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.professionals p
  where p.salon_id = p_salon_id and p.user_id = auth.uid() and public.is_salon_member(p_salon_id);
$$;

-- Admin e recepção veem tudo; profissional vê os próprios e a fila geral.
create or replace function public.can_see_appointment(
  p_salon_id uuid,
  p_professional_id uuid,
  p_kind text,
  p_status text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_salon_role(p_salon_id, '{admin,reception}')
    or (
      public.has_salon_role(p_salon_id, '{professional}')
      and (
        p_professional_id = public.my_professional_id(p_salon_id)
        or (p_kind = 'walk_in' and p_status = 'waiting' and p_professional_id is null)
      )
    );
$$;

revoke execute on function public.my_professional_id(uuid) from public, anon;
revoke execute on function public.can_see_appointment(uuid, uuid, text, text) from public, anon;
grant execute on function public.my_professional_id(uuid) to authenticated;
grant execute on function public.can_see_appointment(uuid, uuid, text, text) to authenticated;

alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;
alter table public.appointment_events enable row level security;

create policy "quem pode ver o atendimento" on public.appointments
  for select to authenticated using (public.can_see_appointment(salon_id, professional_id, kind, status));
-- Itens e histórico seguem o atendimento (a subconsulta já passa pela RLS acima).
create policy "itens de atendimentos visíveis" on public.appointment_items
  for select to authenticated using (exists (select 1 from public.appointments a where a.id = appointment_id));
create policy "histórico de atendimentos visíveis" on public.appointment_events
  for select to authenticated using (exists (select 1 from public.appointments a where a.id = appointment_id));

-- Realtime: a agenda e a fila atualizam sozinhas (o Realtime respeita a RLS).
alter publication supabase_realtime add table public.appointments;
