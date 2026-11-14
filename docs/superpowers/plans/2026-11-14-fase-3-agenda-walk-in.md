# Salonix — Fase 3 (Agenda + walk-in) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agenda por profissional (dia e semana) com agendamento que respeita jornada, bloqueios e conflitos; reagendar, cancelar e falta com histórico; link "Lembrar no WhatsApp"; fila de walk-in única por ordem de chegada com estimativa de espera e "Chamar próximo", atualizada ao vivo; iniciar e concluir atendimento até `awaiting_payment` (o recebimento é da Fase 4).

**Architecture:** Tabelas `appointments`, `appointment_items` e `appointment_events` com RLS **só de leitura**; toda escrita passa por RPCs `security definer` que conferem perfil e estado e gravam o evento na mesma transação. A garantia contra dois agendamentos no mesmo horário é uma exclusion constraint (btree_gist) no banco, então duas recepções clicando ao mesmo tempo nunca geram choque. Os horários livres e a estimativa de espera são funções TS puras testadas com Vitest. A tela assina `postgres_changes` de `appointments` (Supabase Realtime, que respeita a RLS) e faz `router.refresh()`.

**Tech Stack:** o das Fases 1–2 + extensão Postgres `btree_gist` e `@supabase/supabase-js` Realtime (já instalado). Nenhuma dependência npm nova.

**Spec:** `docs/superpowers/specs/2026-11-13-salonix-mvp-design.md` (§6 `appointments`/`appointment_items`/`appointment_events`, §7 Agendamento e Walk-in, §8 permissões, §10 "próximo horário livre")

Branch: `fase-3-agenda` (criada a partir de `fase-2-cadastros`).

## Global Constraints

- Tudo das Global Constraints das Fases 1 e 2 continua valendo (pt-BR, centavos, `timestamptz` em UTC exibido no fuso do salão, RLS + pgTAP, FK composta `(x_id, salon_id)`, `requireRole` primeiro, formulários com `useActionForm`).
- Status (spec §6, exatos): `scheduled | waiting | in_progress | awaiting_payment | paid | cancelled | no_show`; `kind`: `scheduled | walk_in`. Esta fase nunca grava `paid`.
- A fila de walk-in é sempre por `arrived_at`; atrasos e faltas não reordenam (spec §7).
- Grade de horários livres: passo de **15 minutos**; um atendimento precisa caber inteiro dentro de **um** intervalo da jornada do dia (não atravessa o almoço nem a meia-noite).
- Ações principais em no máximo 2 toques depois de preencher (spec §2): "Cliente na porta" → "Entrar na fila"; escolher horário livre → "Agendar".
- Mensagens de erro das RPCs (o app mostra exatamente estas): `'Horário indisponível para este profissional.'`, `'Fora da jornada do profissional.'`, `'Profissional bloqueado neste horário.'`, `'Atendimento não pode mudar deste status.'`, `'Fila vazia para este profissional.'`, `'Profissional já está em atendimento.'`, `'Sem permissão.'`.

## Review Focus

1. **Duas recepções agendam o mesmo horário quase juntas**: a segunda recebe "Horário indisponível para este profissional.", nunca um choque gravado. → pgTAP na Task 2 (inclui insert direto que só a constraint barra).
2. **Atendimento que passa do fim da jornada** (17:45 + 30 min com jornada até 18:00, ou atravessando o almoço) é recusado, e a lista de horários livres nem oferece esse horário. → unit na Task 3 + pgTAP na Task 2.
3. **Virada do dia no fuso**: atendimento às 22:30 em São Paulo (01:30 UTC do dia seguinte) aparece no dia certo da agenda. → unit `localDayRange` na Task 3.
4. **Walk-in que espera um profissional específico** não é chamado por outro, mesmo tendo chegado antes; o próximo da fila geral é chamado normalmente. → pgTAP na Task 5.
5. **Profissional pela API** vê só os próprios atendimentos e a fila geral; não vê os de colegas nem inicia atendimento de colega. → pgTAP nas Tasks 1 e 2.

## Decisões desta fase (corrigíveis)

