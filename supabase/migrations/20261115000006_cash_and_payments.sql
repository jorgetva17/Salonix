-- Salonix · Fase 4 · Atendimento, caixa, pagamentos e comissões

create type public.payment_method as enum ('cash', 'debit', 'credit', 'pix');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  opened_by uuid references auth.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  opening_cents integer not null check (opening_cents >= 0),
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  expected jsonb,
  counted jsonb,
  difference_cents integer,
  unique (id, salon_id),
  check ((closed_at is null) = (counted is null))
);
-- Uma sessão aberta por salão.
create unique index cash_sessions_one_open on public.cash_sessions (salon_id) where closed_at is null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text not null default 'service',
  description text not null default '',
  amount_cents integer not null check (amount_cents > 0),
  payment_method public.payment_method,
  status text not null default 'paid' check (status in ('pending', 'paid', 'reversed')),
  due_date date,
  paid_at timestamptz,
  appointment_id uuid,
  cash_session_id uuid,
  reverses_id uuid references public.transactions (id),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, salon_id),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete restrict,
  foreign key (cash_session_id, salon_id) references public.cash_sessions (id, salon_id) on delete restrict
);
create index transactions_session_idx on public.transactions (cash_session_id);
create index transactions_appointment_idx on public.transactions (appointment_id);
create index transactions_salon_paid_idx on public.transactions (salon_id, paid_at);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  appointment_id uuid not null,
  item_id uuid references public.appointment_items (id) on delete restrict,
  professional_id uuid not null,
  base_cents integer not null check (base_cents >= 0),
  percent numeric(5, 2) not null check (percent between 0 and 100),
  amount_cents integer not null check (amount_cents >= 0),
  reference_month date not null,
  status text not null default 'available' check (status in ('blocked', 'available', 'paid', 'reversed')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (appointment_id, salon_id) references public.appointments (id, salon_id) on delete restrict,
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete restrict
);
create index commissions_pro_month_idx on public.commissions (professional_id, reference_month);
create index commissions_appointment_idx on public.commissions (appointment_id);

create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger commissions_set_updated_at before update on public.commissions
  for each row execute function public.set_updated_at();

alter table public.cash_sessions enable row level security;
alter table public.transactions enable row level security;
alter table public.commissions enable row level security;

-- Caixa e lançamentos: admin e recepção. Comissões: admin e o próprio profissional.
create policy cash_sessions_select on public.cash_sessions for select to authenticated
  using (public.has_salon_role(salon_id, array['admin', 'reception']::public.salon_role[]));
create policy transactions_select on public.transactions for select to authenticated
  using (public.has_salon_role(salon_id, array['admin', 'reception']::public.salon_role[]));
create policy commissions_select on public.commissions for select to authenticated
  using (
    public.has_salon_role(salon_id, array['admin']::public.salon_role[])
    or (public.is_salon_member(salon_id) and professional_id = public.my_professional_id(salon_id))
  );

