# Salonix — Fase 5 (Estoque + equipamentos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estoque com entradas, saídas e ajustes, alerta de mínimo e de negativo; consumo de cada serviço configurável; produtos vendidos no atendimento e no balcão; baixa automática no recebimento e devolução no estorno; equipamentos com histórico de manutenção e aviso da próxima.

**Architecture:** `inventory_items` e `stock_movements` com RLS de leitura para todo membro; a quantidade atual só muda por movimento, gravado por RPC `security definer` (um trigger mantém `inventory_items.quantity` igual à soma dos movimentos). `service_consumables`, `equipment` e `equipment_maintenance` são cadastros simples: escrita do admin por policy, como `services`. A baixa entra dentro do `receive_payment` da Fase 4 (mesma transação) e a devolução dentro do `refund_appointment`. Produto vira `appointment_items.item_type = 'product'`; a venda no balcão é um atendimento `kind = 'sale'` que já nasce aguardando pagamento.

**Tech Stack:** o das Fases 1–4. Nenhuma dependência npm nova.

**Spec:** `docs/superpowers/specs/2026-11-13-salonix-mvp-design.md` (§2 objetivos 3–4, §6 `inventory_items`/`service_consumables`/`stock_movements`/`equipment`/`equipment_maintenance`/`appointment_items`, §7 Atendimento e Correções, §8 permissões, §12 "estoque pode ficar negativo")

Branch: `fase-5-estoque` (criada a partir de `fase-4-caixa`).

## Global Constraints

- Tudo das Global Constraints das Fases 1–4 continua valendo (pt-BR, centavos, RLS + pgTAP com isolamento entre salões, FK composta `(x_id, salon_id)`, guardas com `is not true`/`coalesce`, `requireRole` primeiro, `useActionForm`, mensagens exatas das RPCs em `rpc-errors.ts`).
- Permissões (spec §8): estoque e equipamentos — admin tudo; recepção e profissional **só leitura**. Vender produto no atendimento segue a regra de ajustar itens da Fase 4 (admin/recepção; o próprio profissional só em `in_progress`); venda no balcão só admin/recepção.
- `stock_movements.type` (exatos): `in | out | adjust | consumption`. `consumption` = consumível de serviço; `out` = produto vendido ou saída manual; `adjust` = contagem; `in` = entrada ou devolução de estorno.
- Quantidades em `numeric(12,3)` (consumível em ml/g, produto em un); unidades: `un | ml | g`. Produto vendido só em quantidade inteira ≥ 1.
- Estoque pode ficar negativo depois da baixa automática; **nunca** bloqueia o recebimento (spec §12) — só gera alerta. Saída manual que deixaria negativo também é aceita, com o mesmo alerta.
- Item vendável = `sale_price_cents` preenchido (spec §6).
- Produto não gera comissão nesta fase.
- Mensagens novas das RPCs: `'Item de estoque não encontrado.'`, `'Quantidade inválida.'`, `'Produto sem preço de venda.'`, `'Venda precisa de pelo menos um produto.'`.

## Review Focus

1. **Recebimento com estoque zerado**: Corte que consome 10 ml de um shampoo com 5 ml → o atendimento é recebido, o shampoo fica em −5 ml e aparece "Estoque negativo". → pgTAP na Task 5, unit `stockStatus` na Task 2.
2. **Desconto num atendimento com serviço e produto**: Corte 4500 (40%) + Pomada 3500, desconto 1000 → o desconto é repartido entre os dois itens (563/437); a comissão do Corte sai sobre 3937 (1575), o produto não gera comissão. → pgTAP na Task 4.
3. **Estorno devolve o estoque uma vez só**: estornar devolve o consumo e o produto; o estoque volta ao valor de antes do recebimento, sem duplicar. → pgTAP na Task 5.
4. **Quantidade digitada com vírgula** ("2,5" ml, "1.000" un) e ajuste por contagem: ajustar para 12 um item com 15 grava movimento de −3 e o saldo fica 12. → unit na Task 2 e pgTAP na Task 1.
5. **Recepção e profissional pela API**: leem estoque e equipamentos, mas não criam item, movimento, consumo, equipamento nem manutenção; outro salão não lê nada. → pgTAP nas Tasks 1, 3 e 6.