- Escrita em `appointments` só por RPC `security definer` com checagem explícita de perfil (em vez de policies de insert/update): é uma máquina de estados e cada mudança precisa gravar evento junto.
- Iniciar e concluir atendimento entram nesta fase (até `awaiting_payment`), senão o profissional chamado da fila ficaria preso em `in_progress` até a Fase 4. Itens extras, pagamento, estoque e comissão continuam na Fase 4.
- Profissional **não** cria, reagenda nem cancela; vê a própria agenda, a fila geral e inicia/conclui os próprios atendimentos e "Chama próximo" para si (spec §8: "iniciar/concluir os próprios").
- Agendamento fora da jornada é recusado sem exceção ("encaixe" fica para depois).
- Walk-in em atendimento não conflita com agendados (a exclusion constraint vale só para `kind = 'scheduled'`); a recepção decide encaixes.
- Estimativa de espera generaliza a "soma das durações" do spec para vários profissionais: simula cada profissional que trabalha agora atendendo a fila em ordem de chegada. Com um profissional, o resultado é exatamente a soma do spec.
- "Chamar próximo" aparece para todo profissional ativo, não só para quem está na jornada agora: a recepção decide quem atende; a jornada só alimenta a estimativa de espera.
- Cliente do walk-in: escolhe um existente pela busca ou digita um nome novo (telefone opcional), que vira cadastro em `customers`.

## File Structure

```
supabase/migrations/20261115000001_appointments.sql        # tabelas, constraint, RLS, publication realtime
supabase/migrations/20261115000002_appointment_rpcs.sql    # agendar, reagendar, cancelar, falta, iniciar, concluir
supabase/migrations/20261115000003_walk_in.sql             # enfileirar, chamar próximo
supabase/tests/{appointments,appointment_rpcs,walk_in}.test.sql
src/lib/agenda/time.ts          # localDayRange, toLocalMinutes, weekdayOf
src/lib/agenda/slots.ts         # availableSlots
src/lib/agenda/queue.ts         # estimateWaits
src/lib/agenda/whatsapp.ts      # whatsappReminderUrl
src/lib/validation/appointments.ts
src/components/realtime/realtime-refresh.tsx
src/components/customers/customer-picker.tsx   # busca + "novo cliente" inline
src/app/(app)/agenda/{page.tsx,actions.ts,agenda-client.tsx,new-appointment.tsx,appointment-sheet.tsx}
src/app/(app)/agenda/fila/{page.tsx,queue-client.tsx}
tests/unit/{agenda-time,slots,queue,whatsapp,validation-appointments}.test.ts
tests/e2e/{agenda,walk-in}.spec.ts
```

---

### Task 1: Modelo de atendimentos e leitura por perfil

