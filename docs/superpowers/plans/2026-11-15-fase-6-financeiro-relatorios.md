# Salonix — Fase 6 (Financeiro + relatórios) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contas a pagar (lançar, pagar, cancelar, alerta de vencimento); relatório do admin por período com faturamento por forma de pagamento, serviço/produto e profissional, custo real de material por atendimento e comissões; histórico dos caixas fechados; resumo do profissional em "Meus ganhos"; painel do dia no lugar do texto provisório.

**Architecture:** Contas a pagar são `transactions` do tipo `expense` com categoria de conta, escritas só por RPCs `security definer` do admin (`create_bill`, `pay_bill`, `cancel_bill`), como o resto do dinheiro. O relatório é uma RPC `finance_report` que devolve um jsonb já somado no banco, no fuso do salão, a partir de duas colunas novas gravadas no recebimento: `appointments.paid_at` e `appointment_items.net_cents` (valor do item menos a parte dele no desconto). Telas novas ficam em `/financeiro/*`, com abas para o admin; `/financeiro` continua sendo comissões / "Meus ganhos".

**Tech Stack:** o das Fases 1–5. Nenhuma dependência npm nova (sem biblioteca de gráfico: barras em CSS).

**Spec:** `docs/superpowers/specs/2026-11-13-salonix-mvp-design.md` (§2 objetivo 5 e anti-objetivos, §6 `transactions`, §7 Caixa, Comissões e Relatórios, §8 permissões)

Branch: `fase-6-financeiro` (criada a partir de `fase-5-estoque`).

## Global Constraints

- Tudo das Global Constraints das Fases 1–5 continua valendo (pt-BR, centavos inteiros, RLS + pgTAP com isolamento entre salões, guardas com `is not true`, `requireRole` primeiro, `useActionForm`, mensagens exatas das RPCs em `rpc-errors.ts`).
- Permissões (spec §8): financeiro e relatórios só admin; recepção **não** vê relatório, contas nem comissões; profissional vê só os próprios ganhos.
- Anti-objetivo (spec §2): "Totais financeiros com erro de arredondamento" — no relatório, soma por forma de pagamento = soma por serviço + produto = faturamento, sempre em centavos inteiros.
- Categorias de conta (exatas): `aluguel | fornecedor | manutencao | salarios | impostos | outros`, rótulos "Aluguel", "Fornecedor", "Manutenção", "Salários", "Impostos", "Outros". As de sistema (`atendimento`, `estorno`, `comissao`) não são lançadas à mão.
- Dias e meses sempre no fuso do salão (`salons.timezone`), com `src/lib/agenda/time.ts` no TS.
- Mensagens novas das RPCs: `'Categoria inválida.'`, `'Informe a descrição.'`, `'Valor inválido.'`, `'Informe o vencimento.'`, `'Forma de pagamento inválida.'` (já existe), `'Abra o caixa antes de pagar em dinheiro.'`, `'Conta não encontrada.'`, `'Conta não pode mudar deste status.'`, `'Período inválido.'`.

## Review Focus

1. **Estorno em outro mês**: atendimento pago em 31/10 e estornado em 03/11 sai do faturamento de outubro e aparece em "Estornados" de outubro; o relatório de novembro não muda. → pgTAP na Task 3.
2. **Virada do dia no fuso**: atendimento pago às 23:30 de 31/10 em Brasília (02:30 UTC de 01/11) entra em outubro. → pgTAP na Task 3.
3. **Desconto que não divide exato**: três itens (4500 + 3500 + 2000) com desconto 1001 em dinheiro + Pix → por forma, por item e total batem centavo a centavo. → pgTAP na Task 3.
4. **Conta paga duas vezes ou com caixa fechado**: segundo `pay_bill` na mesma conta → 'Conta não pode mudar deste status.'; em dinheiro sem caixa aberto → erro; em Pix com caixa aberto → o esperado do caixa não muda. → pgTAP na Task 1.
5. **Recepção e profissional pela API**: recepção não executa `finance_report` nem as RPCs de conta, não lê aluguel pago por Pix, mas lê a conta paga em dinheiro no caixa aberto (o dinheiro saiu da gaveta que ela confere); profissional não lê transação nenhuma; outro salão não lê nada. → pgTAP nas Tasks 1 e 3. Período digitado na URL inválido (`?de=2026-13-45`, `de` > `ate`, mais de 366 dias) → mês atual. → unit na Task 4.

