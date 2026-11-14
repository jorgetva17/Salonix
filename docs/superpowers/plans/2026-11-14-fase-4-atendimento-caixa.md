# Salonix — Fase 4 (Atendimento + caixa + comissão) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo do atendimento: ajustar itens durante o atendimento, desfazer um início por engano, abrir e fechar o caixa, receber em uma ou mais formas de pagamento (Pix pendente até confirmação manual), gravar a comissão de cada item de serviço, estornar atendimento pago (admin) e mostrar comissões do mês (admin marca como paga; profissional vê só as próprias).

**Architecture:** Três tabelas novas (`cash_sessions`, `transactions`, `commissions`) com RLS **só de leitura**, como `appointments`: toda escrita passa por RPCs `security definer` transacionais que conferem perfil e estado e gravam `appointment_events` junto. Receber é **uma** RPC: transações ligadas ao caixa aberto + comissões + `paid`, tudo ou nada. Os totais do fechamento e a conferência de pagamento têm uma versão TS pura (Vitest) para a tela e a versão SQL que vale (pgTAP).

**Tech Stack:** o das Fases 1–3. Nenhuma dependência npm nova.

**Spec:** `docs/superpowers/specs/2026-11-13-salonix-mvp-design.md` (§6 `cash_sessions`/`transactions`/`commissions`, §7 Atendimento, Correções, Caixa e Comissões, §8 permissões, §10 "totais de caixa", "cálculo de comissão", e2e do fluxo completo, §12 decisões)

Branch: `fase-4-caixa` (criada a partir de `fase-3-agenda`).

## Global Constraints

- Tudo das Global Constraints das Fases 1–3 continua valendo (pt-BR, centavos inteiros, `timestamptz` exibido no fuso do salão, RLS + pgTAP com isolamento entre salões, FK composta `(x_id, salon_id)`, `requireRole` primeiro, `useActionForm`, guardas de permissão com `is not true`/`coalesce` para NULL nunca passar).
- Formas de pagamento (valores exatos): `cash | debit | credit | pix`, rótulos `Dinheiro`, `Débito`, `Crédito`, `Pix`.
- `transactions.type`: `income | expense`; `status`: `pending | paid | reversed`; `category` nesta fase: `atendimento | estorno | comissao` (a Fase 6 amplia).
- `commissions.status`: `blocked | available | paid | reversed`.
- Comissão sobre o valor **bruto** do item (§12: sem descontar taxa de cartão), já com a parte do desconto do atendimento que cabe ao item. Arredondamento só no fim de cada item: `round(base * percent / 100)` (meio para cima). O desconto é repartido entre os itens proporcionalmente ao valor, com o resto em centavos indo para os itens de maior fração (empate: o primeiro item). Nenhuma soma pode ficar 1 centavo fora (§2 anti-objetivo).
- Receber exige caixa aberto; uma sessão aberta por salão (constraint).
- Ações principais em até 2 toques depois de preencher (§2): "Receber" → "Receber R$ X" (Dinheiro vem marcado).
- Mensagens de erro novas das RPCs (o app mostra exatamente estas, somadas às da Fase 3 em `rpc-errors.ts`): `'Abra o caixa antes de receber.'`, `'Já existe um caixa aberto.'`, `'Caixa já fechado.'`, `'Valor pago não confere com o total.'`, `'Desconto maior que o total.'`, `'Atendimento precisa de pelo menos um serviço.'`, `'Pix já confirmado.'`, `'Atendimento já estornado.'`, `'Abra o caixa antes de estornar.'`, `'Informe o motivo do estorno.'`.

## Review Focus

1. **Desconto e comissão com centavos quebrados**: Corte 4500 (40%) + Barba 3500 (50%) com desconto de 1000 → desconto 563/437, comissões 1575 e 1532; soma das transações = 7000, nunca 6999/7001. → pgTAP na Task 4.
2. **Duas recepções recebem o mesmo atendimento juntas**: a segunda recebe 'Atendimento não pode mudar deste status.', nunca duas entradas no caixa. → pgTAP na Task 4 (o `lock_appointment` serializa; o teste roda a segunda chamada depois da primeira e confere 1 conjunto de transações).
3. **Pagamento dividido com Pix**: Dinheiro 4000 + Pix 3000 → o atendimento fica `paid`, a entrada Pix `pending`, a comissão `blocked`; o fechamento mostra o Pix fora do esperado; confirmar o Pix libera a comissão (`available`). → pgTAP na Task 4 e unit na Task 3.
4. **Estorno de atendimento cuja comissão já foi paga ao profissional**: nada some do histórico; entra uma comissão negativa `available` no mês corrente que abate do próximo pagamento. → pgTAP na Task 5.
5. **Recepção e profissional pela API**: recepção não lê `commissions` nem despesas `comissao`; profissional não lê `transactions` nem comissão de colega; ninguém insere direto. → pgTAP na Task 1.