**Files:**
- Create: `supabase/migrations/20261115000001_appointments.sql`, `supabase/tests/appointments.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (gerado)

**Interfaces:**
- Consumes: `customers`, `professionals`, `services` (Fase 2), todos com `unique (id, salon_id)`.
- Produces (SQL):
  - `create extension if not exists btree_gist with schema extensions;`
  - `appointments(id, salon_id, customer_id, professional_id null, kind text, status text, starts_at timestamptz null, ends_at timestamptz null, arrived_at timestamptz null, duration_minutes int, total_cents int, discount_cents int default 0, notes text null ≤ 300, created_by uuid default auth.uid(), created_at, updated_at)`, `unique (id, salon_id)`, FKs compostas para `customers` e `professionals`. Checks: `kind in (...)`, `status in (...)`; `kind <> 'scheduled' or (starts_at is not null and ends_at is not null and professional_id is not null)`; `kind <> 'walk_in' or arrived_at is not null`; `status not in ('in_progress','awaiting_payment') or (professional_id is not null and starts_at is not null)`; `ends_at is null or ends_at > starts_at`.
  - Exclusion constraint `appointments_no_overlap`: `exclude using gist (professional_id with =, tstzrange(starts_at, ends_at) with &&) where (kind = 'scheduled' and status not in ('cancelled', 'no_show'))`.
  - Índices: `(salon_id, starts_at)`, `(salon_id, status, arrived_at) where kind = 'walk_in'`.
  - `appointment_items(id, salon_id, appointment_id, item_type text check (item_type = 'service'), service_id, professional_id null, quantity int default 1 check > 0, unit_price_cents int ≥ 0, duration_minutes int)`, FKs compostas, `on delete cascade` no atendimento. (A Fase 5 amplia `item_type` para `product`.)
  - `appointment_events(id, salon_id, appointment_id, event text check in ('created','rescheduled','cancelled','no_show','called','started','completed'), actor uuid default auth.uid(), data jsonb default '{}', created_at)`, índice `(appointment_id, created_at)`.
  - `public.my_professional_id(p_salon_id uuid) returns uuid` (`security definer`, `stable`): o profissional do salão vinculado a `auth.uid()`, ou nulo.
  - `public.can_see_appointment(p_salon_id uuid, p_professional_id uuid, p_kind text, p_status text) returns boolean` (`security definer`, `stable`): admin/recepção do salão; ou profissional membro quando `p_professional_id = my_professional_id(p_salon_id)`; ou profissional membro quando `p_kind = 'walk_in' and p_status = 'waiting' and p_professional_id is null` (fila geral).
  - RLS: as três tabelas só com policy de **select** (itens e eventos checam o atendimento pai via `exists` + `can_see_appointment`); nenhuma policy de insert/update/delete.
  - `alter publication supabase_realtime add table public.appointments;`

- [ ] **Step 1: Failing pgTAP** `appointments.test.sql` (helpers como nas Fases 1–2; inserts de setup como `postgres` depois de `t.logout()`): admin e recepção veem todos os atendimentos do salão; profissional vinculado vê os próprios + walk-in `waiting` sem profissional, e **não** vê agendado de colega nem walk-in esperando colega *(Review Focus 5)*; profissional não lê `appointment_items`/`appointment_events` de atendimento de colega; membro de outro salão vê 0; insert direto em `appointments` por admin → `42501`; dois agendados sobrepostos do mesmo profissional inseridos como `postgres` → `23P01`; o mesmo horário com o primeiro `cancelled` → aceito; walk-in `in_progress` sobreposto a agendado → aceito; `kind='scheduled'` sem `starts_at` → `23514`; `item_type = 'product'` → `23514`.
- [ ] **Step 2:** `npm run db:test` → FAIL (tabela não existe).
- [ ] **Step 3: Implementar** a migration. **Step 4:** `npm run db:reset && npm run db:types && npm run db:test` → PASS.
- [ ] **Step 5: Commit** `feat: modelo de atendimentos com leitura por perfil e trava de horário`.

---

### Task 2: RPCs de agenda e de atendimento

**Files:**
- Create: `supabase/migrations/20261115000002_appointment_rpcs.sql`, `supabase/tests/appointment_rpcs.test.sql`

**Interfaces:**
- Consumes: Task 1; `professional_schedules`, `schedule_blocks`, `salons.timezone`.
- Produces (SQL), todas `security definer`, `set search_path = ''`, `execute` só para `authenticated`, retornando `public.appointments`, gravando `appointment_events` na mesma transação e levantando as mensagens das Global Constraints:
  - `create_appointment(p_salon_id uuid, p_customer_id uuid, p_professional_id uuid, p_service_ids uuid[], p_starts_local timestamp, p_notes text default null)`: admin/recepção; serviços ativos do salão (repetidos permitidos, um item por id); `duration_minutes` = soma, `total_cents` = soma dos preços (snapshot em `appointment_items`); `starts_at = p_starts_local at time zone salon.timezone`; confere que `[início, fim)` local cabe inteiro num intervalo de `professional_schedules` do `extract(dow)` local; confere que não cruza `schedule_blocks`; insere e converte `exclusion_violation` (`23P01`) em 'Horário indisponível para este profissional.'; evento `created`.
  - `reschedule_appointment(p_appointment_id uuid, p_professional_id uuid, p_starts_local timestamp)`: só `scheduled`; mesmas validações (a duração não muda); evento `rescheduled` com `data = {"from": {"starts_at", "professional_id"}}`.
  - `cancel_appointment(p_appointment_id uuid, p_reason text default null)`: `scheduled | waiting` → `cancelled`; evento com `data.reason`.
  - `mark_no_show(p_appointment_id uuid)`: `scheduled | waiting` → `no_show`.
  - `start_appointment(p_appointment_id uuid)`: `scheduled` → `in_progress`; admin/recepção ou o próprio profissional; recusa se o profissional já tem outro `in_progress` ('Profissional já está em atendimento.').
  - `complete_appointment(p_appointment_id uuid)`: `in_progress` → `awaiting_payment`; admin/recepção ou o próprio profissional; evento `completed`.
  - Helper interno (sem execute para `authenticated`) `public.assert_slot_available(p_professional_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_timezone text)` com as checagens de jornada e bloqueio, reusado por criar e reagendar.

- [ ] **Step 1: Failing pgTAP** `appointment_rpcs.test.sql`, com salão `America/Sao_Paulo`, profissional com jornada sexta (5) 09:00–12:00 e 13:00–18:00 e serviço de 30 min / 4500:
  - recepção agenda sexta 20/11/2026 10:00 → `starts_at = '2026-11-20 13:00+00'`, `total_cents = 4500`, 1 item, evento `created`;
  - segunda chamada igual → 'Horário indisponível para este profissional.' *(Review Focus 1)*; 10:15 (sobrepõe parcialmente) → idem;
  - 17:45 → 'Fora da jornada do profissional.'; 11:45 (atravessa o almoço) → idem; domingo → idem *(Review Focus 2)*;
  - bloqueio 14:00–15:00 → agendar 14:30 → 'Profissional bloqueado neste horário.';
  - profissional chama `create_appointment` → 'Sem permissão.'; recepção de outro salão → 'Sem permissão.';
  - reagendar para 11:00 → evento `rescheduled` com `data->'from'->>'starts_at'` igual ao horário antigo; o horário 10:00 volta a ficar livre;
  - cancelar → `cancelled`; o horário volta a aceitar agendamento;
  - profissional vinculado inicia o próprio → `in_progress`; tenta iniciar o de colega → 'Sem permissão.' *(Review Focus 5)*; conclui → `awaiting_payment`; concluir de novo → 'Atendimento não pode mudar deste status.';
  - `mark_no_show` em `in_progress` → 'Atendimento não pode mudar deste status.'.
- [ ] **Step 2:** `npm run db:test` → FAIL. **Step 3: Implementar.** **Step 4:** `npm run db:reset && npm run db:types && npm run db:test` → PASS.
- [ ] **Step 5: Commit** `feat: RPCs de agendar, reagendar, cancelar e atender com histórico`.

---

### Task 3: Agenda do dia e da semana com horários livres

**Files:**
- Create: `src/lib/agenda/{time,slots}.ts`, `src/lib/validation/appointments.ts`, `src/components/customers/customer-picker.tsx`, `src/components/realtime/realtime-refresh.tsx`, `src/app/(app)/agenda/{page.tsx,actions.ts,agenda-client.tsx,new-appointment.tsx}`, `tests/unit/{agenda-time,slots,validation-appointments}.test.ts`, `tests/e2e/agenda.spec.ts`
- Delete: o placeholder atual de `src/app/(app)/agenda/page.tsx` (substituído)

**Interfaces:**
- Consumes: RPC `create_appointment` (Task 2).
- Produces (TS):
  - `src/lib/agenda/time.ts`: `localDayRange(date: string, timeZone: string): { from: string; to: string }` (ISO UTC do início do dia local e do dia seguinte); `toLocalMinutes(iso: string, date: string, timeZone: string): number` (minutos desde 00:00 local de `date`; negativo/≥1440 fora do dia); `weekdayOf(date: string): number` (0 = domingo); `addDays(date: string, n: number): string`; `todayIn(timeZone: string): string`.
  - `src/lib/agenda/slots.ts`: `type Busy = { start: number; end: number }` (minutos locais); `availableSlots(input: { intervals: { start: number; end: number }[]; busy: Busy[]; durationMinutes: number; stepMinutes?: number; notBefore?: number }): string[]` → `"HH:MM"` em ordem, onde `[t, t + duração)` cabe inteiro num intervalo e não cruza nenhum `busy`; `stepMinutes` padrão 15; `notBefore` corta horários já passados quando a data é hoje.
  - `src/lib/validation/appointments.ts`: `appointmentSchema` (`customerId: uuid`, `professionalId: uuid`, `serviceIds: uuid[] min 1` com erro "Escolha pelo menos um serviço", `date: iso date`, `time: "HH:MM"`, `notes?` ≤ 300).
  - Actions em `agenda/actions.ts`: `createAppointment(prev: FormState, formData: FormData): Promise<FormState>` (traduz as mensagens das Global Constraints vindas da RPC; outras viram "Não foi possível agendar."); `searchCustomers(q: string): Promise<{ id: string; name: string; phone: string | null }[]>` (mesma busca da `/clientes`, limite 8); `quickCreateCustomer(name: string, phone: string): Promise<ActionResult<{ id: string }>>` (usa `customerSchema`; telefone duplicado devolve o cliente existente em vez de erro).
  - `getFreeSlots(professionalId: string, date: string, durationMinutes: number): Promise<string[]>` (server action que lê jornada, bloqueios e agendados não cancelados do dia e chama `availableSlots`).
  - `<CustomerPicker name="customerId" />`: campo de busca com sugestões; "Cadastrar {texto}" abre nome + telefone inline e chama `quickCreateCustomer`.
  - `<RealtimeRefresh salonId={string} />`: assina `postgres_changes` em `public.appointments` com `filter: salon_id=eq.{id}` e chama `router.refresh()` (com debounce de 300 ms); remove o canal ao desmontar.
- Página `/agenda?data=YYYY-MM-DD&visao=dia|semana&profissional={id}` (todos os perfis via `requireRole()`):
  - **dia**: uma coluna por profissional ativo (desktop) ou seletor de profissional (celular < 768px), atendimentos em blocos com hora, cliente, serviços e cor do profissional; faixas de bloqueio em cinza; fora da jornada com fundo listrado. Navegação "‹ Hoje ›".
  - **semana**: um profissional, lista por dia (segunda a domingo) com os atendimentos.
  - Profissional vê só a própria coluna (a RLS já filtra; a UI esconde o seletor).
  - Botão "Agendar" (admin/recepção) abre `new-appointment.tsx`: cliente → serviços (checkbox com duração e preço) → profissional → data → chips de horários livres (`getFreeSlots`) → "Agendar". Sem horários: "Nenhum horário livre neste dia."
  - Consulta do dia usa `localDayRange` para filtrar `starts_at`.

- [ ] **Step 1: Failing unit tests:**
  - `agenda-time.test.ts`: `localDayRange("2026-11-20", "America/Sao_Paulo")` → `{ from: "2026-11-20T03:00:00.000Z", to: "2026-11-21T03:00:00.000Z" }`; `toLocalMinutes("2026-11-21T01:30:00Z", "2026-11-20", "America/Sao_Paulo")` → `1350` (22:30 do dia 20) *(Review Focus 3)*; `weekdayOf("2026-11-20")` → `5`; `addDays("2026-12-31", 1)` → `"2027-01-01"`.
  - `slots.test.ts`: jornada 540–720 e 780–1080, 30 min, sem ocupados → começa `"09:00"`, inclui `"11:30"` e `"17:30"`, **não** inclui `"11:45"` nem `"17:45"` *(Review Focus 2)*; ocupado 600–630 → sem `"09:45"`, `"10:00"`, `"10:15"` e com `"10:30"`; `notBefore: 615` → primeiro `"10:15"`; duração 60 → último `"17:00"`; sem intervalos → `[]`.
  - `validation-appointments.test.ts`: `serviceIds` vazio → "Escolha pelo menos um serviço"; horário `"25:00"` → erro.
- [ ] **Step 2:** `npx vitest run tests/unit/agenda-time.test.ts tests/unit/slots.test.ts tests/unit/validation-appointments.test.ts` → FAIL.
- [ ] **Step 3: Implementar** libs, actions, componentes e página.
- [ ] **Step 4: e2e** `agenda.spec.ts` (salão novo via `signUpSalon`; criar serviço "Corte" 30 min e profissional com jornada todos os dias 09:00–18:00 pelas telas da Fase 2, com helpers locais): admin agenda para amanhã escolhendo cliente novo "Ana Teste" pelo picker, serviço Corte e o chip `"10:00"` → o bloco aparece na coluna do profissional; abrir de novo o agendamento e o chip `"10:00"` não é oferecido; trocar para visão semana mostra o atendimento no dia certo; `pro@salonix.dev` abre `/agenda` sem botão "Agendar".
- [ ] **Step 5:** `npm test && npx playwright test tests/e2e/agenda.spec.ts` → PASS.
- [ ] **Step 6: Commit** `feat: agenda por profissional com horários livres`.

---

### Task 4: Detalhe do atendimento: reagendar, cancelar, falta, iniciar, concluir e WhatsApp

**Files:**
- Create: `src/lib/agenda/whatsapp.ts`, `src/app/(app)/agenda/appointment-sheet.tsx`, `tests/unit/whatsapp.test.ts`
- Modify: `src/app/(app)/agenda/{actions.ts,agenda-client.tsx}`, `tests/e2e/agenda.spec.ts`

**Interfaces:**
- Consumes: RPCs da Task 2; `getFreeSlots` (Task 3).
- Produces (TS): `whatsappReminderUrl(input: { phone: string; customerName: string; salonName: string; startsAt: string; timeZone: string; professionalName: string; serviceNames: string[] }): string` → `https://wa.me/55{phone}?text={encodeURIComponent(msg)}`, com `msg` exatamente `Olá, {primeiro nome}! Lembrete do seu horário na {salão}: {dd/mm} às {HH:MM} com {profissional} ({serviços separados por " + "}).`; actions `rescheduleAppointment(id: string, professionalId: string, date: string, time: string): Promise<ActionResult>`, `cancelAppointment(id: string, reason: string): Promise<ActionResult>`, `markNoShow(id)`, `startAppointment(id)`, `completeAppointment(id)` (todas `Promise<ActionResult>`, traduzindo as mensagens da RPC).
- `appointment-sheet.tsx`: tocar num atendimento abre um painel (Dialog, bottom sheet no celular) com cliente, telefone, serviços, total (`formatBRL`), status em pt-BR (`Agendado`, `Na fila`, `Em atendimento`, `Aguardando pagamento`, `Pago`, `Cancelado`, `Faltou`), histórico de eventos (quem e quando, no fuso do salão) e ações conforme status e perfil:
  - `scheduled`: Iniciar (admin/recepção/o próprio), Reagendar e Cancelar (com motivo opcional) e Faltou (admin/recepção), "Lembrar no WhatsApp" (link `target="_blank"`, só com telefone).
  - `in_progress`: Concluir.
  - Cancelar e Faltou pedem confirmação dentro do próprio painel (sem `window.confirm`).