## Decisões desta fase (corrigíveis)

- **Faturamento = atendimentos recebidos no período e não estornados**, pela data do recebimento (`paid_at`). O que foi estornado sai do faturamento do mês em que foi recebido e aparece numa linha "Estornados" (quantidade e valor). Assim por forma, por item e total sempre fecham.
- Pix pendente conta no faturamento (o serviço foi vendido) e aparece também em "Pix a confirmar".
- Por profissional soma só itens de serviço; produtos aparecem por item, não por profissional.
- Custo de material por atendimento = consumíveis + produtos vendidos, a partir do custo gravado em cada movimento na Fase 5, arredondado por atendimento. O relatório não mostra "lucro": compras de estoque pagas como conta somariam o mesmo custo duas vezes.
- Conta paga **em dinheiro** sai do caixa aberto (exige caixa aberto e entra no esperado); paga em débito, crédito ou Pix fica fora do caixa (`cash_session_id` nulo), porque não passou pela gaveta nem pela maquininha.
- Conta cancelada vira `reversed` (rótulo "Cancelada"); nada é apagado. Só conta pendente é cancelada; conta paga não é desfeita nesta fase.
- A recepção passa a ler transações só de `atendimento`, `estorno` e de contas pagas no caixa (`cash_session_id` preenchido, fora `comissao`).
- Sem conta recorrente, sem anexo, sem exportar CSV, sem gráfico com biblioteca. Manutenção de equipamento e entrada de estoque continuam sem gerar conta automaticamente.
- Painel do dia: atendimentos de hoje por status, fila de walk-in, caixa aberto/fechado (admin/recepção) e, só para o admin, alertas de estoque, manutenção e contas vencidas ou vencendo em 7 dias. O profissional vê os próprios atendimentos de hoje.

## File Structure

```
supabase/migrations/20261118000001_bills.sql            # categorias, RLS da recepção, create/pay/cancel_bill
supabase/migrations/20261118000002_finance_report.sql   # paid_at, net_cents, receive_payment, finance_report
supabase/tests/{bills,finance_report}.test.sql
src/lib/finance/{bills,period}.ts
src/lib/validation/finance.ts
src/app/(app)/financeiro/tabs.tsx
src/app/(app)/financeiro/contas/{page.tsx,actions.ts,bills-client.tsx}
src/app/(app)/financeiro/relatorios/page.tsx
src/app/(app)/financeiro/caixas/page.tsx
src/app/(app)/painel/page.tsx
tests/unit/{finance-bills,finance-period,validation-finance}.test.ts
tests/e2e/{bills,reports,dashboard}.spec.ts
```

---

### Task 1: Contas a pagar no banco

**Files:**
- Create: `supabase/migrations/20261118000001_bills.sql`, `supabase/tests/bills.test.sql`
- Modify: `src/lib/agenda/rpc-errors.ts`, `src/lib/supabase/database.types.ts` (gerado), `supabase/tests/cash.test.sql` (se a mudança de policy quebrar uma asserção, ajuste a asserção, não a policy)