## Decisões desta fase (corrigíveis)

- A quantidade de `inventory_items` é derivada: só um trigger em `stock_movements` a altera; a coluna fica fora do grant de update (como `professionals.user_id`).
- Custo unitário (`unit_cost_cents`) é gravado em cada movimento de saída/consumo (snapshot), para a Fase 6 calcular o custo real por atendimento; uma entrada com custo atualiza o custo do item (último custo, sem média).
- Consumíveis do serviço são configurados na tela do item de estoque ("Usado nos serviços"), não na tela de serviços.
- Venda no balcão: cliente opcional (`customer_id` nulo só para `kind = 'sale'`), sem profissional; aparece em "Aguardando pagamento" do caixa como "Venda no balcão" e é recebida pelo mesmo diálogo. Não aparece na agenda.
- O desconto passa a ser repartido entre **todos** os itens (serviços e produtos), na mesma regra da Fase 4; a comissão de cada serviço continua sobre o valor dele menos a parte dele no desconto.
- Estorno devolve tudo que saiu pelo atendimento (consumo e produto), com movimentos `in` ligados ao movimento original (`reverses_id`).
- Manutenção de equipamento não lança despesa nesta fase (contas a pagar são da Fase 6); o custo fica registrado na manutenção.
- "Manutenção próxima" = próxima data em até 7 dias; "atrasada" = data já passou (no fuso do salão).

## File Structure

```
supabase/migrations/20261117000001_inventory.sql          # itens, movimentos, trigger, RPC de movimento
supabase/migrations/20261117000002_consumables.sql        # service_consumables
supabase/migrations/20261117000003_products_in_sales.sql  # item_type product, kind sale, RPCs de produto e balcão
supabase/migrations/20261117000004_stock_on_payment.sql   # baixa no receive_payment, devolução no refund
supabase/migrations/20261117000005_equipment.sql          # equipment, equipment_maintenance
supabase/tests/{inventory,consumables,products,stock_payment,equipment}.test.sql
src/lib/inventory/{status,quantity}.ts
src/lib/equipment/status.ts
src/lib/validation/{inventory,equipment}.ts
src/app/(app)/estoque/{page.tsx,actions.ts,inventory-client.tsx,tabs.tsx}
src/app/(app)/estoque/[id]/{page.tsx,movement-form.tsx,consumables-client.tsx}
src/app/(app)/estoque/equipamentos/{page.tsx,actions.ts,equipment-client.tsx}
src/app/(app)/caixa/counter-sale.tsx
src/app/(app)/agenda/appointment-sheet.tsx   # "Adicionar produto"
tests/unit/{inventory,equipment-status,validation-inventory}.test.ts
tests/e2e/{inventory,equipment,counter-sale}.spec.ts
```

---

### Task 1: Itens de estoque e movimentos