- [ ] **Step 1: Failing unit test** `whatsapp.test.ts`: para `phone "11988887777"`, `customerName "Carlos Cliente"`, salão "Barbearia Demo", `startsAt "2026-11-20T13:00:00Z"`, São Paulo, "Paulo", `["Corte", "Barba"]` → `decodeURIComponent` do parâmetro `text` é `"Olá, Carlos! Lembrete do seu horário na Barbearia Demo: 20/11 às 10:00 com Paulo (Corte + Barba)."` e a URL começa com `https://wa.me/5511988887777?text=`.
- [ ] **Step 2:** FAIL. **Step 3: Implementar.**
- [ ] **Step 4: e2e** em `agenda.spec.ts`: no atendimento criado, "Reagendar" para `"11:00"` → bloco muda de lugar e o histórico mostra "Reagendado"; "Lembrar no WhatsApp" tem `href` começando com `https://wa.me/55`; "Iniciar" → status "Em atendimento"; "Concluir" → "Aguardando pagamento"; outro atendimento → "Cancelar" com confirmação → some da agenda e o horário volta a aparecer nos chips.
- [ ] **Step 5:** `npm test && npx playwright test tests/e2e/agenda.spec.ts` → PASS.
- [ ] **Step 6: Commit** `feat: reagendar, cancelar, falta e atendimento pela agenda, com lembrete no WhatsApp`.