**Interfaces:**
- Produces (SQL):
  - `transactions.category` check ampliado com as seis categorias de conta.
  - Policy de select trocada para: admin tudo; recepção `category in ('atendimento','estorno') or (category <> 'comissao' and cash_session_id is not null)`.
  - `create_bill(p_salon_id uuid, p_category text, p_description text, p_amount_cents integer, p_due_date date, p_paid_method text default null) returns public.transactions`: admin; nasce `expense` `pending` com `due_date`; com `p_paid_method` já nasce paga (mesmas regras do `pay_bill`). Valida na ordem: permissão, categoria, descrição (trim, 2–200), valor > 0, vencimento não nulo.
  - `pay_bill(p_transaction_id uuid, p_method text) returns public.transactions`: trava a linha `for update`; conta de outro salão ou inexistente → 'Conta não encontrada.' (depois da checagem de permissão pelo salão da linha: sem linha → 'Conta não encontrada.'); só `expense` de categoria de conta em `pending`, senão 'Conta não pode mudar deste status.'; `cash` → `open_cash_session_id` (sem caixa → 'Abra o caixa antes de pagar em dinheiro.'); demais formas → `cash_session_id` nulo; grava `method`, `status='paid'`, `paid_at=now()`.
  - `cancel_bill(p_transaction_id uuid) returns public.transactions`: mesmas checagens; `pending` → `reversed`.
  - Execute revogado de `public, anon`, concedido a `authenticated`.

- [ ] **Step 1: Escreva `supabase/tests/bills.test.sql`** no padrão de `cash.test.sql` (helpers `t.*`, salões A e B, admin/recepção/profissional no A). Asserções:
  - admin cria "Aluguel" 150000 vencendo amanhã → `status = 'pending'`, `type = 'expense'`, `method is null`.
  - `throws_ok` para categoria `'comissao'` ('Categoria inválida.'), descrição `' '` ('Informe a descrição.'), valor 0 ('Valor inválido.'), vencimento nulo ('Informe o vencimento.'), forma `'cheque'` no pay ('Forma de pagamento inválida.').
  - pagar em dinheiro sem caixa → 'Abra o caixa antes de pagar em dinheiro.'; abre caixa com 10000; paga "Luz" 8000 em dinheiro → `cash_session_id` = sessão aberta e `cash_session_summary(...)->>'cash'` = `'2000'`.
  - paga "Aluguel" em Pix com caixa aberto → `cash_session_id is null` e o `'pix'` do summary continua `'0'`; segundo `pay_bill` → 'Conta não pode mudar deste status.'; `cancel_bill` da paga → mesma mensagem.
  - `cancel_bill` de pendente → `status = 'reversed'`; `pay_bill` numa transação `atendimento` → 'Conta não pode mudar deste status.'.
  - `create_bill(..., p_paid_method => 'debit')` → nasce `paid` com `paid_at` preenchido.
  - recepção: `create_bill`, `pay_bill`, `cancel_bill` → 'Sem permissão.'; `select category, amount_cents from transactions` mostra a "Luz" paga em dinheiro e não mostra o "Aluguel" nem a conta pendente.
  - profissional lê 0 transações; admin do salão B: `pay_bill` na conta do A → 'Sem permissão.' e lê 0 linhas do A.
  - `insert` direto em `transactions` pelo admin → `throws_ok(..., '42501')`.

- [ ] **Step 2:** `npm run db:test` → Expected: FAIL em `bills.test.sql` (funções não existem).
- [ ] **Step 3:** Escreva a migration conforme Interfaces; acrescente as mensagens novas em `rpc-errors.ts`; `npm run db:reset && npm run db:types`.
- [ ] **Step 4:** `npm run db:test` → Expected: PASS em todos os arquivos.
- [ ] **Step 5:** Commit `feat: contas a pagar no banco`.

### Task 2: Tela de contas a pagar

**Files:**
- Create: `src/lib/finance/bills.ts`, `src/lib/validation/finance.ts`, `src/app/(app)/financeiro/tabs.tsx`, `src/app/(app)/financeiro/contas/{page.tsx,actions.ts,bills-client.tsx}`, `tests/unit/{finance-bills,validation-finance}.test.ts`, `tests/e2e/bills.spec.ts`
- Modify: `src/app/(app)/financeiro/page.tsx` (abas para o admin, título "Comissões" mantido), `src/app/(app)/caixa/page.tsx` (rótulo da categoria na lista de lançamentos)