## Decisões desta fase (corrigíveis)

- Estoque, produtos vendidos e `stock_movements` ficam na Fase 5 (as tabelas ainda não existem); o recebimento ganha a baixa lá. `feature_flags` fica para a Fase 6 (só serve à conciliação).
- Ajustar itens = adicionar ou remover serviço (o preço vem do cadastro). Ajuste de preço é pelo desconto na hora de receber. Mudar itens **não** muda a duração nem `ends_at` (estender poderia chocar com o próximo agendado na exclusion constraint).
- Quem ajusta itens: admin/recepção em `in_progress` e `awaiting_payment`; o próprio profissional só em `in_progress`.
- "Desfazer início" (admin/recepção): `in_progress` → `scheduled` (agendado, horário original mantido) ou → `waiting` (walk-in, volta à fila com o mesmo `arrived_at` e a preferência de profissional que tinha). Resolve o "não há como desfazer" deixado pela Fase 3.
- Estornado não muda de status (o serviço aconteceu): continua `paid`, ganha `refunded_at` e o rótulo "Estornado". Estorno exige caixa aberto (o dinheiro sai de alguma gaveta); entradas Pix ainda pendentes viram `reversed` sem saída.
- Comissão de um atendimento com qualquer parte em Pix pendente nasce `blocked` inteira; vira `available` quando não sobra Pix pendente daquele atendimento.
- Mês de referência da comissão = mês local (fuso do salão) do recebimento.
- Recepção lê `transactions` exceto a categoria `comissao` (precisa do caixa e do Pix pendente, não de ganhos da equipe).
- `/financeiro` nesta fase mostra só comissões do mês (admin: todos; profissional: "Meus ganhos"). Faturamento, contas a pagar e relatórios são da Fase 6.
- Pagar comissão gera despesa opcional (§12): com a caixa marcada, uma despesa `comissao` `paid` na forma escolhida, ligada ao caixa aberto se houver.

## File Structure

```
supabase/migrations/20261116000001_cash.sql             # cash_sessions, transactions, commissions, RLS; eventos novos; refunded_at
supabase/migrations/20261116000002_service_rpcs.sql     # itens, desfazer início, item com profissional
supabase/migrations/20261116000003_cash_rpcs.sql        # abrir/fechar caixa
supabase/migrations/20261116000004_payment_rpcs.sql     # receber, confirmar Pix, estornar, pagar comissões
supabase/tests/{cash,service_rpcs,cash_rpcs,payment_rpcs}.test.sql
src/lib/cash/{methods,summary,payments}.ts
src/lib/validation/cash.ts
src/app/(app)/caixa/{page.tsx,actions.ts,cash-client.tsx,payment-dialog.tsx}
src/app/(app)/financeiro/{page.tsx,actions.ts,commissions-client.tsx}
src/app/(app)/agenda/{appointment-sheet.tsx,actions.ts}   # itens, desfazer, receber, estornar
tests/unit/{cash-summary,payments,validation-cash}.test.ts
tests/e2e/{cash,commissions}.spec.ts, tests/e2e/cash-helpers.ts
```

---

### Task 1: Modelo de caixa, transações e comissões