**Files:**
- Create: `supabase/migrations/20261117000001_inventory.sql`, `supabase/tests/inventory.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (gerado)

**Interfaces:**
- Produces (SQL):
  - `inventory_items(id, salon_id, name text 2–80, unit text in ('un','ml','g'), quantity numeric(12,3) default 0, min_quantity numeric(12,3) default 0 check ≥ 0, unit_cost_cents int default 0 check ≥ 0, sale_price_cents int null check ≥ 0, active bool default true, created_at, updated_at)`, `unique (id, salon_id)`, `unique (salon_id, lower(name))` como índice.
  - `stock_movements(id, salon_id, inventory_item_id, type text, quantity numeric(12,3) check <> 0` (com sinal: entrada positiva, saída/consumo negativa)`, unit_cost_cents int null, appointment_id uuid null, appointment_item_id uuid null, reverses_id uuid null, reason text null ≤ 200, created_by default auth.uid(), created_at)`; checks: `type in (...)`; `type <> 'in' or quantity > 0`; `type not in ('out','consumption') or quantity < 0`; FKs compostas para `inventory_items`, `appointments`, `stock_movements (reverses_id)`; índices `(inventory_item_id, created_at)`, `(appointment_id)`.
  - Trigger `stock_movements_apply` (after insert): `update inventory_items set quantity = quantity + new.quantity`.
  - RLS: select para membro do salão nas duas tabelas; `inventory_items` insert/update para admin com grant de colunas **sem** `quantity` (`grant insert (salon_id, name, unit, min_quantity, unit_cost_cents, sale_price_cents, active), update (name, unit, min_quantity, unit_cost_cents, sale_price_cents, active)`); `stock_movements` sem escrita pela API (revoke insert/update/delete).
  - `record_stock_movement(p_item_id uuid, p_type text, p_quantity numeric, p_unit_cost_cents int default null, p_reason text default null) returns public.stock_movements` (`security definer`): admin do salão do item; `p_type in ('in','out','adjust')` (senão 'Quantidade inválida.'); `in`/`out` com `p_quantity > 0` (o sinal vem do tipo); `adjust` com `p_quantity ≥ 0` = **quantidade contada**, grava a diferença (diferença 0 → 'Quantidade inválida.'); `in` com custo atualiza `unit_cost_cents` do item; item inexistente/inativo → 'Item de estoque não encontrado.'.

- [ ] **Step 1: Failing pgTAP** `inventory.test.sql`: admin cria item "Shampoo" (ml, mínimo 500) direto na tabela → ok; admin `update ... set quantity = 99` → `42501`; recepção e profissional leem o item; recepção insere item → `42501`; outro salão lê 0; `record_stock_movement` entrada 1000 com custo 5 → quantidade 1000, `unit_cost_cents = 5`; saída 300 → 700, movimento com `quantity = -300`; ajuste para 650 → movimento `-50`, saldo 650 *(Review Focus 4)*; ajuste para 650 de novo → 'Quantidade inválida.'; saída 2000 → aceita, saldo −1350; tipo `consumption` pela RPC → 'Quantidade inválida.'; recepção chama a RPC → 'Sem permissão.'; insert direto em `stock_movements` → `42501`; nome duplicado ignorando maiúsculas → `23505`.
- [ ] **Step 2:** `npm run db:test` → FAIL. **Step 3: Implementar.** **Step 4:** `npm run db:reset && npm run db:types && npm run db:test` → PASS.
- [ ] **Step 5: Commit** `feat: itens de estoque com movimentos e saldo derivado`.

---

### Task 2: Telas de estoque

**Files:**
- Create: `src/lib/inventory/{status,quantity}.ts`, `src/lib/validation/inventory.ts`, `src/app/(app)/estoque/{actions.ts,inventory-client.tsx,tabs.tsx}`, `src/app/(app)/estoque/[id]/{page.tsx,movement-form.tsx}`, `tests/unit/{inventory,validation-inventory}.test.ts`, `tests/e2e/inventory.spec.ts`
- Modify: `src/app/(app)/estoque/page.tsx` (substitui o placeholder)

**Interfaces:**
- Consumes: Task 1.
- Produces (TS):
  - `src/lib/inventory/quantity.ts`: `parseQuantity(input: string): number | null` (aceita "2,5", "1.000", "1.000,25", "3"; até 3 casas; negativo → null); `formatQuantity(q: number, unit: "un" | "ml" | "g"): string` → `"2,5 ml"`, `"1.000 un"`, `"-5 ml"` (pt-BR, sem casas inúteis).
  - `src/lib/inventory/status.ts`: `stockStatus(quantity: number, min: number): "negative" | "low" | "ok"` (`< 0` negativo; `< min` baixo; senão ok); `STOCK_STATUS_LABELS = { negative: "Estoque negativo", low: "Abaixo do mínimo", ok: "OK" }`.
  - `src/lib/validation/inventory.ts`: `inventoryItemSchema` (`name` 2–80 "Informe o nome do item", `unit` enum, `minQuantity` via `parseQuantity` "Quantidade inválida", `unitCost` reais vazio = 0, `salePrice` reais vazio = nulo) e `movementSchema` (`type: "in" | "out" | "adjust"`, `quantity` via `parseQuantity`, `> 0` salvo em `adjust`, `unitCost` opcional, `reason` ≤ 200).
  - Actions em `estoque/actions.ts`: `saveInventoryItem(prev: FormState, fd: FormData): Promise<FormState>`, `setInventoryItemActive(id: string, active: boolean): Promise<ActionResult>`, `recordStockMovement(prev: FormState, fd: FormData): Promise<FormState>`.
- Telas (todos os perfis via `requireRole()`; botões de escrita só para admin):
  - `/estoque`: abas "Estoque | Equipamentos" (`tabs.tsx`); resumo "{n} abaixo do mínimo · {m} negativos"; lista com nome, saldo (`formatQuantity`), mínimo, preço de venda (ou "—"), selo de `stockStatus`; filtro "Só alertas"; "Novo item" (admin) em Dialog; inativos escondidos com "Mostrar inativos".
  - `/estoque/[id]`: dados do item, "Editar", "Desativar/Ativar" (admin); formulário de movimento (Entrada, Saída, Ajuste por contagem — o ajuste pede "Quantidade contada"); histórico dos últimos 50 movimentos (data no fuso do salão, tipo em pt-BR "Entrada/Saída/Ajuste/Consumo", quantidade com sinal, motivo, link para o atendimento quando houver).

- [ ] **Step 1: Failing unit tests:** `inventory.test.ts`: `parseQuantity("2,5") = 2.5`, `("1.000") = 1000`, `("1.000,25") = 1000.25`, `("0,0001") = null`, `("-1") = null`, `("abc") = null` *(Review Focus 4)*; `formatQuantity(2.5, "ml") = "2,5 ml"`, `(1000, "un") = "1.000 un"`, `(-5, "ml") = "-5 ml"`; `stockStatus(-5, 500) = "negative"`, `(400, 500) = "low"`, `(500, 500) = "ok"`, `(0, 0) = "ok"` *(Review Focus 1)*. `validation-inventory.test.ts`: nome vazio → "Informe o nome do item"; preço de venda vazio → `salePriceCents: null`; movimento `in` com "0" → erro "Quantidade inválida"; `adjust` com "0" → aceito.
- [ ] **Step 2:** `npx vitest run tests/unit/inventory.test.ts tests/unit/validation-inventory.test.ts` → FAIL. **Step 3: Implementar.**
- [ ] **Step 4: e2e** `inventory.spec.ts` (salão novo via `signUpSalon`): admin cria "Pomada" (un, mínimo 5, venda "35,00") → aparece com "0 un" e "Abaixo do mínimo"; abre o item, Entrada "10" com custo "12,00" → saldo "10 un" e selo some; Ajuste com contada "8" → histórico mostra "Ajuste -2 un"; `recepcao@salonix.dev` abre `/estoque` sem botão "Novo item".
- [ ] **Step 5:** `npm test && npx playwright test tests/e2e/inventory.spec.ts` → PASS.
- [ ] **Step 6: Commit** `feat: telas de estoque com movimentos e alertas`.

---

### Task 3: Consumo por serviço

**Files:**
- Create: `supabase/migrations/20261117000002_consumables.sql`, `supabase/tests/consumables.test.sql`, `src/app/(app)/estoque/[id]/consumables-client.tsx`
- Modify: `src/app/(app)/estoque/[id]/page.tsx`, `src/app/(app)/estoque/actions.ts`, `tests/e2e/inventory.spec.ts`

**Interfaces:**
- Produces (SQL): `service_consumables(id, salon_id, service_id, inventory_item_id, quantity numeric(12,3) check > 0, created_at, updated_at)`, `unique (service_id, inventory_item_id)`, FKs compostas `on delete cascade`; RLS select para membro, insert/update/delete para admin.
- Produces (TS): actions `saveServiceConsumable(itemId: string, serviceId: string, quantity: string): Promise<ActionResult>` (upsert pelo par) e `removeServiceConsumable(id: string): Promise<ActionResult>`. Na tela do item, seção "Usado nos serviços": lista "{serviço} · {formatQuantity} por atendimento" com remover, e linha para adicionar (select de serviços ativos + quantidade) — só admin.

- [ ] **Step 1: Failing pgTAP** `consumables.test.sql`: admin liga Corte ↔ Shampoo 10 → ok; mesmo par de novo → `23505`; quantidade 0 → `23514`; serviço de outro salão → `23503`; recepção e profissional leem e não inserem (`42501`); outro salão lê 0 *(Review Focus 5)*.
- [ ] **Step 2:** FAIL. **Step 3: Implementar** migration, actions e seção. **Step 4:** `npm run db:reset && npm run db:types && npm run db:test` → PASS.
- [ ] **Step 5: e2e** em `inventory.spec.ts`: no item "Shampoo" (ml), "Usado nos serviços" com Corte e "15" → mostra "Corte · 15 ml por atendimento"; remover → some.
- [ ] **Step 6:** `npx playwright test tests/e2e/inventory.spec.ts` → PASS. **Step 7: Commit** `feat: consumo de estoque por serviço`.

---

### Task 4: Produto no atendimento e venda no balcão

**Files:**
- Create: `supabase/migrations/20261117000003_products_in_sales.sql`, `supabase/tests/products.test.sql`, `src/app/(app)/caixa/counter-sale.tsx`, `tests/e2e/counter-sale.spec.ts`
- Modify: `src/app/(app)/agenda/{appointment-sheet.tsx,actions.ts}`, `src/app/(app)/caixa/{page.tsx,actions.ts}`, `src/lib/agenda/{rpc-errors.ts,status.ts}`

**Interfaces:**
- Consumes: Tasks 1–3; Fase 4: `lock_adjustable_appointment`, `recalc_appointment_total`, `allocate_discount`, `receive_payment`.
- Produces (SQL):
  - `appointment_items`: `item_type in ('service','product')`; `service_id` nulo permitido; `inventory_item_id uuid null` com FK composta; check `(item_type = 'service') = (service_id is not null)` e `(item_type = 'product') = (inventory_item_id is not null)`; produto com `duration_minutes = 0` (`quantity` já é inteira).
  - `appointments`: `kind in ('scheduled','walk_in','sale')`; `customer_id` nulo só quando `kind = 'sale'`; `kind = 'sale'` sem profissional e sem horários.
  - `add_product_item(p_appointment_id uuid, p_inventory_item_id uuid, p_quantity int default 1) returns public.appointment_items`: `lock_adjustable_appointment`; item ativo do salão com `sale_price_cents` ('Item de estoque não encontrado.' / 'Produto sem preço de venda.'); `p_quantity ≥ 1` ('Quantidade inválida.'); `unit_price_cents` = preço de venda (snapshot), `professional_id` = do atendimento; recalcula total; evento `item_added` com `data.inventory_item_id`.
  - `remove_appointment_item` recriado: a regra "pelo menos um serviço" vale só para `kind <> 'sale'`; numa venda, recusa remover o último produto ('Venda precisa de pelo menos um produto.').
  - `create_counter_sale(p_salon_id uuid, p_customer_id uuid, p_items jsonb) returns public.appointments` com `p_items = [{"inventory_item_id": "...", "quantity": 2}]`: admin/recepção; pelo menos 1 linha ('Venda precisa de pelo menos um produto.'); `kind = 'sale'`, `status = 'awaiting_payment'`, `arrived_at = now()`, `duration_minutes` = 1 (check `> 0`), itens como em `add_product_item`; evento `created`.
  - `receive_payment` recriado: o desconto é repartido entre **todos** os itens pela ordem `(created_at, id)`; a comissão continua só para itens `service`.
- Produces (TS): actions `addProductItem(appointmentId: string, inventoryItemId: string, quantity: number): Promise<ActionResult>` (agenda) e `createCounterSale(prev: FormState, fd: FormData): Promise<FormState>` (caixa). Painel do atendimento: no editor de itens, "Adicionar produto" (select de itens vendáveis ativos com preço + quantidade); itens de produto aparecem como "{nome} × {qtd}". `/caixa`: botão "Venda no balcão" (Dialog: cliente opcional com `CustomerPicker`, linhas produto + quantidade, total ao vivo, "Criar venda") → a venda cai em "Aguardando pagamento" como "Venda no balcão" (ou o nome do cliente) e é recebida com o `PaymentDialog`.

- [ ] **Step 1: Failing pgTAP** `products.test.sql` (Corte 4500 com Paulo 40%; Pomada `sale_price` 3500; Shampoo sem preço):
  - produto em atendimento em curso → total 8000, item `product` com `unit_price_cents` 3500;
  - Shampoo → 'Produto sem preço de venda.'; quantidade 0 → 'Quantidade inválida.'; item de outro salão → 'Item de estoque não encontrado.';
  - profissional adiciona produto no próprio em curso → ok; recepção do outro salão → 'Sem permissão.';
  - receber com desconto 1000 `[cash 7000]` → uma comissão só (do Corte) com `base_cents` 3937 e `amount_cents` 1575 *(Review Focus 2)*;
  - `create_counter_sale` sem cliente com Pomada × 2 → `kind = 'sale'`, `awaiting_payment`, total 7000; sem linhas → 'Venda precisa de pelo menos um produto.'; profissional → 'Sem permissão.'; receber a venda `[pix 7000]` → `paid`, nenhuma comissão;
  - remover o único produto da venda → 'Venda precisa de pelo menos um produto.';
  - insert como `postgres` de `kind = 'scheduled'` sem cliente → `23502`/`23514`.
- [ ] **Step 2:** FAIL. **Step 3: Implementar** migration, actions, painel e venda no balcão. **Step 4:** `npm run db:reset && npm run db:types && npm run db:test` → PASS (as suítes da Fase 4 continuam verdes).
- [ ] **Step 5: e2e** `counter-sale.spec.ts` (salão novo; item "Pomada" com venda "35,00" criado pelas telas da Task 2; caixa aberto): "Venda no balcão" com Pomada × 2 → total "R$ 70,00" → "Criar venda" → aparece "Venda no balcão" em "Aguardando pagamento" → "Receber R$ 70,00" → "Dinheiro esperado" sobe R$ 70,00. No painel de um atendimento em curso (helpers da Fase 4), "Adicionar produto" Pomada × 1 → total soma R$ 35,00.
- [ ] **Step 6:** `npm test && npx playwright test tests/e2e/counter-sale.spec.ts tests/e2e/cash.spec.ts` → PASS.
- [ ] **Step 7: Commit** `feat: produtos no atendimento e venda no balcão`.

---

### Task 5: Baixa automática no recebimento e devolução no estorno

**Files:**
- Create: `supabase/migrations/20261117000004_stock_on_payment.sql`, `supabase/tests/stock_payment.test.sql`
- Modify: `src/app/(app)/estoque/page.tsx` (nada a mudar se o histórico já lista `consumption`; conferir), `tests/e2e/counter-sale.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `refund_appointment` (Fase 4).
- Produces (SQL):
  - `apply_stock_for_appointment(p_appointment_id uuid)` (interno, sem execute para `authenticated`): para cada item `service`, cada `service_consumables` do serviço gera `consumption` de `-(consumível × quantidade do item)`; para cada item `product`, `out` de `-quantidade`; todos com `appointment_id`, `appointment_item_id` e `unit_cost_cents` = custo atual do item; itens de estoque inativos também baixam.
  - `receive_payment` recriado chamando `apply_stock_for_appointment` antes de marcar `paid` (mesma transação; nunca recusa por saldo).
  - `refund_appointment` recriado: para cada movimento `consumption`/`out` do atendimento sem devolução, grava `in` de `+|quantidade|` com `reverses_id` = o movimento e `reason` = motivo do estorno.