**Interfaces:**
- Consumes: RPCs da Task 1.
- Produces:
  - `BILL_CATEGORIES` (tupla das seis), `BillCategory`, `BILL_CATEGORY_LABELS`, `TRANSACTION_CATEGORY_LABELS` (inclui "Atendimento", "Estorno", "Comissão").
  - `billStatus(bill: { status: string; due_date: string | null }, today: string): "paid" | "cancelled" | "overdue" | "due_soon" | "pending"` — `due_soon` = vence de hoje até hoje + 7 dias; `overdue` = venceu antes de hoje; `BILL_STATUS_LABELS` "Paga", "Cancelada", "Vencida", "Vence em breve", "Em aberto".
  - `billSchema` (Zod): `category` enum, `description` trim 2–200, `amount` reais → `amountCents` > 0 (reuse `parseBRLToCents`), `dueDate` `YYYY-MM-DD`, `paidMethod` enum de `PAYMENT_METHODS` ou vazio → `null`.
  - `FinanceTabs({ current: "comissoes" | "relatorios" | "contas" | "caixas" })`, links `/financeiro`, `/financeiro/relatorios`, `/financeiro/contas`, `/financeiro/caixas` (mesmo estilo de `estoque/tabs.tsx`).
  - Actions: `saveBill(prev, formData): Promise<FormState>`, `payBill(id: string, method: PaymentMethod): Promise<ActionResult>`, `cancelBill(id: string): Promise<ActionResult>`; todas `requireRole(["admin"])`, `revalidatePath("/financeiro/contas")` e `"/caixa"`.

- [ ] **Step 1: Testes unitários.** `finance-bills.test.ts`: com hoje `2026-11-15`, pendente vencendo `2026-11-14` → `overdue`; `2026-11-15` e `2026-11-22` → `due_soon`; `2026-11-23` → `pending`; `paid` → `paid`; `reversed` → `cancelled`. `validation-finance.test.ts`: `"1.500,00"` → 150000; `"0"` → erro "Valor inválido"; descrição `" a "` → erro; `paidMethod: ""` → `null`; categoria `"comissao"` → erro.
- [ ] **Step 2:** `npx vitest run tests/unit/finance-bills.test.ts tests/unit/validation-finance.test.ts` → Expected: FAIL (módulos não existem).
- [ ] **Step 3:** Implemente `bills.ts` e `finance.ts`.
- [ ] **Step 4:** Mesmo comando → Expected: PASS.
- [ ] **Step 5: e2e `bills.spec.ts`** (salão novo via helper, como nas outras specs): admin abre `/financeiro/contas`, vê o estado vazio "Nenhuma conta"; "Nova conta" → Aluguel, "Aluguel novembro", "1.500,00", vencimento hoje → a linha aparece com "Vence em breve" e o resumo `data-testid="bills-open"` mostra "R$ 1.500,00"; lança "Luz" 80,00 já paga em dinheiro com o caixa aberto em 100,00 → em `/caixa` o `expected-cash` mostra "R$ 20,00"; volta e paga o Aluguel em Pix → "Paga"; lança e cancela uma terceira → "Cancelada"; a recepção abrindo `/financeiro/contas` é redirecionada (mesma checagem das outras páginas só de admin).
- [ ] **Step 6:** `npx playwright test tests/e2e/bills.spec.ts` → Expected: FAIL antes das telas.
- [ ] **Step 7:** Implemente a página: resumo (em aberto, vencidas, pagas no mês), filtro por status (`?status=abertas|pagas|todas`, padrão abertas), lista ordenada por vencimento, diálogo "Nova conta" com "Já paga" (escolhe a forma), botões "Pagar" (escolhe a forma, confirma) e "Cancelar" (ConfirmBox). Estados de vazio e erro.
- [ ] **Step 8:** Mesmo comando e `npm run lint && npx tsc --noEmit` → Expected: PASS.
- [ ] **Step 9:** Commit `feat: tela de contas a pagar`.

### Task 3: Relatório no banco