**Files:**
- Create: `supabase/migrations/20261116000001_cash.sql`, `supabase/tests/cash.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (gerado)

**Interfaces:**
- Consumes: `appointments`, `appointment_items`, `professionals`, `my_professional_id` (Fase 3).
- Produces (SQL):
  - `cash_sessions(id, salon_id, opened_by uuid default auth.uid(), opened_at timestamptz default now(), opening_cents int ≥ 0, closed_by uuid null, closed_at timestamptz null, expected jsonb null, counted jsonb null, difference_cents int null, created_at, updated_at)`, `unique (id, salon_id)`; índice único parcial `cash_sessions_one_open on (salon_id) where closed_at is null`.
  - `transactions(id, salon_id, type text, category text, amount_cents int > 0, method text null, status text, due_date date null, paid_at timestamptz null, appointment_id uuid null, cash_session_id uuid null, reverses_id uuid null, description text null ≤ 200, created_by uuid default auth.uid(), created_at, updated_at)`, checks das Global Constraints; `status <> 'paid' or paid_at is not null`; FKs compostas para `appointments`, `cash_sessions` e para a própria `transactions (reverses_id, salon_id)`; índices `(salon_id, cash_session_id)`, `(appointment_id)`.
  - `commissions(id, salon_id, appointment_id, appointment_item_id, professional_id, base_cents int, percent numeric(5,2), amount_cents int, reference_month date check (extract(day from reference_month) = 1), status text, paid_at timestamptz null, reverses_id uuid null, created_at, updated_at)`; `amount_cents` pode ser negativo só quando `reverses_id is not null`; FKs compostas para `appointments`, `appointment_items`, `professionals`; índice `(salon_id, reference_month, professional_id)`.
  - `alter table appointments add column refunded_at timestamptz;` e troca do check de `appointment_events.event` para incluir `'reverted', 'item_added', 'item_removed', 'paid', 'pix_confirmed', 'refunded'`.
  - RLS só de select: `cash_sessions` → admin/recepção; `transactions` → admin, ou recepção com `category <> 'comissao'`; `commissions` → admin, ou o profissional quando `professional_id = my_professional_id(salon_id)` e ele é membro `professional`/admin. Sem policy de escrita. Triggers `set_updated_at`.

- [ ] **Step 1: Failing pgTAP** `cash.test.sql` (inserts de setup como `postgres`): recepção lê a sessão e a entrada `atendimento`, **não** lê a despesa `comissao` nem nenhuma linha de `commissions`; profissional não lê `transactions` e lê só a própria comissão, não a do colega; admin lê tudo; membro de outro salão lê 0 nas três *(Review Focus 5)*; insert direto em `transactions`, `commissions` e `cash_sessions` por admin → `42501`; segunda sessão aberta no mesmo salão → `23505`; sessão aberta em outro salão → aceita; `transactions` `paid` sem `paid_at` → `23514`; `method = 'boleto'` → `23514`; comissão negativa sem `reverses_id` → `23514`; evento `'paid'` aceito.
- [ ] **Step 2:** `npm run db:test` → FAIL (tabelas não existem).
- [ ] **Step 3: Implementar** a migration. **Step 4:** `npm run db:reset && npm run db:types && npm run db:test` → PASS.
- [ ] **Step 5: Commit** `feat: modelo de caixa, transações e comissões com leitura por perfil`.

---

### Task 2: Ajustar itens e desfazer início

**Files:**
- Create: `supabase/migrations/20261116000002_service_rpcs.sql`, `supabase/tests/service_rpcs.test.sql`
- Modify: `src/app/(app)/agenda/{actions.ts,appointment-sheet.tsx}`, `src/lib/agenda/{rpc-errors.ts,status.ts}`, `tests/e2e/agenda.spec.ts`

**Interfaces:**
- Consumes: `lock_appointment`, `can_act_on_appointment`, `services_totals`, `call_next_walk_in` (Fase 3).
- Produces (SQL, `security definer`, `set search_path = ''`, execute só para `authenticated`, evento na mesma transação):
  - `insert_service_items` recriado (`create or replace`) passando a gravar `professional_id` = profissional do atendimento.
  - `add_appointment_item(p_appointment_id uuid, p_service_id uuid, p_professional_id uuid default null) returns public.appointment_items`: permissão conforme Decisões; serviço ativo do salão; profissional do item = `p_professional_id` (ativo, do salão) ou o do atendimento; recalcula `total_cents` = soma de `unit_price_cents * quantity`; evento `item_added` com `data.service_id`.
  - `remove_appointment_item(p_item_id uuid) returns public.appointments`: mesma permissão; recusa o último item de serviço ('Atendimento precisa de pelo menos um serviço.'); recalcula o total; evento `item_removed`.
  - `revert_appointment_start(p_appointment_id uuid) returns public.appointments`: admin/recepção; só `in_progress`; `scheduled` → `scheduled`; `walk_in` → `waiting`, `starts_at`/`ends_at` nulos e `professional_id` = o valor guardado no evento `called` (`data->>'from_professional_id'`, nulo = fila geral); evento `reverted`.
  - `call_next_walk_in` recriado gravando no evento `called` `data = {"from_professional_id": <valor antes da chamada>}` (o resto igual à Fase 3).
- Produces (TS) em `agenda/actions.ts`: `addAppointmentItem(appointmentId: string, serviceId: string): Promise<ActionResult>`, `removeAppointmentItem(itemId: string): Promise<ActionResult>`, `revertAppointmentStart(id: string): Promise<ActionResult>`; `getAppointmentDetails` passa a devolver `items: { id: string; serviceName: string; unitPriceCents: number; quantity: number }[]` e `refundedAt: string | null`. Rótulos de evento novos em `status.ts`: `reverted` "Início desfeito", `item_added` "Serviço adicionado", `item_removed` "Serviço removido", `paid` "Pago", `pix_confirmed` "Pix confirmado", `refunded` "Estornado".
- Painel do atendimento: lista de itens com preço e "Remover" (quando pode ajustar e há mais de 1); "Adicionar serviço" (select de serviços ativos) em `in_progress`/`awaiting_payment`; "Desfazer início" (admin/recepção) em `in_progress`, com confirmação no painel.

- [ ] **Step 1: Failing pgTAP** `service_rpcs.test.sql`: atendimento em curso de 4500 + adicionar Barba → total 8000, item com `professional_id` do atendimento, evento `item_added`; remover a Barba → 4500; remover o único item → 'Atendimento precisa de pelo menos um serviço.'; profissional adiciona no próprio `in_progress` → ok, no `awaiting_payment` → 'Sem permissão.', no de colega → 'Sem permissão.'; serviço de outro salão → 'Serviço inválido.'; em `paid` → 'Atendimento não pode mudar deste status.'; desfazer início de agendado → `scheduled` com o `starts_at` original; walk-in que esperava P2 chamado por P2 e desfeito → `waiting`, `professional_id = P2`, `arrived_at` igual, `starts_at` nulo; walk-in da fila geral desfeito → `professional_id` nulo; profissional tenta desfazer → 'Sem permissão.'; não membro → 'Sem permissão.'; `create_appointment` novo grava `professional_id` nos itens.
- [ ] **Step 2:** `npm run db:test` → FAIL. **Step 3: Implementar** migration, actions e painel. **Step 4:** `npm run db:reset && npm run db:types && npm run db:test` → PASS.
- [ ] **Step 5: e2e** em `agenda.spec.ts`: iniciar o atendimento, "Adicionar serviço" → total do painel soma os dois; "Desfazer início" → status "Agendado" e o bloco continua no mesmo horário.
- [ ] **Step 6:** `npm test && npx playwright test tests/e2e/agenda.spec.ts tests/e2e/walk-in.spec.ts` → PASS.
- [ ] **Step 7: Commit** `feat: ajustar serviços do atendimento e desfazer início`.

---

### Task 3: Abrir e fechar o caixa

**Files:**
- Create: `supabase/migrations/20261116000003_cash_rpcs.sql`, `supabase/tests/cash_rpcs.test.sql`, `src/lib/cash/{methods,summary}.ts`, `src/lib/validation/cash.ts`, `src/app/(app)/caixa/{actions.ts,cash-client.tsx}`, `tests/unit/{cash-summary,validation-cash}.test.ts`, `tests/e2e/cash.spec.ts`, `tests/e2e/cash-helpers.ts`
- Modify: `src/app/(app)/caixa/page.tsx` (substitui o placeholder)

**Interfaces:**
- Consumes: Task 1.
- Produces (SQL):
  - `open_cash_session(p_salon_id uuid, p_opening_cents int) returns public.cash_sessions`: admin/recepção; converte `unique_violation` em 'Já existe um caixa aberto.'.
  - `cash_session_expected(p_session_id uuid) returns jsonb` (interno, sem execute para `authenticated`): `{"cash", "debit", "credit", "pix", "pix_pending"}` em centavos; por forma = entradas `paid` − saídas `paid` da sessão; `cash` soma `opening_cents`; `pix_pending` = entradas Pix `pending` da sessão, fora das formas.
  - `close_cash_session(p_session_id uuid, p_counted jsonb) returns public.cash_sessions`: admin/recepção do salão da sessão; já fechada → 'Caixa já fechado.'; grava `expected` (de `cash_session_expected`), `counted` (as quatro formas, ausente = 0), `difference_cents` = soma contada − soma esperada das quatro formas (sem `pix_pending`), `closed_by`, `closed_at`.
- Produces (TS):
  - `src/lib/cash/methods.ts`: `PAYMENT_METHODS = ["cash", "debit", "credit", "pix"] as const`, `type PaymentMethod`, `PAYMENT_METHOD_LABELS`.
  - `src/lib/cash/summary.ts`: `type CashTx = { type: "income" | "expense"; method: PaymentMethod | null; status: "pending" | "paid" | "reversed"; amountCents: number }`; `cashSummary(openingCents: number, txs: CashTx[]): { expected: Record<PaymentMethod, number>; pixPendingCents: number; totalExpectedCents: number }` com a mesma regra do SQL; `closingDifference(expected: Record<PaymentMethod, number>, counted: Partial<Record<PaymentMethod, number>>): { byMethod: Record<PaymentMethod, number>; totalCents: number }`.
  - `src/lib/validation/cash.ts`: `openCashSchema` (`opening`: texto em reais via `parseBRLToCents`, ≥ 0, erro "Informe o valor inicial"), `closeCashSchema` (um campo por forma, vazio = 0, inválido → "Valor inválido").
  - Actions em `caixa/actions.ts`: `openCashSession(prev: FormState, fd: FormData): Promise<FormState>`, `closeCashSession(prev: FormState, fd: FormData): Promise<FormState>`.
- Página `/caixa` (admin/recepção): sem sessão aberta → card "Caixa fechado" com valor inicial e "Abrir caixa"; com sessão → aberto por/às, esperado por forma (`cashSummary`), linha separada "Pix a confirmar" e "Fechar caixa" (contado por forma, diferença ao vivo por forma e no total, verde/vermelho; confirmação no próprio card). Últimos 5 fechamentos com diferença. `RealtimeRefresh` na página (a assinatura de `appointments` já cobre o recebimento, que muda o status).

- [ ] **Step 1: Failing unit tests:**
  - `cash-summary.test.ts`: abertura 10000 + entrada cash 4500 paid + debit 7000 paid + pix 3500 pending + saída cash 1000 paid + entrada credit 2000 reversed → `expected = { cash: 13500, debit: 7000, credit: 0, pix: 0 }`, `pixPendingCents: 3500`, `totalExpectedCents: 20500` *(Review Focus 3)*; `closingDifference` com contado `{ cash: 13000, debit: 7000 }` → `byMethod.cash = -500`, `credit = 0`, `totalCents = -500`.
  - `validation-cash.test.ts`: `opening ""` → "Informe o valor inicial"; `"100,50"` → 10050; contado `"abc"` → "Valor inválido"; vazio → 0.
- [ ] **Step 2: Failing pgTAP** `cash_rpcs.test.sql`: recepção abre com 10000; abrir de novo → 'Já existe um caixa aberto.'; profissional abre → 'Sem permissão.'; não membro → 'Sem permissão.'; com as transações do unit test inseridas como `postgres`, fechar com `{"cash": 13000, "debit": 7000}` → `expected->>'cash' = '13500'`, `expected->>'pix_pending' = '3500'`, `difference_cents = -500`; fechar de novo → 'Caixa já fechado.'; depois de fechar, abrir de novo → ok; recepção de outro salão fecha → 'Sem permissão.'.
- [ ] **Step 3:** `npm test && npm run db:test` → FAIL. **Step 4: Implementar.** **Step 5:** `npm run db:reset && npm run db:types && npm test && npm run db:test` → PASS.
- [ ] **Step 6: e2e** `cash.spec.ts` (salão novo via `setupSalonWithAgenda`; `cash-helpers.ts` exporta `openCash(page, reais: string)` e `closeCash(page, counted: Partial<Record<"Dinheiro" | "Débito" | "Crédito" | "Pix", string>>)`): abrir com "100,00" → "Dinheiro esperado R$ 100,00"; fechar contando "95,00" → diferença "-R$ 5,00" e o card volta a "Caixa fechado" com o fechamento na lista; `pro@salonix.dev` em `/caixa` é redirecionado.
- [ ] **Step 7:** `npx playwright test tests/e2e/cash.spec.ts` → PASS.
- [ ] **Step 8: Commit** `feat: abrir e fechar o caixa com conferência por forma de pagamento`.

---

### Task 4: Receber pagamento, comissão e Pix pendente

**Files:**
- Create: `supabase/migrations/20261116000004_payment_rpcs.sql`, `supabase/tests/payment_rpcs.test.sql`, `src/lib/cash/payments.ts`, `src/app/(app)/caixa/payment-dialog.tsx`, `tests/unit/payments.test.ts`
- Modify: `src/lib/validation/cash.ts`, `src/app/(app)/caixa/{page.tsx,actions.ts,cash-client.tsx}`, `src/app/(app)/agenda/appointment-sheet.tsx`, `src/lib/agenda/rpc-errors.ts`, `tests/unit/validation-cash.test.ts`, `tests/e2e/cash.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `commission_percent_for(professional_id, service_id)` (Fase 2, interno), `lock_appointment`.
- Produces (SQL, mesma migration, execute só para `authenticated` salvo os internos):
  - `receive_payment(p_appointment_id uuid, p_payments jsonb, p_discount_cents int default 0) returns public.appointments`, com `p_payments = [{"method": "cash", "amount_cents": 4000}, ...]`. Ordem: `lock_appointment` → admin/recepção (`is not true`) → status `awaiting_payment` → caixa aberto do salão ('Abra o caixa antes de receber.') → `0 ≤ desconto ≤ total` ('Desconto maior que o total.') → cada valor > 0, forma válida, soma = total − desconto ('Valor pago não confere com o total.'); total 0 após desconto aceita `[]`. Grava uma entrada `income`/`atendimento` por forma (`pix` → `pending` sem `paid_at`; demais `paid` com `paid_at = now()`), com `appointment_id` e `cash_session_id`; reparte o desconto entre os itens de serviço pela regra das Global Constraints; uma `commissions` por item com `base_cents` = valor do item − parte do desconto, `percent = commission_percent_for(...)`, `amount_cents = round(base * percent / 100)`, `reference_month` = 1º dia do mês local, `status` = `blocked` se houver Pix, senão `available`; grava `discount_cents`, `status = 'paid'`; evento `paid` com `data = {"payments": p_payments, "discount_cents": ...}`.
  - `allocate_discount(p_amounts int[], p_discount int) returns int[]` (interno): a repartição das Global Constraints.
  - `confirm_pix(p_transaction_id uuid) returns public.transactions`: admin/recepção; só `income` `pix` `pending` ('Pix já confirmado.' se não estiver `pending`); `paid`, `paid_at = now()`; se o atendimento não tem mais Pix pendente, as comissões `blocked` dele viram `available`; evento `pix_confirmed`.
