-- Caixa, transações e comissões. Leitura por RLS; escrita SOMENTE pelas RPCs
-- security definer (migrations seguintes), como em appointments.

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  opened_by uuid references auth.users (id) on delete set null default auth.uid(),
  opened_at timestamptz not null default now(),
  opening_cents integer not null check (opening_cents >= 0),
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  -- Esperado e contado por forma de pagamento, em centavos.
  expected jsonb,
  counted jsonb,
  difference_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id)
);

-- Uma sessão aberta por salão, mesmo com duas recepções abrindo juntas.
create unique index cash_sessions_one_open on public.cash_sessions (salon_id) where closed_at is null;

create trigger cash_sessions_updated_at before update on public.cash_sessions
  for each row execute function public.set_updated_at();

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  -- A Fase 6 amplia as categorias.
  category text not null check (category in ('atendimento', 'estorno', 'comissao')),
  amount_cents integer not null check (amount_cents > 0),
  method text check (method in ('cash', 'debit', 'credit', 'pix')),
  status text not null check (status in ('pending', 'paid', 'reversed')),
  due_date date,
  paid_at timestamptz,
  appointment_id uuid,
  cash_session_id uuid,
  reverses_id uuid,
  description text check (char_length(description) <= 200),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id),
  check (status <> 'paid' or paid_at is not null),
  -- Entrada sempre tem forma de pagamento (contas a pagar da Fase 6 podem nascer sem).
  check (type <> 'income' or method is not null),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id),
  foreign key (cash_session_id, salon_id) references public.cash_sessions (id, salon_id),
  foreign key (reverses_id, salon_id) references public.transactions (id, salon_id)
);

create index transactions_session_idx on public.transactions (salon_id, cash_session_id);
create index transactions_appointment_idx on public.transactions (appointment_id);

create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid not null,
  appointment_item_id uuid not null,
  professional_id uuid not null,
  base_cents integer not null,
  percent numeric(5, 2) not null check (percent between 0 and 100),
  amount_cents integer not null,
  reference_month date not null check (extract(day from reference_month) = 1),
  status text not null check (status in ('blocked', 'available', 'paid', 'reversed')),
  paid_at timestamptz,
  reverses_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id),
  -- Valor negativo só como abatimento de uma comissão já paga e depois estornada.
  check (amount_cents >= 0 or reverses_id is not null),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id),
  foreign key (reverses_id, salon_id) references public.commissions (id, salon_id)
);

-- appointment_items não declara unique (id, salon_id); a FK simples basta, já que
-- appointment_id + salon_id acima prendem a comissão ao salão.
alter table public.commissions
  add foreign key (appointment_item_id) references public.appointment_items (id);

create index commissions_month_idx on public.commissions (salon_id, reference_month, professional_id);
create index commissions_appointment_idx on public.commissions (appointment_id);

create trigger commissions_updated_at before update on public.commissions
  for each row execute function public.set_updated_at();

-- Atendimento estornado continua pago (o serviço aconteceu) e ganha a data do estorno.
alter table public.appointments add column refunded_at timestamptz;

alter table public.appointment_events drop constraint appointment_events_event_check;
alter table public.appointment_events add constraint appointment_events_event_check check (
  event in ('created', 'rescheduled', 'cancelled', 'no_show', 'called', 'started', 'completed',
            'reverted', 'item_added', 'item_removed', 'paid', 'pix_confirmed', 'refunded')
);

-- Autorização ----------------------------------------------------------------

alter table public.cash_sessions enable row level security;
alter table public.transactions enable row level security;
alter table public.commissions enable row level security;

-- Sem escrita pela API: qualquer insert/update/delete direto dá erro de permissão.
revoke insert, update, delete, truncate on public.cash_sessions, public.transactions, public.commissions from authenticated, anon;

create policy "admin e recepção veem o caixa" on public.cash_sessions
  for select to authenticated using (public.has_salon_role(salon_id, '{admin,reception}'));
-- Recepção precisa do caixa e do Pix pendente, não dos ganhos da equipe.
create policy "admin vê transações; recepção sem comissões" on public.transactions
  for select to authenticated using (
    public.has_salon_role(salon_id, '{admin}')
    or (category <> 'comissao' and public.has_salon_role(salon_id, '{reception}'))
  );
create policy "admin ou o próprio profissional veem comissões" on public.commissions
  for select to authenticated using (
    public.has_salon_role(salon_id, '{admin}')
    or coalesce(professional_id = public.my_professional_id(salon_id), false)
  );