**Files:**
- Create: `supabase/migrations/20261118000002_finance_report.sql`, `supabase/tests/finance_report.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (gerado)

**Interfaces:**
- Produces (SQL):
  - `appointments.paid_at timestamptz` e `appointment_items.net_cents integer` (nulos até o recebimento); backfill na migration: `paid_at` do evento `paid`, `net_cents` com `allocate_discount` na ordem `(created_at, id)`, para os atendimentos já pagos.
  - `receive_payment` recriado a partir da versão de `20261117000004_stock_on_payment.sql`, mudando só: grava `net_cents` de cada item (`unit_price_cents * quantity - v_shares[ord]`) e `paid_at = now()` no update final.
  - `finance_report(p_salon_id uuid, p_from date, p_to date) returns jsonb` (`stable`, `security definer`): admin, senão 'Sem permissão.'; `p_from > p_to` ou mais de 366 dias → 'Período inválido.'. Incluídos = `status = 'paid'`, `refunded_at is null`, `paid_at` em `[p_from, p_to + 1)` no fuso do salão. Chaves:
    ```
    revenue_cents, appointments, discount_cents, services_cents, products_cents,
    by_method: {cash, debit, credit, pix}, pix_pending_cents,
    by_item: [{type, name, quantity, amount_cents}]           -- ordem: amount_cents desc, name
    by_professional: [{name, appointments, amount_cents}]       -- só serviços; ordem: amount_cents desc
    material_cost_cents, commission_cents,
    refunded: {appointments, amount_cents},                     -- pagos no período e depois estornados
    bills_paid_cents,                                           -- contas (categorias de conta) pagas no período
    costs: [{appointment_id, paid_at, label, revenue_cents, material_cost_cents}]  -- até 200, paid_at desc
    ```
    `by_method` soma as entradas `income` dos incluídos (paga ou Pix pendente); `material_cost_cents` = `round(sum(-quantity * coalesce(unit_cost_cents, 0)))` por atendimento, dos movimentos `consumption`/`out`; `commission_cents` = comissões dos incluídos com `reverses_id is null` e `status <> 'reversed'`; `label` = nome do cliente, ou "Venda no balcão".

- [ ] **Step 1: Escreva `finance_report.test.sql`.** Monte dados direto como postgres (padrão de `products.test.sql`), com `paid_at` explícitos, e chame a RPC como admin. Asserções:
  - atendimento com Corte 4500 + Barba 3500 (Paulo, 40%) + Pomada 2000, desconto 1001 (partes 451/350/200 pelo `allocate_discount`), pago com `receive_payment` em 6000 dinheiro + 2999 Pix → `net_cents` dos itens, na ordem, = `{4049, 3150, 1800}`; `revenue_cents = 8999`; `discount_cents = 1001`; `by_method->>'cash' = '6000'`, `'pix' = '2999'`, `pix_pending_cents = 2999`; `services_cents = 7199`, `products_cents = 1800`; soma de `by_item[*].amount_cents = 8999`; `paid_at` preenchido.
  - item com consumível 10 ml a custo 3 centavos/ml × quantidade 1 e pomada a custo 1200 → `material_cost_cents = 1230`.
  - virada do dia: atendimento com `paid_at = '2026-11-01 02:30+00'` entra em `finance_report(A, '2026-10-01', '2026-10-31')` e não entra em novembro.
  - estorno: atendimento pago em `'2026-10-31 15:00-03'` e com `refunded_at` em `'2026-11-03'` → fora de `revenue_cents` de outubro, em `refunded->>'appointments' = '1'`; relatório de novembro sem ele.
  - conta "Luz" paga no período → `bills_paid_cents`; conta pendente não entra.
  - `p_from > p_to` e período de 400 dias → 'Período inválido.'; recepção e profissional → 'Sem permissão.'; admin do salão B pedindo o A → 'Sem permissão.'.
  - `execute` direto em `allocate_discount`/helpers continua revogado (não mude grants existentes).
- [ ] **Step 2:** `npm run db:test` → Expected: FAIL em `finance_report.test.sql`.
- [ ] **Step 3:** Escreva a migration; `npm run db:reset && npm run db:types`.
- [ ] **Step 4:** `npm run db:test` → Expected: PASS em todos os arquivos (os testes de pagamento das Fases 4–5 continuam verdes com o `receive_payment` recriado).
- [ ] **Step 5:** Commit `feat: relatório financeiro no banco`.

### Task 4: Tela de relatórios e "Meus ganhos"

**Files:**
- Create: `src/lib/finance/period.ts`, `src/app/(app)/financeiro/relatorios/page.tsx`, `tests/unit/finance-period.test.ts`, `tests/e2e/reports.spec.ts`
- Modify: `src/app/(app)/financeiro/page.tsx` (resumo do profissional)

**Interfaces:**
- Consumes: `finance_report` (Task 3), `FinanceTabs` (Task 2).
- Produces: `resolvePeriod(params: { de?: string; ate?: string }, today: string): { from: string; to: string }` — datas `YYYY-MM-DD` válidas, `from <= to`, até 366 dias; qualquer outra coisa → do dia 1 do mês de `today` até o último dia desse mês. `PERIOD_PRESETS(today)`: "Hoje", "Este mês", "Mês passado", "Últimos 30 dias" → `{ label, from, to }`.

- [ ] **Step 1: `finance-period.test.ts`.** Hoje `2026-11-15`: sem params → `2026-11-01`..`2026-11-30`; `de=2026-10-01&ate=2026-10-31` → mantém; `de=2026-13-45` → mês atual; `de` > `ate` → mês atual; 2025-01-01..2026-11-15 → mês atual; presets "Mês passado" → `2026-10-01`..`2026-10-31`, "Últimos 30 dias" → `2026-10-17`..`2026-11-15`; fevereiro de 2028 termina em `2028-02-29`.
- [ ] **Step 2:** `npx vitest run tests/unit/finance-period.test.ts` → Expected: FAIL.
- [ ] **Step 3:** Implemente `period.ts` (use `addDays` e `addMonths` de `src/lib/agenda/time.ts`; `addMonths` recebe `YYYY-MM`).
- [ ] **Step 4:** Mesmo comando → Expected: PASS.
- [ ] **Step 5: e2e `reports.spec.ts`**: salão novo, um serviço, abre o caixa, cria e recebe um atendimento de R$ 45,00 em dinheiro (helpers de `cash-helpers.ts` / `agenda-helpers.ts`); admin em `/financeiro/relatorios` vê `data-testid="report-revenue"` "R$ 45,00", a forma "Dinheiro" com "R$ 45,00", o serviço na lista por item e o profissional; com `?de=2020-01-01&ate=2020-01-31` vê o estado vazio "Nada recebido neste período"; a recepção é redirecionada; o profissional em `/financeiro` vê `data-testid="my-summary"` com "1 atendimento" e o valor dos serviços.
- [ ] **Step 6:** `npx playwright test tests/e2e/reports.spec.ts` → Expected: FAIL.
- [ ] **Step 7:** Implemente a página (só admin): atalhos de período + dois `type="date"` num `<form method="get">`; cartões de faturamento, atendimentos, ticket médio (`revenue / appointments`, arredondado), descontos, estornados, Pix a confirmar, custo de material, comissões, contas pagas; seções "Por forma de pagamento" (barras CSS com a porcentagem), "Por serviço e produto", "Por profissional", "Custo por atendimento" (`<details>`, com o link para a agenda do dia como na Fase 5). Em "Meus ganhos", acima da lista: quantidade de atendimentos do profissional no mês e soma dos `base_cents` das próprias comissões não estornadas.
- [ ] **Step 8:** Mesmo comando, `npm run lint && npx tsc --noEmit` → Expected: PASS.
- [ ] **Step 9:** Commit `feat: relatórios do financeiro`.

### Task 5: Histórico de caixas

**Files:**
- Create: `src/app/(app)/financeiro/caixas/page.tsx`
- Modify: `tests/e2e/cash.spec.ts` (um teste novo no fim)

**Interfaces:**
- Consumes: `cash_sessions` (leitura do admin pela RLS da Fase 4), `resolvePeriod` (Task 4), `FinanceTabs`.

- [ ] **Step 1: e2e** em `cash.spec.ts`: depois de abrir com 100,00, receber 45,00 em dinheiro e fechar contando 140,00, o admin em `/financeiro/caixas` vê uma linha `data-testid="closed-session"` com esperado "R$ 145,00", contado "R$ 140,00" e diferença "-R$ 5,00" destacada; o detalhe (`<details>`) mostra as quatro formas.
- [ ] **Step 2:** `npx playwright test tests/e2e/cash.spec.ts` → Expected: FAIL no teste novo.
- [ ] **Step 3:** Implemente a página (só admin): sessões fechadas com `closed_at` no período (mesmos atalhos), mais recentes primeiro; totais a partir de `expected`/`counted` gravados; nome de quem abriu e fechou quando a leitura de `profiles` permitir, senão omitido; estado vazio "Nenhum caixa fechado neste período".
- [ ] **Step 4:** Mesmo comando → Expected: PASS.
- [ ] **Step 5:** Commit `feat: histórico de caixas fechados`.

### Task 6: Painel do dia

**Files:**
- Modify: `src/app/(app)/painel/page.tsx`
- Create: `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `billStatus` (Task 2), `stockStatus` (`src/lib/inventory/status.ts`), `maintenanceStatus` (`src/lib/equipment/status.ts`), `localDayRange`/`todayIn` (`src/lib/agenda/time.ts`).