- Produces (TS):
  - `src/lib/cash/payments.ts`: `type PaymentLine = { method: PaymentMethod; amountCents: number }`; `paymentProblem(totalCents: number, discountCents: number, lines: PaymentLine[]): string | null` → as mesmas mensagens do SQL ('Desconto maior que o total.', 'Valor pago não confere com o total.'); `remainingCents(totalCents, discountCents, lines): number`.
  - `paymentSchema` em `validation/cash.ts`: `appointmentId: uuid`, `discount` (reais, vazio = 0), `payments` JSON de `{ method, amount }` em reais.
  - Actions em `caixa/actions.ts`: `receivePayment(prev: FormState, fd: FormData): Promise<FormState>`, `confirmPix(transactionId: string): Promise<ActionResult>`.
  - `<PaymentDialog appointment={{ id: string; customerName: string; totalCents: number }} />`: total, desconto (R$), botões de forma (Dinheiro marcado), uma linha por padrão; "Dividir pagamento" acrescenta linhas com "falta R$ X" (`remainingCents`); botão "Receber {formatBRL(total − desconto)}". Sem caixa aberto, o diálogo mostra "Abra o caixa antes de receber." com link para `/caixa`.
- `/caixa` ganha "Aguardando pagamento" (todos os `awaiting_payment` do salão, mais antigos primeiro, com "Receber"), "Pix a confirmar" (com "Confirmar Pix") e "Recebidos nesta sessão". O painel do atendimento ganha "Receber" (admin/recepção) em `awaiting_payment` e, em `paid`, as formas pagas e o desconto.

