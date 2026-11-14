# Salonix — Fase 2 (Cadastros) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastros que a agenda (Fase 3) e o atendimento (Fase 4) vão consumir: serviços (duração e preço), profissionais (cor, comissão padrão e por serviço, vínculo com login, jornada semanal e bloqueios) e clientes (nome, WhatsApp, observações, busca sem acento).

**Architecture:** Mesmo padrão da Fase 1: tabelas com `salon_id` + RLS via `is_salon_member` / `has_salon_role`; escrita por Server Actions validadas com Zod; operações de várias linhas ou com conversão de fuso viram RPCs `security invoker` (RLS continua valendo). Tabelas filhas usam FK composta `(x_id, salon_id)` para que uma linha nunca aponte para registro de outro salão. Serviços e profissionais não são apagados, só desativados (a Fase 3 vai referenciá-los).

**Tech Stack:** o da Fase 1 (Next.js 16, Supabase local, Zod 4, shadcn/ui sobre Base UI, Vitest, pgTAP, Playwright). Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-13-salonix-mvp-design.md` (§6 modelo, §8 permissões, §11 fase 2, §12 decisões)

Branch: `fase-2-cadastros` (criada a partir de `fase-1-base`).

## Global Constraints

- Tudo da seção Global Constraints de `docs/superpowers/plans/2026-11-13-fase-1-base.md` continua valendo (pt-BR, centavos, `timestamptz`, RLS + pgTAP em toda tabela, mobile-first, estados de loading/vazio/erro, commits em português).
- Toda página e action chama `requireRole` primeiro e filtra pelo `salon.id` retornado, nunca por um id de salão vindo do cliente.
- Preço: `price_cents integer >= 0`. Duração: `duration_minutes` inteiro entre 5 e 480, múltiplo de 5.
- Comissão: `numeric(5,2)` entre 0 e 100.
- Dia da semana: `weekday smallint` 0–6, **0 = domingo** (igual a `Date.getDay()` e `extract(dow)`).
- Telefone de cliente guardado só com dígitos, DDD + número (10 ou 11 dígitos); exibido como `(11) 98888-7777`.
- Recepção nunca lê percentuais de comissão; profissional só lê os próprios (anti-objetivo do spec §2).
- Depois de cada migration: `npm run db:reset && npm run db:types`.

## Review Focus

1. **Preço digitado do jeito brasileiro** ("45", "45,5", "1.234,56", "R$ 30,00") vira o valor exato em centavos; "abc", "-5" e "1,234" são recusados com mensagem. → unit test na Task 1.
2. **Jornada com intervalos sobrepostos** no mesmo dia (09:00–12:00 e 11:00–14:00) é recusada; intervalos encostados (09:00–12:00 e 12:00–18:00) são aceitos. → unit + pgTAP na Task 3.
3. **Bloqueio digitado no horário do salão** (20/11 12:00 em São Paulo) é gravado como 15:00 UTC; folga de dia inteiro vai até a meia-noite local do dia seguinte. → pgTAP + unit na Task 3.
4. **Recepção abrindo comissões** (pela API, não pela UI) não vê nenhuma linha; profissional vê só as próprias. → pgTAP na Task 2.
5. **Mesmo telefone digitado de formas diferentes** ("(11) 98888-7777" e "11988887777") é tratado como duplicado no salão, com mensagem clara; em outro salão é permitido. → unit + pgTAP na Task 4.

## Decisões desta fase (corrigíveis)

- Comissão fica numa tabela só, `commission_rates` (`service_id` nulo = padrão do profissional), em vez de `professionals.commission_percent` + `professional_service_commissions` do spec §6. Motivo: `professionals` precisa ser legível por toda a equipe (agenda), e o percentual não pode ser.
- O vínculo profissional ↔ login é feito pelo admin na tela do profissional, escolhendo um membro do salão (RPC `link_professional_user`), e não pelo convite. Cobre o caso "admin que também atende" e o convidado que aceitou depois.
- Jornada e bloqueios são editados só pelo admin nesta fase.
- Cliente pode ser apagado pelo admin (a Fase 3 decidirá o que fazer com clientes que já têm atendimentos).

## File Structure

```
supabase/migrations/20261114000001_services.sql
supabase/migrations/20261114000002_professionals.sql      # professionals, commission_rates, RPCs
supabase/migrations/20261114000003_schedules.sql          # professional_schedules, schedule_blocks, RPCs
supabase/migrations/20261114000004_customers.sql
supabase/tests/{services,professionals,schedules,customers}.test.sql
supabase/seed.sql                                          # + dados de demonstração da fase
src/lib/money.ts                                           # parseBRLToCents
src/lib/phone.ts                                           # normalizePhone, formatPhone
src/lib/search.ts                                          # normalizeSearch
src/lib/professionals/schedule.ts                          # tipos e validação da jornada
src/lib/validation/{services,professionals,customers}.ts
src/lib/navigation.ts                                      # + Clientes, Serviços, Profissionais
src/app/(app)/servicos/{page.tsx,actions.ts,services-client.tsx}
src/app/(app)/profissionais/{page.tsx,actions.ts,professionals-client.tsx}
src/app/(app)/profissionais/[id]/{page.tsx,schedule-editor.tsx,blocks-client.tsx,commissions-client.tsx}
src/app/(app)/clientes/{page.tsx,actions.ts,customers-client.tsx}
tests/unit/{money,phone,search,schedule,validation-services,validation-professionals,navigation}.test.ts
tests/e2e/{services,professionals,customers}.spec.ts
```

---

### Task 1: Serviços

**Files:**
- Create: `supabase/migrations/20261114000001_services.sql`, `supabase/tests/services.test.sql`, `src/lib/money.ts`, `src/lib/validation/services.ts`, `src/app/(app)/servicos/{page.tsx,actions.ts,services-client.tsx}`, `tests/unit/money.test.ts`, `tests/unit/validation-services.test.ts`, `tests/e2e/services.spec.ts`
- Modify: `src/lib/navigation.ts`, `tests/unit/navigation.test.ts`, `src/lib/supabase/database.types.ts` (gerado)

**Interfaces:**
- Produces (SQL): `services(id, salon_id, name text 2..80, duration_minutes int, price_cents int, active bool default true, created_at, updated_at)`, `unique (id, salon_id)`, índice único `(salon_id, lower(name))`. Policies: select para `is_salon_member`; insert/update para `has_salon_role(salon_id, '{admin}')`; sem delete.
- Produces (TS): `parseBRLToCents(input: string): number | null` em `src/lib/money.ts`; `serviceSchema` (campos `id?: uuid`, `name`, `durationMinutes`, `price` → `priceCents`); actions `saveService(prev: FormState, formData: FormData): Promise<FormState>` (com `id` atualiza, sem `id` cria) e `setServiceActive(id: string, active: boolean): Promise<ActionResult>`.
- Produces (nav): itens novos em `ITEMS`, nesta ordem depois de Caixa: `Clientes /clientes` (todos, `primary: false`), e depois de Financeiro: `Serviços /servicos` (admin) e `Profissionais /profissionais` (admin). As rotas de Clientes e Profissionais chegam nas Tasks 2 e 4; até lá os links levam a 404, aceitável dentro da branch.

- [ ] **Step 1: Failing unit tests** em `tests/unit/money.test.ts`:
  `"45"→4500`, `"45,5"→4550`, `"45,50"→4550`, `"1.234,56"→123456`, `"R$ 30,00"→3000`, `" 0 "→0`, `"45.50"→4550` (ponto como decimal quando não há vírgula e tem 1–2 casas), e `null` para `"abc"`, `""`, `"-5"`, `"1,234"`, `"45,555"`. Sem aritmética de float: separar parte inteira e centavos como strings.
  Em `tests/unit/validation-services.test.ts`: duração 7 → erro "Use múltiplos de 5 minutos"; 0 e 485 → erro "Entre 5 e 480 minutos"; preço inválido → "Informe um preço válido, ex.: 45,00".
  Em `tests/unit/navigation.test.ts`: admin vê `["/painel","/agenda","/caixa","/clientes","/estoque","/financeiro","/servicos","/profissionais","/equipe","/configuracoes"]`; recepção vê `["/painel","/agenda","/caixa","/clientes","/estoque"]`; profissional contém `/clientes` e não contém `/servicos` nem `/profissionais`.
- [ ] **Step 2: Failing pgTAP** `supabase/tests/services.test.sql` (copie os helpers `t.create_user/login/logout` de `tenancy.test.sql`): admin cria e edita serviço; recepção e profissional não inserem (`42501`) e um update deles afeta 0 linhas; membro de outro salão vê 0 serviços; nome repetido com outra caixa ("Corte" e "corte") no mesmo salão → `23505`, em outro salão é permitido; `duration_minutes = 7` e `price_cents = -1` violam check (`23514`); delete por admin não apaga nada.
- [ ] **Step 3:** `npm test && npm run db:test` → FAIL nos testes novos.
- [ ] **Step 4: Implementar** migration, `money.ts`, schema e actions. `saveService` traduz `23505` para "Já existe um serviço com este nome." Página `/servicos` (`requireRole(["admin"])`): lista ativos primeiro, cada linha com nome, duração ("30 min", "1h30") e `formatBRL`, botão Editar (abre dialog com o mesmo formulário) e Desativar/Reativar; botão "Novo serviço"; `EmptyState` quando não houver nenhum. Preço é `Input` com `inputMode="decimal"`; duração é `type="number"` com `step=5`.
- [ ] **Step 5: e2e** `tests/e2e/services.spec.ts`: admin cria "Corte masculino", 30, "45,00" → aparece "R$ 45,00" e "30 min"; edita para "50" → "R$ 50,00"; desativa → aparece como inativo; recepção que abre `/servicos` vai para `/painel`.
- [ ] **Step 6:** `npm run db:reset && npm run db:types && npm test && npm run db:test && npx playwright test tests/e2e/services.spec.ts tests/e2e/layout.spec.ts` → PASS.
- [ ] **Step 7: Commit** `feat: cadastro de serviços com preço e duração`.

---

### Task 2: Profissionais e comissões

**Files:**
- Create: `supabase/migrations/20261114000002_professionals.sql`, `supabase/tests/professionals.test.sql`, `src/lib/validation/professionals.ts`, `src/app/(app)/profissionais/{page.tsx,actions.ts,professionals-client.tsx}`, `src/app/(app)/profissionais/[id]/{page.tsx,commissions-client.tsx}`, `tests/unit/validation-professionals.test.ts`, `tests/e2e/professionals.spec.ts`

**Interfaces:**
- Consumes: `services` (Task 1).
- Produces (SQL):
  - `professionals(id, salon_id, user_id uuid null references auth.users on delete set null, name text 2..80, color text check '^#[0-9A-Fa-f]{6}$', active bool default true, created_at, updated_at)`, `unique (id, salon_id)`, `unique (salon_id, user_id)`. Select: membros; insert/update: admin. **Grants por coluna:** `revoke insert, update on public.professionals from authenticated` e devolver `insert (salon_id, name, color, active)` / `update (name, color, active)`, para que `user_id` só mude pela RPC.
  - `commission_rates(id, salon_id, professional_id, service_id uuid null, percent numeric(5,2) check 0..100, created_at, updated_at)`, FKs compostas `(professional_id, salon_id) → professionals (id, salon_id)` e `(service_id, salon_id) → services (id, salon_id)`, índices únicos `(professional_id) where service_id is null` e `(professional_id, service_id) where service_id is not null`. Select: admin **ou** `exists (select 1 from professionals p where p.id = professional_id and p.user_id = auth.uid())`; insert/update/delete: admin.
  - `save_professional(p_salon_id uuid, p_id uuid, p_name text, p_color text, p_commission_percent numeric, p_active boolean default true) returns public.professionals`, `security invoker` (a RLS barra quem não é admin de `p_salon_id`): `p_id` nulo cria, senão atualiza o profissional daquele salão; faz upsert da taxa padrão na mesma transação.
  - `link_professional_user(p_professional_id uuid, p_user_id uuid) returns void`, `security definer`, `search_path = ''`: exige `has_salon_role(salon, '{admin}')`; `p_user_id` precisa ser membro ativo do mesmo salão (ou nulo para desvincular); senão `raise exception 'Pessoa não faz parte da equipe.'`.
  - `commission_percent_for(p_professional_id uuid, p_service_id uuid) returns numeric`, `security invoker`, `stable`: taxa do serviço, senão a padrão, senão 0. A Fase 4 usa no recebimento.
- Produces (TS): `PROFESSIONAL_COLORS` (8 hex fixos, com contraste para texto branco) e `professionalSchema` (`name`, `color` ∈ paleta, `commissionPercent` "40" ou "37,5" → number 0–100) em `src/lib/validation/professionals.ts`; actions `saveProfessional(prev, formData): Promise<FormState>`, `setProfessionalActive(id, active): Promise<ActionResult>`, `saveServiceCommission(professionalId: string, serviceId: string, percent: string): Promise<ActionResult>` (string vazia remove a sobrescrita), `linkProfessionalUser(professionalId: string, userId: string | null): Promise<ActionResult>`.

- [ ] **Step 1: Failing pgTAP** `professionals.test.sql`: admin cria profissional via `save_professional` com 40% → existe linha padrão de 40; recepção não cria; membro de outro salão não vê profissionais; admin não consegue `update professionals set user_id = ...` (`42501`); `link_professional_user` com membro ativo funciona, com usuário de outro salão lança 'Pessoa não faz parte da equipe.', chamado por recepção lança erro; `commission_percent_for` retorna a sobrescrita (50) quando existe e a padrão (40) para outro serviço; `commission_rates` com `service_id` de outro salão viola FK (`23503`); **recepção lê 0 linhas de `commission_rates`; o profissional vinculado lê só as suas** *(Review Focus 4)*; percent 101 → `23514`.
- [ ] **Step 2: Failing unit test** em `tests/unit/validation-professionals.test.ts`: "37,5" → 37.5; "101" → erro "Entre 0 e 100%"; cor fora da paleta → erro "Escolha uma cor".
- [ ] **Step 3:** `npm test && npm run db:test` → FAIL.
- [ ] **Step 4: Implementar.** `/profissionais` (admin): lista com bolinha da cor, nome, comissão padrão, "Com acesso ao app" / "Sem login", ativo/inativo; "Novo profissional" abre dialog (nome, cor em radio de bolinhas com alvo ≥ 44px, comissão). Linha leva a `/profissionais/[id]`, que tem as seções **Dados** (mesmo formulário), **Acesso ao app** (`select` com membros ativos do salão que ainda não estão vinculados a outro profissional + "Sem acesso") e **Comissão por serviço** (cada serviço ativo com input de % e placeholder mostrando a padrão; salvar ao sair do campo, toast de confirmação). `[id]` inexistente ou de outro salão → `notFound()`.
- [ ] **Step 5: e2e** `professionals.spec.ts`: admin cria "Marcos" com 50% e cor; abre o detalhe, vincula ao próprio usuário admin, define 60% em um serviço criado no teste; recarrega e os valores continuam; profissional que abre `/profissionais` vai para `/painel`.
- [ ] **Step 6:** `npm run db:reset && npm run db:types && npm test && npm run db:test && npx playwright test tests/e2e/professionals.spec.ts` → PASS.
- [ ] **Step 7: Commit** `feat: cadastro de profissionais com comissão padrão e por serviço`.

---

### Task 3: Jornada e bloqueios

**Files:**
- Create: `supabase/migrations/20261114000003_schedules.sql`, `supabase/tests/schedules.test.sql`, `src/lib/professionals/schedule.ts`, `src/app/(app)/profissionais/[id]/{schedule-editor.tsx,blocks-client.tsx}`, `tests/unit/schedule.test.ts`
- Modify: `src/app/(app)/profissionais/[id]/page.tsx`, `src/app/(app)/profissionais/actions.ts`, `tests/e2e/professionals.spec.ts`

**Interfaces:**
- Consumes: `professionals` (Task 2).
- Produces (SQL):
  - `professional_schedules(id, salon_id, professional_id, weekday smallint check 0..6, starts_at time, ends_at time, check (ends_at > starts_at))`, FK composta para `professionals`, `on delete cascade`. Select: membros; insert/delete: admin.
  - `set_professional_schedule(p_professional_id uuid, p_slots jsonb) returns setof public.professional_schedules`, `security invoker`: apaga a jornada do profissional e insere `p_slots` (`[{"weekday":2,"starts_at":"09:00","ends_at":"12:00"}, ...]`); se dois intervalos do mesmo dia se sobrepõem, `raise exception 'Horários se sobrepõem na jornada.'` (a transação inteira volta).
  - `schedule_blocks(id, salon_id, professional_id, starts_at timestamptz, ends_at timestamptz, kind text check in ('day_off','vacation','break','other'), note text null check length ≤ 200, created_by uuid default auth.uid(), created_at)`, `check (ends_at > starts_at)`, índice `(professional_id, starts_at)`. Select: membros; insert/delete: admin.
  - `create_schedule_block(p_professional_id uuid, p_starts_local timestamp, p_ends_local timestamp, p_kind text, p_note text default null) returns public.schedule_blocks`, `security invoker`: converte com `p_starts_local at time zone s.timezone` usando o fuso do salão do profissional.
- Produces (TS) em `src/lib/professionals/schedule.ts`: `type ScheduleSlot = { weekday: number; startsAt: string; endsAt: string }` (`"HH:MM"`); `WEEKDAY_LABELS` (`["Domingo", ..., "Sábado"]`); `findScheduleOverlap(slots: ScheduleSlot[]): number | null` (weekday do primeiro conflito); `scheduleSchema` (array de slots, rejeita fim ≤ início com "O fim deve ser depois do início" e sobreposição com "Horários se sobrepõem em {dia}"); `blockSchema` (`kind`, `startDate`, `endDate`, `allDay`, `startTime?`, `endTime?`, `note?`) com transform para `{ startsLocal: string; endsLocal: string }` no formato `"YYYY-MM-DD HH:MM"`, sendo dia inteiro de `startDate 00:00` até `(endDate + 1 dia) 00:00`. Actions: `saveSchedule(professionalId: string, slots: ScheduleSlot[]): Promise<ActionResult>`, `addScheduleBlock(prev: FormState, formData: FormData): Promise<FormState>`, `removeScheduleBlock(id: string): Promise<ActionResult>`.

- [ ] **Step 1: Failing unit tests** `schedule.test.ts`: `findScheduleOverlap` com 09:00–12:00 e 11:00–14:00 na terça → 2; com 09:00–12:00 e 12:00–18:00 → null; mesmos horários em dias diferentes → null. `blockSchema`: folga de dia inteiro 20/11 a 22/11 → `{ startsLocal: "2026-11-20 00:00", endsLocal: "2026-11-23 00:00" }`; 31/12 dia inteiro → fim `"2027-01-01 00:00"`; data final antes da inicial → erro "A data final deve ser igual ou depois da inicial". *(Review Focus 2 e 3)*
- [ ] **Step 2: Failing pgTAP** `schedules.test.sql`: admin grava jornada de dois intervalos na terça e lê 2 linhas; jornada sobreposta lança 'Horários se sobrepõem na jornada.' e a jornada anterior continua intacta; recepção não grava; `create_schedule_block(prof, '2026-11-20 12:00', '2026-11-20 13:00', 'break')` em salão `America/Sao_Paulo` grava `starts_at = '2026-11-20 15:00:00+00'` *(Review Focus 3)*; membro de outro salão não vê jornada nem bloqueios.
- [ ] **Step 3:** `npm test && npm run db:test` → FAIL.
- [ ] **Step 4: Implementar.** Na página do profissional, seção **Jornada**: uma linha por dia da semana com interruptor "Trabalha", intervalos com dois `input type="time"`, "+ intervalo" e remover; botão "Salvar jornada" (erro por dia aparece embaixo do dia). Seção **Bloqueios**: lista dos próximos (fim ≥ agora), com tipo ("Folga", "Férias", "Intervalo", "Outro"), período formatado no fuso do salão e Remover; formulário com tipo, datas, "Dia inteiro" (marcado esconde os horários) e observação.
- [ ] **Step 5: e2e** em `professionals.spec.ts`: admin define terça 09:00–12:00 e 13:00–19:00, salva, recarrega e vê os dois intervalos; tenta 09:00–12:00 e 11:00–14:00 e vê "Horários se sobrepõem em Terça"; cria férias de dia inteiro e ela aparece na lista.
- [ ] **Step 6:** `npm run db:reset && npm run db:types && npm test && npm run db:test && npx playwright test tests/e2e/professionals.spec.ts` → PASS.
- [ ] **Step 7: Commit** `feat: jornada semanal e bloqueios de agenda dos profissionais`.

---

### Task 4: Clientes

**Files:**
- Create: `supabase/migrations/20261114000004_customers.sql`, `supabase/tests/customers.test.sql`, `src/lib/phone.ts`, `src/lib/search.ts`, `src/lib/validation/customers.ts`, `src/app/(app)/clientes/{page.tsx,actions.ts,customers-client.tsx}`, `tests/unit/{phone,search}.test.ts`, `tests/e2e/customers.spec.ts`

**Interfaces:**
- Produces (SQL): função `public.search_normalize(text) returns text` `immutable` (`lower(extensions.unaccent('extensions.unaccent', $1))`); `customers(id, salon_id, name text 2..120, phone text null check '^\d{10,11}$', notes text null check length ≤ 500, name_search text generated always as (public.search_normalize(name)) stored, created_at, updated_at)`, `unique (id, salon_id)`, índice único `(salon_id, phone) where phone is not null`, índice em `(salon_id, name_search)`. Select: membros; insert/update: admin e recepção; delete: admin.
- Produces (TS): `normalizePhone(input: string): string | null` (tira tudo que não é dígito e um `55` inicial quando sobram 12 ou 13 dígitos; aceita 10 ou 11) e `formatPhone(digits: string): string` em `src/lib/phone.ts`; `normalizeSearch(input: string): string` (NFD, remove diacríticos, minúsculas, trim) em `src/lib/search.ts`; `customerSchema` (`id?`, `name`, `phone` opcional → normalizado, erro "Informe DDD + número", `notes` opcional); actions `saveCustomer(prev: FormState, formData: FormData): Promise<FormState>` (traduz `23505` para "Já existe um cliente com este telefone.") e `deleteCustomer(id: string): Promise<ActionResult>`.

- [ ] **Step 1: Failing unit tests:** `normalizePhone("(11) 98888-7777")` e `normalizePhone("11988887777")` → `"11988887777"`; `"+55 11 98888-7777"` → `"11988887777"`; `"(11) 3333-4444"` → `"1133334444"`; `"98888-7777"` → null. `formatPhone("11988887777")` → `"(11) 98888-7777"`, `formatPhone("1133334444")` → `"(11) 3333-4444"`. `normalizeSearch(" João ")` → `"joao"`. *(Review Focus 5)*
- [ ] **Step 2: Failing pgTAP** `customers.test.sql`: recepção cria e edita cliente; profissional lê mas não insere (`42501`); recepção não apaga (0 linhas), admin apaga; mesmo telefone no mesmo salão → `23505`, em outro salão permitido; `name_search` de "João Ávila" é "joao avila"; membro de outro salão vê 0 clientes.
- [ ] **Step 3:** `npm test && npm run db:test` → FAIL.
- [ ] **Step 4: Implementar.** `/clientes` (`requireRole()`, todos os perfis): campo de busca que vira `?q=` na URL; se `q` só tem dígitos, filtra `phone` por `like` com os dígitos, senão filtra `name_search` por `ilike` com `normalizeSearch(q)`, escapando `%` e `_`; ordem por nome, limite 50, com aviso "Mostrando os 50 primeiros. Refine a busca." quando atingir o limite. Linha mostra nome, `formatPhone` e o começo das observações. Admin e recepção veem "Novo cliente" e Editar (dialog); admin vê também Excluir, com confirmação no próprio dialog (sem `window.confirm`). Profissional vê só a lista. `EmptyState` distinto para "nenhum cliente ainda" e "nada encontrado para a busca".
- [ ] **Step 5: e2e** `customers.spec.ts`: recepção cria "João da Silva" com "(11) 98888-7777"; busca "joao" e "98888" encontram; criar outro com "11988887777" mostra "Já existe um cliente com este telefone."; profissional abre `/clientes`, vê a lista e não vê "Novo cliente".
- [ ] **Step 6:** `npm run db:reset && npm run db:types && npm test && npm run db:test && npx playwright test tests/e2e/customers.spec.ts` → PASS.
- [ ] **Step 7: Commit** `feat: cadastro de clientes com busca sem acento`.

---

### Task 5: Dados de demonstração e verificação da fase

**Files:**
- Modify: `supabase/seed.sql`, `tests/e2e/seed.spec.ts`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Failing e2e** em `seed.spec.ts`: `admin@salonix.dev` vê "Corte masculino" em `/servicos` e "Paulo Profissional" em `/profissionais`; `recepcao@salonix.dev` vê "Carlos Cliente" em `/clientes`.
- [ ] **Step 2: Seed** (ids fixos no padrão `00000000-0000-4000-8000-...`): serviços Corte masculino (30 min, 4500), Barba (30 min, 3500), Corte + barba (60 min, 7000); profissionais Paulo Profissional (vinculado a `pro@salonix.dev`, 40%, sobrescrita de 50% em Barba) e Marcos (sem login, 50%); jornada terça a sábado 09:00–12:00 e 13:00–19:00 para os dois; clientes Carlos Cliente, Bruna Souza e José Ávila com telefones de 11 dígitos. Inserir direto como `postgres` (o seed roda sem RLS).
- [ ] **Step 3:** `npm run db:reset && npx playwright test tests/e2e/seed.spec.ts` → PASS.
- [ ] **Step 4: Verificação completa:** `npm run lint && npx tsc --noEmit && npm test && npm run db:test && npm run build && npm run db:reset && npm run test:e2e` → tudo PASS (anotar as contagens no resumo da fase).
- [ ] **Step 5:** README: seção "Como o multi-salão funciona" ganha uma linha sobre FKs compostas `(id, salon_id)` e sobre `commission_rates` ser legível só por admin e pelo próprio profissional. `CLAUDE.md`: atualizar a frase de status das fases (Fase 2 pronta) e citar o padrão de FK composta na seção de arquitetura.
- [ ] **Step 6: Commit** `feat: dados de demonstração dos cadastros e verificação da Fase 2`.