- [ ] **Step 1: e2e `dashboard.spec.ts`**: com o seed (`npm run db:reset` antes da suíte), o admin em `/painel` vê os cartões `dashboard-today` (atendimentos de hoje), `dashboard-queue` (na fila), `dashboard-cash` ("Caixa aberto" ou "Caixa fechado") e `dashboard-alerts` com links para `/estoque`, `/estoque/equipamentos` e `/financeiro/contas` quando houver alerta; a recepção vê hoje, fila e caixa, sem alertas; o profissional vê só os próprios atendimentos de hoje e não vê caixa.
- [ ] **Step 2:** `npx playwright test tests/e2e/dashboard.spec.ts` → Expected: FAIL.
- [ ] **Step 3:** Implemente o painel com consultas pela RLS (o profissional já só enxerga os próprios atendimentos); contagens por status de hoje no fuso do salão; cada cartão leva à tela correspondente; estado vazio quando não há nada hoje. Remova o texto provisório.
- [ ] **Step 4:** Mesmo comando e `tests/e2e/layout.spec.ts` (se ele procura o texto antigo, atualize a asserção) → Expected: PASS.
- [ ] **Step 5:** Commit `feat: painel do dia`.

### Task 7: Dados de demonstração e verificação da fase

**Files:**
- Modify: `supabase/seed.sql` (bloco "Financeiro de demonstração (Fase 6)"), `tests/e2e/seed.spec.ts`, `README.md`, `CLAUDE.md`