- [ ] **Step 1: Failing unit tests** `payments.test.ts`: total 7000, desconto 1000, `[cash 6000]` → `null`; `[cash 5000]` → 'Valor pago não confere com o total.' e `remainingCents` 1000; desconto 8000 → 'Desconto maior que o total.'; `[cash 4000, pix 3000]` sem desconto → `null`. `validation-cash.test.ts`: desconto `"10,00"` → 1000.
- [ ] **Step 2: Failing pgTAP** `payment_rpcs.test.sql` (salão com Paulo: padrão 40%, Barba 50%; Corte 4500, Barba 3500; atendimento `awaiting_payment` com os dois itens):
  - sem caixa aberto → 'Abra o caixa antes de receber.';
  - caixa aberto, desconto 1000, `[cash 6000]` → `paid`, `discount_cents = 1000`, 1 transação `paid` de 6000 ligada à sessão, comissões `base_cents` 3937 e 3063, `amount_cents` 1575 e 1532, `available`, `reference_month` = 1º do mês local *(Review Focus 1)*;
  - receber o mesmo de novo → 'Atendimento não pode mudar deste status.' e continua 1 transação *(Review Focus 2)*;
  - outro atendimento, `[cash 4000, pix 3000]` → entrada Pix `pending`, comissões `blocked`; `confirm_pix` → `paid` e comissões `available`; `confirm_pix` de novo → 'Pix já confirmado.' *(Review Focus 3)*;
  - `[cash 5000]` para total 7000 → 'Valor pago não confere com o total.'; desconto 8000 → 'Desconto maior que o total.'; `method = 'boleto'` → 'Valor pago não confere com o total.' (forma inválida cai na mesma conferência);
  - profissional recebe → 'Sem permissão.'; recepção de outro salão → 'Sem permissão.';
  - `allocate_discount('{4500,3500}', 1000)` = `'{563,437}'`; `allocate_discount('{1,1,1}', 2)` = `'{1,1,0}'`; desconto igual ao total → comissões 0.
