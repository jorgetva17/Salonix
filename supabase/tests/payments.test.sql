begin;
set local search_path to public, extensions;
select plan(40);

create function pg_temp.make_user(p_id uuid, p_email text) returns void language sql as $$
  insert into auth.users (id, email) values (p_id, p_email);
$$;
create function pg_temp.claims(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
    set_config('request.jwt.claim.sub', p_uid::text, true);
$$;
-- cria atendimento em andamento com itens (superusuário, ignora a agenda)
create function pg_temp.make_appt(p_pro uuid, p_services uuid[], p_status public.appointment_status default 'in_progress') returns uuid
language plpgsql as $$
declare v_id uuid; v_total int; v_start timestamptz;
begin
  select now() + count(*) * interval '2 hours' into v_start from public.appointments where professional_id = p_pro;
  select coalesce(sum(price_cents), 0) into v_total from public.services where id = any (p_services);
  insert into public.appointments (salon_id, guest_name, professional_id, kind, status, arrived_at, started_at, starts_at, ends_at, total_cents)
  values (current_setting('t.a')::uuid, 'Cliente', p_pro, 'walk_in', p_status, clock_timestamp(), clock_timestamp(), v_start, v_start + interval '1 hour', v_total)
  returning id into v_id;
  insert into public.appointment_items (appointment_id, salon_id, service_id, description, unit_price_cents, duration_minutes, professional_id)
  select v_id, current_setting('t.a')::uuid, s.id, s.name, s.price_cents, s.duration_minutes, p_pro from public.services s where s.id = any (p_services);
  return v_id;
end $$;

select pg_temp.make_user('00000000-0000-0000-0000-0000000000a1', 'admin-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a2', 'rec-a@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a3', 'paulo@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000a4', 'pedro@t.dev');
select pg_temp.make_user('00000000-0000-0000-0000-0000000000b1', 'admin-b@t.dev');

select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated; select public.create_salon('Salão A'); reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated; select public.create_salon('Salão B'); reset role;
select set_config('t.a', (select id::text from public.salons where name = 'Salão A'), true);

insert into public.salon_members (salon_id, user_id, role) values
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a2', 'reception'),
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a3', 'professional'),
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a4', 'professional');
insert into public.services (id, salon_id, name, duration_minutes, price_cents) values
  ('00000000-0000-0000-0000-0000000000e1', current_setting('t.a')::uuid, 'Corte', 30, 4500),
  ('00000000-0000-0000-0000-0000000000e2', current_setting('t.a')::uuid, 'Barba', 20, 3000),
  ('00000000-0000-0000-0000-0000000000e3', current_setting('t.a')::uuid, 'Especial', 30, 1999);
insert into public.professionals (id, salon_id, user_id, name) values
  ('00000000-0000-0000-0000-0000000000f1', current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a3', 'Paulo'),
  ('00000000-0000-0000-0000-0000000000f2', current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000a4', 'Pedro');
insert into public.professional_default_commissions (salon_id, professional_id, commission_percent) values
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', 40),
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f2', 33.33);
insert into public.professional_service_commissions (salon_id, professional_id, service_id, commission_percent) values
  (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e2', 50);

select set_config('t.a1', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000e1']::uuid[])::text, true);

-- concluir ------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a4');
set local role authenticated;
select throws_ok($$select public.complete_appointment(current_setting('t.a1')::uuid)$$, '42501', null, 'outro profissional não conclui o atendimento');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select is((select status::text from public.complete_appointment(current_setting('t.a1')::uuid)), 'awaiting_payment', 'profissional conclui o próprio atendimento');
select throws_ok($$select public.open_cash_session(current_setting('t.a')::uuid, 0)$$, '42501', null, 'profissional não abre o caixa');
select throws_ok($$select public.receive_payment(current_setting('t.a1')::uuid, '[{"method":"cash","amount_cents":4500}]')$$, '42501', null, 'profissional não recebe pagamento');
reset role;

-- caixa -------------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$select public.receive_payment(current_setting('t.a1')::uuid, '[{"method":"cash","amount_cents":4500}]')$$,
  'P0001', 'Abra o caixa antes de receber', 'receber exige caixa aberto');
select is((select opening_cents from public.open_cash_session(current_setting('t.a')::uuid, 10000)), 10000, 'recepção abre o caixa');
select throws_ok($$select public.open_cash_session(current_setting('t.a')::uuid, 0)$$, 'P0001', 'Já existe um caixa aberto neste salão', 'só um caixa aberto por salão');
select throws_ok($$select public.receive_payment(current_setting('t.a1')::uuid, '[{"method":"cash","amount_cents":4000}]')$$,
  'P0001', 'A soma dos pagamentos deve ser igual ao valor a receber', 'soma dos pagamentos precisa bater');

-- pagamento dividido + comissão ------------------------------------------------------------
select is((select status::text from public.receive_payment(current_setting('t.a1')::uuid,
  '[{"method":"cash","amount_cents":3000},{"method":"debit","amount_cents":1500}]')), 'paid', 'pagamento dividido conclui o atendimento');
select throws_ok($$select public.receive_payment(current_setting('t.a1')::uuid, '[{"method":"cash","amount_cents":4500}]')$$,
  'P0001', 'Só é possível receber atendimentos concluídos e ainda não pagos', 'não recebe duas vezes');
reset role;
select is((select count(*)::int from public.transactions where appointment_id = current_setting('t.a1')::uuid and status = 'paid' and cash_session_id is not null),
  2, 'duas transações pagas ligadas ao caixa');
select is((select amount_cents::text || '/' || status from public.commissions where appointment_id = current_setting('t.a1')::uuid), '1800/available',
  'comissão padrão 40% de R$ 45,00 = R$ 18,00 disponível');

-- Pix pendente: comissão bloqueada, exceção por serviço aplicada ------------------------------
select set_config('t.a2', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2']::uuid[], 'awaiting_payment')::text, true);
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select public.receive_payment(current_setting('t.a2')::uuid, '[{"method":"pix","amount_cents":7500}]');
reset role;
select is((select status from public.transactions where appointment_id = current_setting('t.a2')::uuid), 'pending', 'Pix nasce pendente');
select is((select string_agg(amount_cents::text || '/' || status, ',' order by amount_cents) from public.commissions where appointment_id = current_setting('t.a2')::uuid),
  '1500/blocked,1800/blocked', 'comissões (50% Barba, 40% Corte) ficam bloqueadas até confirmar o Pix');
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is((select status from public.confirm_pix((select id from public.transactions where appointment_id = current_setting('t.a2')::uuid))), 'paid', 'confirmar Pix');
reset role;
select is((select count(*)::int from public.commissions where appointment_id = current_setting('t.a2')::uuid and status = 'available'), 2, 'confirmar Pix libera as comissões');

-- desconto: comissão sobre o valor bruto -----------------------------------------------------
select set_config('t.a3', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000e1']::uuid[], 'awaiting_payment')::text, true);
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$select public.receive_payment(current_setting('t.a3')::uuid, '[{"method":"cash","amount_cents":4500}]', 500)$$,
  'P0001', 'A soma dos pagamentos deve ser igual ao valor a receber', 'com desconto o valor a receber diminui');
select is((select discount_cents from public.receive_payment(current_setting('t.a3')::uuid, '[{"method":"cash","amount_cents":4000}]', 500)), 500, 'desconto aplicado');
reset role;
select is((select base_cents::text || '/' || amount_cents from public.commissions where appointment_id = current_setting('t.a3')::uuid), '4500/1800', 'comissão calculada sobre o valor bruto');

-- arredondamento em centavos ------------------------------------------------------------------
select set_config('t.a4', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f2', array['00000000-0000-0000-0000-0000000000e3']::uuid[], 'awaiting_payment')::text, true);
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select public.receive_payment(current_setting('t.a4')::uuid, '[{"method":"credit","amount_cents":1999}]');
reset role;
select is((select amount_cents from public.commissions where appointment_id = current_setting('t.a4')::uuid), 666, '33,33% de R$ 19,99 = 666,27 centavos -> 666');

-- fechamento --------------------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select is(public.cash_session_summary((select id from public.cash_sessions where closed_at is null)),
  '{"cash": 17000, "debit": 1500, "credit": 1999, "pix": 7500, "pending_pix": 0}'::jsonb, 'esperado por forma de pagamento (dinheiro inclui o troco inicial)');
select is((select difference_cents from public.close_cash_session((select id from public.cash_sessions where closed_at is null),
  '{"cash":16900,"debit":1500,"credit":1999,"pix":7500}')), -100, 'diferença do fechamento = contado - esperado');
select throws_ok($$select public.close_cash_session((select id from public.cash_sessions order by opened_at limit 1), '{}')$$, 'P0001', 'Este caixa já está fechado', 'não fecha duas vezes');
reset role;
select set_config('t.a5', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000e1']::uuid[], 'awaiting_payment')::text, true);
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$select public.receive_payment(current_setting('t.a5')::uuid, '[{"method":"cash","amount_cents":4500}]')$$,
  'P0001', 'Abra o caixa antes de receber', 'após fechar, receber exige novo caixa');

-- estorno ------------------------------------------------------------------------------------------
select public.open_cash_session(current_setting('t.a')::uuid, 5000);
select throws_ok($$select public.reverse_appointment(current_setting('t.a1')::uuid, 'Erro')$$, '42501', null, 'recepção não estorna');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select is((select status::text from public.reverse_appointment(current_setting('t.a1')::uuid, 'Cobrança errada')), 'cancelled', 'admin estorna o atendimento');
select is(public.cash_session_summary((select id from public.cash_sessions where closed_at is null)),
  '{"cash": 2000, "debit": -1500, "credit": 0, "pix": 0, "pending_pix": 0}'::jsonb, 'estorno sai do caixa aberto, por forma de pagamento');
reset role;
select is((select count(*)::int from public.transactions where appointment_id = current_setting('t.a1')::uuid and status = 'reversed' and type = 'income'), 2, 'receitas originais marcadas como estornadas');
select is((select count(*)::int from public.transactions where appointment_id = current_setting('t.a1')::uuid and type = 'expense' and category = 'refund' and reverses_id is not null), 2, 'saídas de estorno criadas');
select is((select status from public.commissions where appointment_id = current_setting('t.a1')::uuid), 'reversed', 'comissão estornada');

-- visibilidade -------------------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select is((select count(*)::int from public.transactions) + (select count(*)::int from public.commissions) + (select count(*)::int from public.cash_sessions), 0, 'outro salão não vê dinheiro nem comissões');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select is((select count(*)::int from public.transactions), 0, 'profissional não vê lançamentos financeiros');
select is((select count(distinct professional_id)::int from public.commissions), 1, 'profissional só vê as próprias comissões');
reset role;

-- pagar comissões ---------------------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select throws_ok($$select public.pay_commissions(current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', current_date, true)$$, '42501', null, 'recepção não paga comissões');
reset role;
select pg_temp.claims('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select is((public.pay_commissions(current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', current_date, true) ->> 'paid_cents')::int, 5100, 'paga as comissões disponíveis do mês (1800+1500+1800)');
select throws_ok($$select public.pay_commissions(current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000f1', current_date, true)$$,
  'P0001', 'Não há comissões disponíveis para pagar neste mês', 'não paga duas vezes');
reset role;

-- itens do atendimento ------------------------------------------------------------------------------
select set_config('t.a6', pg_temp.make_appt('00000000-0000-0000-0000-0000000000f2', array['00000000-0000-0000-0000-0000000000e1']::uuid[])::text, true);
select pg_temp.claims('00000000-0000-0000-0000-0000000000a4');
set local role authenticated;
select is((select total_cents from public.add_appointment_item(current_setting('t.a6')::uuid, '00000000-0000-0000-0000-0000000000e2')), 7500, 'adicionar serviço recalcula o total');
select is((select total_cents from public.remove_appointment_item((select id from public.appointment_items where appointment_id = current_setting('t.a6')::uuid and description = 'Barba'))), 4500, 'remover serviço recalcula o total');
select throws_ok($$select public.remove_appointment_item((select id from public.appointment_items where appointment_id = current_setting('t.a6')::uuid))$$,
  'P0001', 'O atendimento precisa ter pelo menos um item', 'não remove o último item');
select throws_ok($$select public.add_appointment_item(current_setting('t.a4')::uuid, '00000000-0000-0000-0000-0000000000e2')$$,
  'P0001', 'Só é possível alterar itens de atendimentos em andamento ou aguardando pagamento', 'atendimento pago não é editado');
reset role;

select * from finish();
rollback;
