-- Contas a pagar: despesas com categoria de conta e vencimento. Escrita só pelas
-- RPCs do admin abaixo, como o resto do dinheiro.

alter table public.transactions drop constraint transactions_category_check;
alter table public.transactions add constraint transactions_category_check check (
  category in ('atendimento', 'estorno', 'comissao',
               'aluguel', 'fornecedor', 'manutencao', 'salarios', 'impostos', 'outros')
);

create index transactions_due_idx on public.transactions (salon_id, due_date) where status = 'pending';

-- A recepção confere a gaveta: lê entradas, estornos e contas pagas no caixa, mas
-- não comissões nem as demais contas do salão.
drop policy "admin vê transações; recepção sem comissões" on public.transactions;
create policy "admin vê transações; recepção só o que passa pelo caixa" on public.transactions
  for select to authenticated using (
    public.has_salon_role(salon_id, '{admin}')
    or (
      public.has_salon_role(salon_id, '{reception}')
      and category <> 'comissao'
      and (category in ('atendimento', 'estorno') or cash_session_id is not null)
    )
  );

-- Auxiliares internos ----------------------------------------------------------

create or replace function public.is_bill_category(p_category text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_category in ('aluguel', 'fornecedor', 'manutencao', 'salarios', 'impostos', 'outros'), false);
$$;

-- Marca a conta (já travada e pendente) como paga. Dinheiro sai do caixa aberto;
-- as outras formas não passam pela gaveta nem pela maquininha.
create or replace function public.settle_bill(p_bill public.transactions, p_method text)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if p_method is null or p_method not in ('cash', 'debit', 'credit', 'pix') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_method = 'cash' then
    v_session := public.open_cash_session_id(p_bill.salon_id);
    if v_session is null then
      raise exception 'Abra o caixa antes de pagar em dinheiro.';
    end if;
  end if;
  update public.transactions
  set status = 'paid', method = p_method, paid_at = now(), cash_session_id = v_session
  where id = p_bill.id
  returning * into p_bill;
  return p_bill;
end;
$$;

-- Trava a conta e confere salão, permissão e status.
create or replace function public.lock_pending_bill(p_transaction_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.transactions;
begin
  select * into v_bill from public.transactions where id = p_transaction_id for update;
  if v_bill.id is null then
    raise exception 'Conta não encontrada.';
  end if;
  if public.has_salon_role(v_bill.salon_id, '{admin}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if v_bill.type <> 'expense' or not public.is_bill_category(v_bill.category) or v_bill.status <> 'pending' then
    raise exception 'Conta não pode mudar deste status.';
  end if;
  return v_bill;
end;
$$;

revoke execute on function public.is_bill_category(text) from public, anon, authenticated;
revoke execute on function public.settle_bill(public.transactions, text) from public, anon, authenticated;
revoke execute on function public.lock_pending_bill(uuid) from public, anon, authenticated;

-- RPCs ---------------------------------------------------------------------------

create or replace function public.create_bill(
  p_salon_id uuid,
  p_category text,
  p_description text,
  p_amount_cents integer,
  p_due_date date,
  p_paid_method text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.transactions;
begin
  if public.has_salon_role(p_salon_id, '{admin}') is not true then
    raise exception 'Sem permissão.';
  end if;
  if not public.is_bill_category(p_category) then
    raise exception 'Categoria inválida.';
  end if;
  if char_length(coalesce(trim(p_description), '')) not between 2 and 200 then
    raise exception 'Informe a descrição.';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Valor inválido.';
  end if;
  if p_due_date is null then
    raise exception 'Informe o vencimento.';
  end if;

  insert into public.transactions (salon_id, type, category, amount_cents, status, due_date, description)
  values (p_salon_id, 'expense', p_category, p_amount_cents, 'pending', p_due_date, trim(p_description))
  returning * into v_bill;
  if p_paid_method is not null then
    v_bill := public.settle_bill(v_bill, p_paid_method);
  end if;
  return v_bill;
end;
$$;

create or replace function public.pay_bill(p_transaction_id uuid, p_method text)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.settle_bill(public.lock_pending_bill(p_transaction_id), p_method);
end;
$$;

create or replace function public.cancel_bill(p_transaction_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.transactions := public.lock_pending_bill(p_transaction_id);
begin
  update public.transactions set status = 'reversed' where id = v_bill.id returning * into v_bill;
  return v_bill;
end;
$$;

revoke execute on function public.create_bill(uuid, text, text, integer, date, text) from public, anon;
revoke execute on function public.pay_bill(uuid, text) from public, anon;
revoke execute on function public.cancel_bill(uuid) from public, anon;
grant execute on function public.create_bill(uuid, text, text, integer, date, text) to authenticated;
grant execute on function public.pay_bill(uuid, text) to authenticated;
grant execute on function public.cancel_bill(uuid) to authenticated;