- [ ] **Step 3:** `npm test && npm run db:test` → FAIL. **Step 4: Implementar.** **Step 5:** `npm run db:reset && npm run db:types && npm test && npm run db:test` → PASS.
- [ ] **Step 6: e2e** em `cash.spec.ts`: agendar, iniciar e concluir um Corte (helpers da Fase 3); com o caixa fechado, "Receber" mostra "Abra o caixa antes de receber."; abrir caixa "100,00"; em `/caixa`, "Receber" → "Receber R$ 45,00" (2 toques) → some de "Aguardando pagamento" e "Dinheiro esperado R$ 145,00"; outro atendimento pago dividido Dinheiro "20,00" + Pix "25,00" → "Pix a confirmar R$ 25,00" fora do esperado; "Confirmar Pix" → "Pix esperado R$ 25,00".
- [ ] **Step 7:** `npx playwright test tests/e2e/cash.spec.ts tests/e2e/agenda.spec.ts` → PASS.
- [ ] **Step 8: Commit** `feat: receber atendimento em uma ou mais formas com comissão e Pix pendente`.

---

### Task 5: Estorno de atendimento pago

**Files:**
- Modify: `supabase/migrations/20261116000004_payment_rpcs.sql`, `supabase/tests/payment_rpcs.test.sql`, `src/app/(app)/caixa/actions.ts`, `src/app/(app)/agenda/appointment-sheet.tsx`, `src/lib/agenda/rpc-errors.ts`, `tests/e2e/cash.spec.ts`