- [ ] **Step 1:** Em `seed.spec.ts`, teste novo: admin demo vê em `/financeiro/contas` "Aluguel" (vence em 5 dias, "Vence em breve") e "Energia" ("Vencida"), e em `/financeiro/relatorios` um faturamento diferente de "R$ 0,00".
- [ ] **Step 2:** `npm run db:reset && npx playwright test tests/e2e/seed.spec.ts` → Expected: FAIL no teste novo.
- [ ] **Step 3:** Seed: contas Aluguel 2.500,00 (vence em 5 dias), Energia 380,00 (venceu há 2 dias), Fornecedor 640,00 paga em Pix ontem; garanta que os atendimentos pagos do seed da Fase 4 tenham `paid_at` e `net_cents` (o backfill da migration não roda no seed, que é aplicado depois: preencha no próprio insert ou com o mesmo update no fim do bloco).
- [ ] **Step 4:** Mesmo comando → Expected: PASS.
- [ ] **Step 5:** README (seção do financeiro) e CLAUDE.md (Fase 6 concluída; parágrafo "Finance" com contas a pagar, regra de faturamento, `finance_report`, `paid_at`/`net_cents`, leitura da recepção).
- [ ] **Step 6: Verificação completa:** `npm run lint && npx tsc --noEmit && npm test && npm run db:reset && npm run db:test && npm run build && npm run test:e2e` → Expected: tudo PASS.
- [ ] **Step 7:** Commit `feat: dados de demonstração do financeiro e verificação da Fase 6`.