- [ ] **Step 1: Failing pgTAP** `stock_payment.test.sql` (Corte consome Shampoo 10 ml; Shampoo com 5 ml; Pomada com 3 un):
  - receber atendimento Corte + Pomada × 2 → Shampoo −5 ml e Pomada 1 un; um `consumption` de −10 e um `out` de −2, com `unit_cost_cents` do item *(Review Focus 1)*;
  - o atendimento fica `paid` mesmo com saldo negativo;
  - Corte × 2 itens (dois Cortes) consome 20 ml;
  - estornar → Shampoo volta a 5 ml e Pomada a 3 un, dois movimentos `in` com `reverses_id`; estornar de novo → 'Atendimento já estornado.' e nenhum movimento novo *(Review Focus 3)*;
  - venda no balcão de Pomada recebida → `out` −1; serviço sem consumível → nenhum movimento;
  - receber sem caixa aberto → 'Abra o caixa antes de receber.' e nenhum movimento (tudo ou nada).
- [ ] **Step 2:** FAIL. **Step 3: Implementar.** **Step 4:** `npm run db:reset && npm run db:test` → PASS.
- [ ] **Step 5: e2e** em `counter-sale.spec.ts`: depois de receber a venda de Pomada × 2 (estoque 10), `/estoque` mostra "8 un" e o histórico do item tem "Saída -2 un" com link para o atendimento.
- [ ] **Step 6:** `npx playwright test tests/e2e/counter-sale.spec.ts` → PASS. **Step 7: Commit** `feat: baixa de estoque no recebimento e devolução no estorno`.