**Interfaces:**
- Consumes: Task 4.
- Produces (SQL): `refund_appointment(p_appointment_id uuid, p_reason text) returns public.appointments`: só admin; só `paid` sem `refunded_at` ('Atendimento já estornado.'); caixa aberto ('Abra o caixa antes de estornar.'); entradas `paid` → `reversed` + uma saída `expense`/`estorno` `paid` de mesmo valor e forma, `reverses_id` = a entrada, no caixa aberto; entradas `pending` → `reversed` sem saída; comissões `blocked`/`available` → `reversed`; comissões `paid` ficam e ganham uma comissão negativa (`amount_cents` = −valor, `reverses_id`, `available`, `reference_month` = mês local atual); `refunded_at = now()`; evento `refunded` com `data.reason`. `reason` obrigatório ('Informe o motivo do estorno.').
- Produces (TS): `refundAppointment(id: string, reason: string): Promise<ActionResult>` em `caixa/actions.ts`. Painel: "Estornar" (só admin) em `paid` sem estorno, pedindo o motivo e confirmando no painel; status mostrado "Pago · Estornado" quando `refundedAt`. Os totais do caixa já refletem a saída pelo `cashSummary`.

- [ ] **Step 1: Failing pgTAP** (acrescentar em `payment_rpcs.test.sql`): estornar o atendimento pago em dinheiro → entrada `reversed`, saída de 6000 `cash` no caixa aberto com `reverses_id`, comissões `reversed`, `refunded_at` preenchido, evento `refunded`; estornar de novo → 'Atendimento já estornado.'; recepção estorna → 'Sem permissão.'; sem caixa aberto → 'Abra o caixa antes de estornar.'; atendimento com Pix ainda pendente estornado → Pix `reversed` e nenhuma saída Pix; atendimento cuja comissão foi marcada `paid` (como `postgres`) estornado → a comissão continua `paid` e existe uma `-1575` `available` com `reverses_id` *(Review Focus 4)*; motivo vazio → 'Informe o motivo do estorno.'; `cash_session_expected` depois do estorno desconta a saída.
- [ ] **Step 2:** `npm run db:test` → FAIL. **Step 3: Implementar.** **Step 4:** `npm run db:reset && npm run db:test` → PASS.
- [ ] **Step 5: e2e** em `cash.spec.ts`: admin abre o atendimento pago na agenda, "Estornar" com motivo "Cobrado em dobro" → status "Pago · Estornado" e o "Dinheiro esperado" do caixa cai R$ 45,00.
- [ ] **Step 6:** `npx playwright test tests/e2e/cash.spec.ts` → PASS.
- [ ] **Step 7: Commit** `feat: estorno de atendimento pago com lançamentos inversos`.

---

### Task 6: Comissões do mês e "Meus ganhos"

**Files:**
- Modify: `supabase/migrations/20261116000004_payment_rpcs.sql`, `supabase/tests/payment_rpcs.test.sql`, `src/lib/agenda/time.ts`, `tests/unit/agenda-time.test.ts`, `supabase/seed.sql`, `tests/e2e/seed.spec.ts`
- Create: `src/app/(app)/financeiro/{actions.ts,commissions-client.tsx}`, `tests/e2e/commissions.spec.ts`
- Modify: `src/app/(app)/financeiro/page.tsx` (substitui o placeholder)

**Interfaces:**
- Consumes: Tasks 4–5.
- Produces (SQL): `pay_commissions(p_salon_id uuid, p_professional_id uuid, p_month date, p_expense_method text default null) returns integer` (total pago em centavos): só admin; marca `paid`, `paid_at = now()` as comissões `available` (inclusive as negativas) daquele profissional e mês; total ≤ 0 → nada muda e retorna 0; com `p_expense_method`, grava uma despesa `comissao` `paid` desse valor, `description` = nome do profissional e mês, no caixa aberto se houver.
- Produces (TS): `monthRange(month: string, timeZone: string): { from: string; to: string }` em `time.ts` (ISO UTC do início do mês local e do seguinte); action `payCommissions(professionalId: string, month: string, expenseMethod: PaymentMethod | null): Promise<ActionResult<{ paidCents: number }>>`.
- Página `/financeiro?mes=YYYY-MM` (admin e profissional, navegação "‹ mês ›", padrão o mês local atual):
  - admin: título "Comissões"; uma linha por profissional com Disponível, Bloqueada (Pix pendente) e Paga, e "Pagar R$ X" (confirmação no card, caixa "Lançar como despesa" com a forma); abre a lista de itens (data, cliente, serviço, base, %, valor, status).
  - profissional: título "Meus ganhos"; só as próprias comissões do mês com os mesmos totais e a lista; sem botão de pagar.