---

### Task 5: Fila de walk-in em tempo real

**Files:**
- Create: `supabase/migrations/20261115000003_walk_in.sql`, `supabase/tests/walk_in.test.sql`, `src/lib/agenda/queue.ts`, `tests/unit/queue.test.ts`, `src/app/(app)/agenda/fila/{page.tsx,queue-client.tsx}`, `tests/e2e/walk-in.spec.ts`
- Modify: `src/app/(app)/agenda/{actions.ts,agenda-client.tsx}` (abas "Agenda | Fila" e botão "Cliente na porta")

**Interfaces:**
- Consumes: Tasks 1–4; `CustomerPicker`, `RealtimeRefresh`.
- Produces (SQL, `security definer`, eventos na mesma transação):
  - `enqueue_walk_in(p_salon_id uuid, p_customer_id uuid, p_service_ids uuid[], p_professional_id uuid default null) returns public.appointments`: admin/recepção; `kind = 'walk_in'`, `status = 'waiting'`, `arrived_at = now()`, sem `starts_at`; itens e totais como em `create_appointment`; evento `created`.
  - `call_next_walk_in(p_salon_id uuid, p_professional_id uuid) returns public.appointments`: admin/recepção, ou o próprio profissional para si; profissional ativo e sem `in_progress` ('Profissional já está em atendimento.'); escolhe o `waiting` mais antigo por `arrived_at` com `professional_id is null or = p_professional_id`, com `for update skip locked`; nenhum → 'Fila vazia para este profissional.'; grava `professional_id`, `status = 'in_progress'`, `starts_at = now()`, `ends_at = now() + duration`; evento `called`.
  - Remover da fila e marcar falta reusam `cancel_appointment` e `mark_no_show` (Task 2).