---

### Task 6: Equipamentos e manutenção

**Files:**
- Create: `supabase/migrations/20261117000005_equipment.sql`, `supabase/tests/equipment.test.sql`, `src/lib/equipment/status.ts`, `src/lib/validation/equipment.ts`, `src/app/(app)/estoque/equipamentos/{page.tsx,actions.ts,equipment-client.tsx}`, `tests/unit/equipment-status.test.ts`, `tests/e2e/equipment.spec.ts`

**Interfaces:**
- Produces (SQL): `equipment(id, salon_id, name 2–80, status text in ('active','maintenance','inactive') default 'active', professional_id uuid null (responsável), notes ≤ 300, created_at, updated_at)`, `unique (id, salon_id)`; `equipment_maintenance(id, salon_id, equipment_id, performed_on date, description text 2–300, cost_cents int ≥ 0 default 0, next_due date null check (next_due is null or next_due >= performed_on), created_by default auth.uid(), created_at)`, FKs compostas (`on delete cascade` na manutenção). RLS: select para membro; insert/update/delete para admin, nas duas.
- Produces (TS): `maintenanceStatus(nextDue: string | null, today: string): "overdue" | "soon" | "ok" | null` (nulo sem data; `< today` atrasada; `≤ today + 7` próxima); `MAINTENANCE_LABELS = { overdue: "Manutenção atrasada", soon: "Manutenção próxima", ok: "Em dia" }`. `equipmentSchema` e `maintenanceSchema` (data ISO; custo em reais vazio = 0; próxima ≥ realizada, erro "A próxima manutenção deve ser depois desta"). Actions `saveEquipment`, `setEquipmentStatus(id, status)`, `addMaintenance`, `deleteMaintenance(id)`.
- Tela `/estoque/equipamentos` (aba): lista com nome, status em pt-BR ("Em uso", "Em manutenção", "Inativo"), responsável, última manutenção e selo de `maintenanceStatus` da próxima (com `todayIn(salon.timezone)`); "Novo equipamento" (admin); cada equipamento abre o histórico de manutenções (data, descrição, custo `formatBRL`, próxima) e "Registrar manutenção" (admin). Topo: "{n} com manutenção atrasada ou próxima".