grant select on public.cash_sessions, public.transactions, public.commissions to authenticated;
grant all on public.cash_sessions, public.transactions, public.commissions to service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public._can_serve(p_salon_id uuid, p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_salon_role(p_salon_id, array['admin', 'reception']::public.salon_role[])
      or (p_professional_id is not null and p_professional_id = public.my_professional_id(p_salon_id));
$$;

create function public._recalc_total(p_appointment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.appointments a
  set total_cents = coalesce((select sum(i.unit_price_cents * i.quantity) from public.appointment_items i where i.appointment_id = a.id), 0)
  where a.id = p_appointment_id;
$$;

-- Valores esperados no caixa por forma de pagamento (dinheiro inclui o troco inicial).
create function public._cash_expected(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from public.cash_sessions where id = p_session_id),
  net as (
    select t.payment_method as m,
           sum(case when t.type = 'income' and t.status = 'paid' then t.amount_cents
                    when t.type = 'expense' and t.category = 'refund' and t.status = 'paid' then -t.amount_cents
                    else 0 end) as v
    from public.transactions t
    where t.cash_session_id = p_session_id
    group by t.payment_method
  )
  select jsonb_build_object(
    'cash', coalesce((select opening_cents from s), 0) + coalesce((select v from net where m = 'cash'), 0),
    'debit', coalesce((select v from net where m = 'debit'), 0),
    'credit', coalesce((select v from net where m = 'credit'), 0),
    'pix', coalesce((select v from net where m = 'pix'), 0),
    'pending_pix', coalesce((select sum(t.amount_cents) from public.transactions t
        where t.cash_session_id = p_session_id and t.type = 'income' and t.status = 'pending' and t.payment_method = 'pix'), 0)
  );
$$;

-- ---------------------------------------------------------------------------
-- Itens e conclusão do atendimento
-- ---------------------------------------------------------------------------
create function public.add_appointment_item(p_appointment_id uuid, p_service_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_service public.services;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Atendimento não encontrado'; end if;
  if not public._can_serve(v_appt.salon_id, v_appt.professional_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_appt.status not in ('in_progress', 'awaiting_payment') then
    raise exception 'Só é possível alterar itens de atendimentos em andamento ou aguardando pagamento';
  end if;
  select * into v_service from public.services s where s.id = p_service_id and s.salon_id = v_appt.salon_id and s.active;
  if not found then raise exception 'Serviço não encontrado ou inativo'; end if;

  insert into public.appointment_items (appointment_id, salon_id, item_type, service_id, description, quantity, unit_price_cents, duration_minutes, professional_id)
  values (v_appt.id, v_appt.salon_id, 'service', v_service.id, v_service.name, 1, v_service.price_cents, v_service.duration_minutes, v_appt.professional_id);
  perform public._recalc_total(v_appt.id);
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'item_added', jsonb_build_object('service_id', v_service.id, 'price_cents', v_service.price_cents));
  select * into v_appt from public.appointments where id = v_appt.id;
  return v_appt;
end;
$$;

create function public.remove_appointment_item(p_item_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.appointment_items;
  v_appt public.appointments;
begin
  select * into v_item from public.appointment_items where id = p_item_id;
  if not found then raise exception 'Item não encontrado'; end if;
  select * into v_appt from public.appointments where id = v_item.appointment_id for update;
  if not public._can_serve(v_appt.salon_id, v_appt.professional_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_appt.status not in ('in_progress', 'awaiting_payment') then
    raise exception 'Só é possível alterar itens de atendimentos em andamento ou aguardando pagamento';
  end if;
  if (select count(*) from public.appointment_items i where i.appointment_id = v_appt.id) <= 1 then
    raise exception 'O atendimento precisa ter pelo menos um item';
  end if;
  delete from public.appointment_items where id = p_item_id;
  perform public._recalc_total(v_appt.id);
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'item_removed', jsonb_build_object('description', v_item.description));
  select * into v_appt from public.appointments where id = v_appt.id;
  return v_appt;
end;
$$;

create function public.complete_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Atendimento não encontrado'; end if;
  if not public._can_serve(v_appt.salon_id, v_appt.professional_id) then
    raise exception 'Sem permissão para concluir este atendimento' using errcode = '42501';
  end if;
  if v_appt.status <> 'in_progress' then
    raise exception 'Só é possível concluir atendimentos em andamento';
  end if;
  update public.appointments set status = 'awaiting_payment' where id = v_appt.id returning * into v_appt;
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'completed', jsonb_build_object('total_cents', v_appt.total_cents));
  return v_appt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Caixa
-- ---------------------------------------------------------------------------
create function public.open_cash_session(p_salon_id uuid, p_opening_cents integer)
returns public.cash_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_sessions;
begin
  if (select auth.uid()) is null then raise exception 'Não autenticado' using errcode = '28000'; end if;
  if not public.has_salon_role(p_salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão para abrir o caixa' using errcode = '42501';
  end if;
  if p_opening_cents is null or p_opening_cents < 0 then raise exception 'Valor inicial inválido'; end if;
  begin
    insert into public.cash_sessions (salon_id, opened_by, opening_cents)
    values (p_salon_id, (select auth.uid()), p_opening_cents)
    returning * into v_session;
  exception when unique_violation then
    raise exception 'Já existe um caixa aberto neste salão';
  end;
  return v_session;
end;
$$;

create function public.cash_session_summary(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_salon uuid;
begin
  select salon_id into v_salon from public.cash_sessions where id = p_session_id;
  if v_salon is null or not public.has_salon_role(v_salon, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return public._cash_expected(p_session_id);
end;
$$;

create function public.close_cash_session(p_session_id uuid, p_counted jsonb)
returns public.cash_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_sessions;
  v_expected jsonb;
  v_counted jsonb;
  v_exp_total integer;
  v_cnt_total integer;
begin
  select * into v_session from public.cash_sessions where id = p_session_id for update;
  if not found then raise exception 'Caixa não encontrado'; end if;
  if not public.has_salon_role(v_session.salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão para fechar o caixa' using errcode = '42501';
  end if;
  if v_session.closed_at is not null then raise exception 'Este caixa já está fechado'; end if;

  v_counted := jsonb_build_object(
    'cash', coalesce((p_counted ->> 'cash')::integer, 0),
    'debit', coalesce((p_counted ->> 'debit')::integer, 0),
    'credit', coalesce((p_counted ->> 'credit')::integer, 0),
    'pix', coalesce((p_counted ->> 'pix')::integer, 0));
  if exists (select 1 from jsonb_each_text(v_counted) e where e.value::integer < 0) then
    raise exception 'Valores contados não podem ser negativos';
  end if;
  v_expected := public._cash_expected(p_session_id);
  v_exp_total := (v_expected ->> 'cash')::integer + (v_expected ->> 'debit')::integer + (v_expected ->> 'credit')::integer + (v_expected ->> 'pix')::integer;
  v_cnt_total := (v_counted ->> 'cash')::integer + (v_counted ->> 'debit')::integer + (v_counted ->> 'credit')::integer + (v_counted ->> 'pix')::integer;

  update public.cash_sessions
  set closed_at = now(), closed_by = (select auth.uid()), expected = v_expected, counted = v_counted,
      difference_cents = v_cnt_total - v_exp_total
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

-- ---------------------------------------------------------------------------
-- Receber pagamento (transacional): transações + comissões + status
-- ---------------------------------------------------------------------------
create function public.receive_payment(p_appointment_id uuid, p_payments jsonb, p_discount_cents integer default 0)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_session public.cash_sessions;
  v_due integer;
  v_sum integer := 0;
  v_discount integer := coalesce(p_discount_cents, 0);
  v_pay jsonb;
  v_method text;
  v_amount integer;
  v_has_pix boolean := false;
  v_item record;
  v_pct numeric;
  v_prof uuid;
  v_amt integer;
  v_month date;
  v_tz text;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Atendimento não encontrado'; end if;
  if not public.has_salon_role(v_appt.salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão para receber pagamentos' using errcode = '42501';
  end if;
  if v_appt.status <> 'awaiting_payment' then
    raise exception 'Só é possível receber atendimentos concluídos e ainda não pagos';
  end if;
  select * into v_session from public.cash_sessions c where c.salon_id = v_appt.salon_id and c.closed_at is null;
  if not found then raise exception 'Abra o caixa antes de receber'; end if;
  if v_discount < 0 or v_discount > v_appt.total_cents then raise exception 'Desconto inválido'; end if;
  v_due := v_appt.total_cents - v_discount;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then raise exception 'Informe as formas de pagamento'; end if;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    v_method := v_pay ->> 'method';
    v_amount := (v_pay ->> 'amount_cents')::integer;
    if v_method not in ('cash', 'debit', 'credit', 'pix') or v_amount is null or v_amount <= 0 then
      raise exception 'Pagamento inválido';
    end if;
    v_sum := v_sum + v_amount;
    if v_method = 'pix' then v_has_pix := true; end if;
  end loop;
  if v_sum <> v_due then
    raise exception 'A soma dos pagamentos deve ser igual ao valor a receber';
  end if;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    insert into public.transactions (salon_id, type, category, description, amount_cents, payment_method, status, paid_at, appointment_id, cash_session_id, created_by)
    values (v_appt.salon_id, 'income', 'service', 'Atendimento', (v_pay ->> 'amount_cents')::integer, (v_pay ->> 'method')::public.payment_method,
      case when v_pay ->> 'method' = 'pix' then 'pending' else 'paid' end,
      case when v_pay ->> 'method' = 'pix' then null else now() end,
      v_appt.id, v_session.id, (select auth.uid()));
  end loop;

  update public.appointments set status = 'paid', discount_cents = v_discount where id = v_appt.id returning * into v_appt;

  select s.timezone into v_tz from public.salons s where s.id = v_appt.salon_id;
  v_month := date_trunc('month', now() at time zone v_tz)::date;
  for v_item in
    select * from public.appointment_items i where i.appointment_id = v_appt.id and i.item_type = 'service'
  loop
    v_prof := coalesce(v_item.professional_id, v_appt.professional_id);
    continue when v_prof is null;
    select coalesce(
      (select c.commission_percent from public.professional_service_commissions c where c.professional_id = v_prof and c.service_id = v_item.service_id),
      (select d.commission_percent from public.professional_default_commissions d where d.professional_id = v_prof),
      0) into v_pct;
    v_amt := round(v_item.unit_price_cents * v_item.quantity * v_pct / 100.0)::integer;
    continue when v_amt = 0;
    insert into public.commissions (salon_id, appointment_id, item_id, professional_id, base_cents, percent, amount_cents, reference_month, status)
    values (v_appt.salon_id, v_appt.id, v_item.id, v_prof, v_item.unit_price_cents * v_item.quantity, v_pct, v_amt, v_month,
      case when v_has_pix then 'blocked' else 'available' end);
  end loop;

  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'paid',
    jsonb_build_object('payments', p_payments, 'discount_cents', v_discount, 'total_cents', v_appt.total_cents));
  return v_appt;
end;
$$;

create function public.confirm_pix(p_transaction_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then raise exception 'Lançamento não encontrado'; end if;
  if not public.has_salon_role(v_tx.salon_id, array['admin', 'reception']::public.salon_role[]) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_tx.payment_method <> 'pix' or v_tx.status <> 'pending' or v_tx.type <> 'income' then
    raise exception 'Este lançamento não é um Pix pendente';
  end if;
  update public.transactions set status = 'paid', paid_at = now() where id = v_tx.id returning * into v_tx;
  if v_tx.appointment_id is not null and not exists (
    select 1 from public.transactions t
    where t.appointment_id = v_tx.appointment_id and t.status = 'pending' and t.payment_method = 'pix'
  ) then
    update public.commissions set status = 'available'
    where appointment_id = v_tx.appointment_id and status = 'blocked';
  end if;
  return v_tx;
end;
$$;

-- Estorno (admin): inverte receitas, comissões e cancela o atendimento.
create function public.reverse_appointment(p_appointment_id uuid, p_reason text default '')
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_session public.cash_sessions;
  v_tx public.transactions;
  v_paid_commission integer;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Atendimento não encontrado'; end if;
  if not public.has_salon_role(v_appt.salon_id, array['admin']::public.salon_role[]) then
    raise exception 'Só o administrador pode estornar' using errcode = '42501';
  end if;
  if v_appt.status <> 'paid' then raise exception 'Só é possível estornar atendimentos pagos'; end if;
  select * into v_session from public.cash_sessions c where c.salon_id = v_appt.salon_id and c.closed_at is null;
  if not found then raise exception 'Abra o caixa antes de estornar'; end if;

  for v_tx in
    select * from public.transactions t
    where t.appointment_id = v_appt.id and t.type = 'income' and t.status in ('paid', 'pending') for update
  loop
    update public.transactions set status = 'reversed' where id = v_tx.id;
    if v_tx.status = 'paid' then
      insert into public.transactions (salon_id, type, category, description, amount_cents, payment_method, status, paid_at, appointment_id, cash_session_id, reverses_id, created_by)
      values (v_tx.salon_id, 'expense', 'refund', 'Estorno de atendimento', v_tx.amount_cents, v_tx.payment_method, 'paid', now(),
        v_appt.id, v_session.id, v_tx.id, (select auth.uid()));
    end if;
  end loop;

  select coalesce(sum(c.amount_cents), 0) into v_paid_commission
  from public.commissions c where c.appointment_id = v_appt.id and c.status = 'paid';
  update public.commissions set status = 'reversed' where appointment_id = v_appt.id and status <> 'reversed';

  update public.appointments set status = 'cancelled' where id = v_appt.id returning * into v_appt;
  perform public._log_appointment_event(v_appt.id, v_appt.salon_id, 'reversed',
    jsonb_build_object('reason', coalesce(p_reason, ''), 'commission_already_paid_cents', v_paid_commission));
  return v_appt;
end;
$$;

-- Marca comissões do mês como pagas (admin), opcionalmente gerando a despesa.
create function public.pay_commissions(p_salon_id uuid, p_professional_id uuid, p_month date, p_create_expense boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_count integer;
  v_name text;
begin
  if not public.has_salon_role(p_salon_id, array['admin']::public.salon_role[]) then
    raise exception 'Só o administrador paga comissões' using errcode = '42501';
  end if;
  with paid as (
    update public.commissions c
    set status = 'paid', paid_at = now()
    where c.salon_id = p_salon_id and c.professional_id = p_professional_id
      and c.reference_month = date_trunc('month', p_month)::date and c.status = 'available'
    returning c.amount_cents
  )
  select coalesce(sum(amount_cents), 0), count(*) into v_total, v_count from paid;
  if v_count = 0 then raise exception 'Não há comissões disponíveis para pagar neste mês'; end if;

  if p_create_expense then
    select p.name into v_name from public.professionals p where p.id = p_professional_id;
    insert into public.transactions (salon_id, type, category, description, amount_cents, status, paid_at, created_by)
    values (p_salon_id, 'expense', 'commission', 'Comissão de ' || coalesce(v_name, 'profissional') || ' (' || to_char(date_trunc('month', p_month), 'MM/YYYY') || ')',
      v_total, 'paid', now(), (select auth.uid()));
  end if;
  return jsonb_build_object('paid_cents', v_total, 'count', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------
revoke all on function public._can_serve(uuid, uuid) from public, anon, authenticated;
revoke all on function public._recalc_total(uuid) from public, anon, authenticated;
revoke all on function public._cash_expected(uuid) from public, anon, authenticated;
revoke all on function public.add_appointment_item(uuid, uuid) from public, anon;
revoke all on function public.remove_appointment_item(uuid) from public, anon;
revoke all on function public.complete_appointment(uuid) from public, anon;
revoke all on function public.open_cash_session(uuid, integer) from public, anon;
revoke all on function public.cash_session_summary(uuid) from public, anon;
revoke all on function public.close_cash_session(uuid, jsonb) from public, anon;
revoke all on function public.receive_payment(uuid, jsonb, integer) from public, anon;
revoke all on function public.confirm_pix(uuid) from public, anon;
revoke all on function public.reverse_appointment(uuid, text) from public, anon;
revoke all on function public.pay_commissions(uuid, uuid, date, boolean) from public, anon;
grant execute on function public.add_appointment_item(uuid, uuid) to authenticated, service_role;
grant execute on function public.remove_appointment_item(uuid) to authenticated, service_role;
grant execute on function public.complete_appointment(uuid) to authenticated, service_role;
grant execute on function public.open_cash_session(uuid, integer) to authenticated, service_role;
grant execute on function public.cash_session_summary(uuid) to authenticated, service_role;
grant execute on function public.close_cash_session(uuid, jsonb) to authenticated, service_role;
grant execute on function public.receive_payment(uuid, jsonb, integer) to authenticated, service_role;
grant execute on function public.confirm_pix(uuid) to authenticated, service_role;
grant execute on function public.reverse_appointment(uuid, text) to authenticated, service_role;
grant execute on function public.pay_commissions(uuid, uuid, date, boolean) to authenticated, service_role;