- Produces (TS) `src/lib/agenda/queue.ts`:
  - `type QueueEntry = { id: string; arrivedAt: string; durationMinutes: number; professionalId: string | null }`
  - `type Server = { professionalId: string; busyUntil: string | null }` (fim estimado do atendimento em curso; nulo = livre)
  - `estimateWaits(queue: QueueEntry[], servers: Server[], now: string): Map<string, number | null>` → minutos de espera por entrada. Algoritmo: `freeAt[p] = max(now, busyUntil)`; percorre a fila por `arrivedAt`; com preferência usa `freeAt[preferido]` (nulo se o preferido não está em `servers`); sem preferência usa o menor `freeAt`; soma a duração a esse `freeAt`; espera = início − now, arredondada para cima em minutos. Sem `servers` → todos nulos.
- Actions: `enqueueWalkIn(prev: FormState, formData: FormData): Promise<FormState>`, `callNextWalkIn(professionalId: string): Promise<ActionResult<{ customerName: string }>>`.
- Página `/agenda/fila` (todos os perfis): lista por ordem de chegada com posição, cliente, serviços, "aguarda {profissional}" ou "qualquer profissional", chegada (`HH:MM`) e "espera ~{n} min" (ou "sem estimativa"); bloco "Em atendimento" por profissional; botão "Chamar próximo" para **todo** profissional ativo (a recepção decide; o profissional vê só o próprio); por item, "Remover" e "Faltou" (admin/recepção). Para a estimativa, `servers` = profissionais ativos com intervalo de jornada cobrindo o horário atual local e sem bloqueio agora (fora do expediente a fila mostra "sem estimativa"). `RealtimeRefresh` na página.
- "Cliente na porta" (admin/recepção, visível na agenda e na fila, fixo acima do rodapé no celular): Dialog com `CustomerPicker`, serviços e profissional opcional ("Qualquer profissional" por padrão) → "Entrar na fila".