- [ ] **Step 1: Failing unit test** `equipment-status.test.ts` (today `2026-11-20`): `null` → `null`; `"2026-11-19"` → `"overdue"`; `"2026-11-20"` → `"soon"`; `"2026-11-27"` → `"soon"`; `"2026-11-28"` → `"ok"`; `maintenanceSchema` com próxima antes da realizada → "A próxima manutenção deve ser depois desta".
- [ ] **Step 2: Failing pgTAP** `equipment.test.sql`: admin cria equipamento e manutenção; recepção e profissional leem, não inserem nem alteram (`42501` no insert; update de status pela recepção não muda nada → conferir que o status continua) *(Review Focus 5)*; outro salão lê 0; manutenção com `next_due` antes de `performed_on` → `23514`; responsável de outro salão → `23503`.
- [ ] **Step 3:** `npm test && npm run db:test` → FAIL. **Step 4: Implementar.** **Step 5:** `npm run db:reset && npm run db:types && npm test && npm run db:test` → PASS.
- [ ] **Step 6: e2e** `equipment.spec.ts` (salão novo): admin cria "Máquina de corte" → registra manutenção de hoje "Troca de lâmina", "80,00", próxima daqui a 3 dias (`dayInSaoPaulo(3)`) → lista mostra "Manutenção próxima" e o histórico mostra "R$ 80,00"; muda status para "Em manutenção" → aparece o status; `pro@salonix.dev` abre `/estoque/equipamentos` sem "Novo equipamento".
- [ ] **Step 7:** `npx playwright test tests/e2e/equipment.spec.ts` → PASS. **Step 8: Commit** `feat: equipamentos com histórico e aviso de manutenção`.