- [ ] **Step 1: Failing unit test** em `agenda-time.test.ts`: `monthRange("2026-11", "America/Sao_Paulo")` → `{ from: "2026-11-01T03:00:00.000Z", to: "2026-12-01T03:00:00.000Z" }`; `monthRange("2026-12", ...)` → `to` `"2027-01-01T03:00:00.000Z"`.
- [ ] **Step 2: Failing pgTAP** (acrescentar): `pay_commissions` do mês de Paulo com 1575 + 1532 `available` e uma −1575 → retorna 1532, as três `paid`; com `'cash'` → uma despesa `comissao` de 1532 no caixa aberto; chamar de novo → 0; recepção → 'Sem permissão.'; profissional → 'Sem permissão.'; comissão `blocked` não é paga.
- [ ] **Step 3:** `npm test && npm run db:test` → FAIL. **Step 4: Implementar.** **Step 5:** `npm run db:reset && npm test && npm run db:test` → PASS.
- [ ] **Step 6: Seed:** caixa aberto pela recepção com 10000; um atendimento de hoje de Paulo (Corte masculino) `paid` em dinheiro naquele caixa com comissão 1800 `available`; um de Marcos (Barba) `paid` com comissão 1750; um walk-in de Diego Souza `awaiting_payment` com Paulo (Barba); eventos correspondentes. Inserir como `postgres`, respeitando checks e o índice de uma sessão aberta.
- [ ] **Step 7: e2e** (o salão demo é só lido, para não quebrar `seed.spec.ts` conforme a ordem dos testes):
  - `seed.spec.ts`: `recepcao@salonix.dev` em `/caixa` vê o caixa aberto com abertura R$ 100,00 e "Diego Souza" em "Aguardando pagamento"; admin em `/financeiro` vê Paulo Profissional com R$ 18,00 disponível.
  - `commissions.spec.ts`: `pro@salonix.dev` em `/financeiro` vê "Meus ganhos" com R$ 18,00 e não vê "Marcos"; `recepcao@salonix.dev` em `/financeiro` é redirecionada; num salão novo (helpers de `cash-helpers.ts`), receber um Corte de R$ 45,00 de um profissional com 40% → `/financeiro` mostra R$ 18,00 disponível → "Pagar R$ 18,00" com "Lançar como despesa" em Dinheiro → aparece como paga e o "Dinheiro esperado" do caixa cai R$ 18,00.
- [ ] **Step 8:** `npm run db:reset && npx playwright test tests/e2e/seed.spec.ts tests/e2e/commissions.spec.ts` → PASS.
- [ ] **Step 9: Commit** `feat: comissões do mês com pagamento pelo admin e meus ganhos`.

---

### Task 7: Fluxo completo e verificação da fase

**Files:**
- Create: `tests/e2e/full-flow.spec.ts`
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: e2e** `full-flow.spec.ts` (§10, salão novo, só pela tela): cadastrar salão → serviço "Corte" 30 min R$ 45,00 → profissional com 40% e jornada todos os dias → abrir caixa "50,00" → "Cliente na porta" com cliente novo → "Chamar próximo" → "Concluir" → "Receber" em Dinheiro → fechar caixa contando "95,00" → diferença "R$ 0,00"; `/financeiro` mostra R$ 18,00 disponível. Este teste junta peças já testadas, então pode passar de primeira; se falhar, a falha é um bug de integração a corrigir com teste na task dona.
- [ ] **Step 2:** `npx playwright test tests/e2e/full-flow.spec.ts` → PASS.
- [ ] **Step 3: Verificação completa:** `npm run lint && npx tsc --noEmit && npm test && npm run db:test && npm run build && npm run db:reset && npm run test:e2e` → tudo PASS (anotar as contagens).
- [ ] **Step 4:** README: caixa, recebimento transacional, Pix pendente e estorno. `CLAUDE.md`: Fase 4 pronta; na arquitetura, "caixa/transações/comissões: leitura por RLS (recepção sem `comissao`), escrita só pelas RPCs `open_cash_session`, `close_cash_session`, `receive_payment`, `confirm_pix`, `refund_appointment`, `pay_commissions`; repartição de desconto em `allocate_discount`; totais da tela em `src/lib/cash/`".
- [ ] **Step 5: Commit** `feat: fluxo completo de atendimento ao fechamento e verificação da Fase 4`.