- [ ] **Step 1: Failing unit test** `queue.test.ts` (now = `2026-11-20T13:00:00Z`):
  - 1 profissional livre, fila A(30), B(20) → A 0, B 30 (a soma do spec);
  - 1 profissional ocupado até +15 min → A 15, B 45;
  - 2 profissionais livres, fila A(30), B(30), C(30) → A 0, B 0, C 30;
  - fila A(30, prefere P2), B(30, qualquer) com P1 e P2 livres → A 0, B 0;
  - preferido fora de `servers` → nulo; sem `servers` → todos nulos.
- [ ] **Step 2: Failing pgTAP** `walk_in.test.sql`: recepção enfileira A (qualquer), depois B (prefere P2), depois C (qualquer); P1 chama → recebe A; P1 chama de novo → 'Profissional já está em atendimento.'; P1 conclui A e chama → recebe **C**, não B *(Review Focus 4)*; P2 chama → recebe B; P2 chama com fila vazia para ele → 'Fila vazia para este profissional.'; profissional P1 tenta chamar para P2 → 'Sem permissão.'; profissional lê a fila geral mas não um walk-in esperando colega *(Review Focus 5)*; `call_next` com profissional de outro salão → 'Sem permissão.'.
- [ ] **Step 3:** `npm test && npm run db:test` → FAIL.
- [ ] **Step 4: Implementar** migration, `queue.ts`, actions, página e diálogo.
- [ ] **Step 5: e2e** `walk-in.spec.ts` com dois contextos de navegador no salão demo (após `db:reset`): o admin abre `/agenda/fila`; a recepção, em outro contexto, usa "Cliente na porta" com cliente novo e "Corte masculino" → **sem recarregar**, a tela do admin mostra o cliente na fila *(Realtime)* (não afirmar o texto da estimativa: ela depende da hora em que o teste roda e já é coberta pelo unit test); o admin clica "Chamar próximo" de Paulo Profissional → o cliente sai da fila e aparece em "Em atendimento"; um segundo walk-in marcado "Faltou" sai da fila.
- [ ] **Step 6:** `npm run db:reset && npm run db:types && npm test && npm run db:test && npx playwright test tests/e2e/walk-in.spec.ts` → PASS.
- [ ] **Step 7: Commit** `feat: fila de walk-in por ordem de chegada com chamada e espera ao vivo`.