---

### Task 7: Dados de demonstração e verificação da fase

**Files:**
- Modify: `supabase/seed.sql`, `tests/e2e/seed.spec.ts`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Failing e2e** em `seed.spec.ts` (só leitura do salão demo): `recepcao@salonix.dev` em `/estoque` vê "Shampoo" com "Abaixo do mínimo" e "Pomada modeladora" com preço "R$ 35,00"; em `/estoque/equipamentos` vê "Máquina de corte" com "Manutenção próxima".
- [ ] **Step 2: Seed:** itens Shampoo (ml, 300, mínimo 500, custo 3 por ml), Pomada modeladora (un, 12, mínimo 5, custo 1500, venda 3500), Lâmina descartável (un, 40, mínimo 20, custo 50); movimentos `in` correspondentes (o saldo sai do trigger); consumo: Corte masculino → Shampoo 15 ml e Lâmina 1 un; Barba → Lâmina 1 un; equipamentos Máquina de corte (Paulo, manutenção há 80 dias, próxima em 5 dias a partir de hoje) e Cadeira 1 (sem manutenção). Os atendimentos pagos do seed da Fase 4 **não** geram baixa retroativa.
- [ ] **Step 3:** `npm run db:reset && npx playwright test tests/e2e/seed.spec.ts` → PASS.
- [ ] **Step 4: Verificação completa:** `npm run lint && npx tsc --noEmit && npm test && npm run db:test && npm run build && npm run db:reset && npm run test:e2e` → tudo PASS (anotar as contagens).
- [ ] **Step 5:** README: estoque com saldo derivado dos movimentos, baixa automática no recebimento (pode ficar negativo, gera alerta), devolução no estorno, equipamentos. `CLAUDE.md`: Fase 5 pronta; na arquitetura, "estoque: `inventory_items.quantity` só muda pelo trigger de `stock_movements`; movimentos só por `record_stock_movement` e dentro de `receive_payment`/`refund_appointment` (`apply_stock_for_appointment`); produto é `appointment_items.item_type = 'product'`, venda no balcão é `appointments.kind = 'sale'`".
- [ ] **Step 6: Commit** `feat: dados de demonstração do estoque e verificação da Fase 5`.