---

### Task 6: Dados de demonstração e verificação da fase

**Files:**
- Modify: `supabase/seed.sql`, `tests/e2e/seed.spec.ts`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Failing e2e** em `seed.spec.ts`: `recepcao@salonix.dev` abre `/agenda` na próxima terça **estritamente depois de hoje** no fuso de São Paulo (`?data=` calculado no teste com a mesma regra do seed) e vê "Carlos Cliente" às 10:00 com Paulo Profissional; `/agenda/fila` mostra "Bruna Souza" na fila.
- [ ] **Step 2: Seed:** um agendamento de Carlos Cliente (Corte masculino) com Paulo na próxima terça estritamente depois de hoje, 10:00 local, calculada em SQL a partir de `now()` no fuso do salão (`hoje + (((2 - dow + 7) % 7) + 7 se o resultado for 0)` dias); um walk-in `waiting` de Bruna Souza (Barba, qualquer profissional) chegado agora; eventos `created` correspondentes. Inserir como `postgres` respeitando os checks.
- [ ] **Step 3:** `npm run db:reset && npx playwright test tests/e2e/seed.spec.ts` → PASS.
- [ ] **Step 4: Verificação completa:** `npm run lint && npx tsc --noEmit && npm test && npm run db:test && npm run build && npm run db:reset && npm run test:e2e` → tudo PASS (anotar as contagens).
- [ ] **Step 5:** README: linha sobre a trava de horário no banco (exclusion constraint) e sobre a escrita de atendimentos só por RPC. `CLAUDE.md`: status das fases (Fase 3 pronta) e, na arquitetura, "appointments: leitura por RLS, escrita só por RPCs security definer que gravam `appointment_events`; Realtime via `RealtimeRefresh`".
- [ ] **Step 6: Commit** `feat: dados de demonstração da agenda e verificação da Fase 3`.
