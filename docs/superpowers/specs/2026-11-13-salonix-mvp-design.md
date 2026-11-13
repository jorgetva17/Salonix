# Salonix — Design do MVP

Data: 2026-11-13 · Fonte de requisitos: `salonix.md` (raiz do projeto)

## 1. Intenção e porquê

Salonix é um app de gestão (SaaS) para barbearias e salões brasileiros de
pequeno e médio porte. Resolve a operação diária — agenda (incluindo clientes
sem hora marcada), atendimento e caixa, estoque, equipamentos, financeiro e
equipe com comissão — num só lugar, operável com uma mão no celular.

O MVP existe para ser **validado com 1–2 barbearias piloto** e depois evoluir
sem refatoração. Por isso a prioridade é: fluxo completo de atendimento
correto e testável > refinamento visual > integrações.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos (MVP)**
1. Agenda por profissional + fila de walk-in em tempo real.
2. Atendimento com forma de pagamento (dinheiro, débito, crédito, Pix).
3. Estoque com baixa automática por serviço.
4. Equipamentos e histórico de manutenção.
5. Financeiro: recebimentos, contas a pagar, fechamento de caixa, relatórios.
6. Usuários com perfis Admin/Dono, Recepção, Profissional.
7. Comissão percentual por profissional, com sobrescrita opcional por serviço.
8. Logo própria do salão e tema claro/dark persistido.
9. PWA instalável; pt-BR, BRL, fuso America/Sao_Paulo.

**Não-objetivos (fases futuras)**
- Conciliação automática com operadoras de cartão (camada preparada, flag desligada).
- Envio automático de WhatsApp (MVP: link `wa.me` com mensagem pronta).
- Push, e-commerce, fidelidade, multi-unidades na UI, app do cliente final.
- Cobrança/assinatura dos salões pelo Salonix (o MVP não tem planos pagos).

**Anti-objetivos (falha mesmo que "funcione")**
- Qualquer vazamento de dados entre salões.
- Recepção vendo relatórios financeiros/comissões; Profissional vendo
  ganhos de outros profissionais.
- Ações principais (agendar, atender, receber) exigindo mais de 2 toques.
- Totais financeiros com erro de arredondamento.

## 3. Restrições

- Stack: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui;
  Supabase (PostgreSQL, Auth, Storage, Realtime).
- Desenvolvimento com Supabase local via Docker (Supabase CLI); nuvem só na
  hora dos pilotos.
- Timestamps em UTC (`timestamptz`); exibição no fuso do salão
  (padrão `America/Sao_Paulo`).
- Valores monetários em **centavos (integer)** — nunca float.
- Validação de entrada no cliente e no servidor (mesmo schema Zod).
- Mobile-first: rodapé de navegação e botões grandes no celular; layout
  fluido em tablet/desktop.
- Estados de loading, vazio e erro em todas as telas, mensagens em pt-BR.

## 4. Abordagens consideradas (multi-tenant)

| Abordagem | Trade-off | Decisão |
|---|---|---|
| **A. Banco compartilhado, `salon_id` em toda tabela + RLS por associação** | Padrão do Supabase, simples, permite usuário em vários salões no futuro. Exige disciplina: toda tabela nova precisa de policy (coberto por testes). | **Escolhida** pelo usuário. |
| B. Schema por salão | Isolamento físico, mas migrações N vezes e onboarding complexo; Supabase não favorece. | Descartada. |
| C. Backend próprio (Prisma + Postgres) | Mais controle, mas perde Auth/Storage/Realtime prontos e foge da stack pedida. | Descartada. |

## 5. Arquitetura

- **Next.js App Router** com Server Components para leitura e **Server
  Actions** para escrita; cliente Supabase via `@supabase/ssr` (cookies).
- **Regras de negócio críticas no banco** como funções Postgres (RPC,
  `security invoker`, transacionais): concluir atendimento, abrir/fechar
  caixa, enfileirar walk-in. Garante atomicidade (pagamento + baixa de
  estoque + comissão acontecem juntos ou nada acontece).
- **RLS** em todas as tabelas com `salon_id`. Funções auxiliares:
  `is_salon_member(salon_id)` e `has_salon_role(salon_id, roles[])`, lendo
  `salon_members`. Roles validadas no banco, não só na UI.
- **Realtime**: assinatura da tabela de agendamentos filtrada por
  `salon_id` para a fila de walk-in e a agenda do dia.
- **Storage**: bucket `salon-logos`, caminho `{salon_id}/logo.{ext}`,
  policies permitindo escrita só para admin do salão.

## 6. Modelo de dados (resumo)

Todas as tabelas de negócio têm `id uuid`, `salon_id`, `created_at`,
`updated_at`. Valores em centavos.

- `salons` — nome, slug, timezone, logo_path_light, logo_path_dark,
  horário de funcionamento padrão, telefone.
- `profiles` — 1:1 com `auth.users`: nome, telefone, `theme`
  (`light|dark|system`).
- `salon_members` — (salon_id, user_id, role `admin|reception|professional`,
  active). Um usuário pode ter um vínculo por salão.
- `professionals` — salon_id, `user_id` (nullable: profissional pode existir
  sem login), nome, cor na agenda, `commission_percent` padrão, ativo.
- `professional_schedules` — dia da semana, início, fim (jornada).
- `schedule_blocks` — profissional, início, fim, motivo (folga, férias, almoço).
- `services` — nome, duração (min), preço (centavos), ativo.
- `professional_service_commissions` — sobrescrita de % por
  (profissional, serviço).
- `customers` — nome, telefone (WhatsApp), observações.
- `appointments` (o "atendimento") — customer, professional (nullable
  enquanto walk-in aguarda na fila geral), `starts_at`, `ends_at`,
  `kind` (`scheduled|walk_in`), `status`
  (`scheduled|waiting|in_progress|awaiting_payment|paid|cancelled|no_show`),
  `arrived_at` (ordem da fila walk-in), desconto, total.
- `appointment_items` — itens do atendimento: `item_type`
  (`service|product`), service_id ou inventory_item_id, quantidade, preço
  unitário cobrado, profissional que executou. Combos, extras no meio do
  atendimento e venda de produto no balcão são itens.
- `appointment_events` — histórico: criado, reagendado, cancelado,
  iniciado, concluído (quem, quando, dados anteriores).
- `inventory_items` — nome, unidade, quantidade atual, estoque mínimo,
  custo unitário, preço de venda (nullable; preenchido = vendável no balcão).
- `service_consumables` — (serviço, item, quantidade por atendimento).
- `stock_movements` — item, tipo (`in|out|adjust|consumption`), quantidade,
  referência ao atendimento quando consumo.
- `equipment` — nome, status (`active|maintenance|inactive`), responsável.
- `equipment_maintenance` — equipamento, data, descrição, custo,
  próxima manutenção.
- `cash_sessions` — **uma sessão aberta por salão** (constraint). Abertura
  (valor inicial, quem, quando), fechamento (valores contados por forma de
  pagamento, diferença, quem, quando).
- `transactions` — `type` (`income|expense`), categoria, valor, forma de
  pagamento, `status` (`pending|paid|reversed`), vencimento, data de
  pagamento, referência a atendimento e a `cash_session`. Contas a pagar =
  despesas `pending` com vencimento. Pix nasce `pending` até confirmação
  manual. `reverses_id` para estornos.
- `commissions` — atendimento, item, profissional, base, %, valor, mês de
  referência, `status` (`blocked|available|paid|reversed`), data de
  pagamento ao profissional.
- `feature_flags` — por salão: `card_reconciliation`, `pix_webhook`
  (desligadas).

## 7. Fluxos principais

**Onboarding**: cadastro público com e-mail/senha cria usuário + salão +
vínculo `admin`. O admin convida equipe por e-mail (convite do Supabase
Auth), escolhendo o perfil. Recuperação de senha pelo fluxo do Supabase.
Em dev, e-mails caem no Mailpit/Inbucket local.

**Agendamento**: agenda diária/semanal por profissional; criação respeita
jornada, bloqueios e conflitos. Reagendar e cancelar geram evento no
histórico. Link "Lembrar no WhatsApp" gera `wa.me` com mensagem pronta.

**Walk-in ("Cliente na porta")** — *decidido pelo usuário: fila única
por ordem de chegada*. Um toque abre formulário mínimo (nome, serviço(s),
profissional opcional). Cria `appointment kind=walk_in status=waiting`
com `arrived_at`, **sem reservar horário na agenda**. Sem preferência, o
cliente fica na fila geral e é chamado pelo primeiro profissional que
ficar livre; com preferência, aguarda aquele profissional (mesma fila,
filtrada). A recepção vê posição e estimativa de espera (soma das durações
restantes dos atendimentos em curso e da fila à frente), ao vivo via
Realtime. "Chamar próximo" atribui o profissional e passa a
`in_progress`. Atrasos e no-shows não reordenam a fila: ela é sempre por
`arrived_at`; a recepção pode remover ou marcar `no_show`.

**Atendimento** — *decidido pelo usuário*: profissional (ou recepção)
inicia → adiciona/ajusta itens → **conclui** (`awaiting_payment`) → a
**recepção/admin recebe** o pagamento (uma ou mais formas). O
recebimento roda **uma RPC transacional**: grava `transactions` ligadas à
sessão de caixa aberta, baixa estoque (consumíveis dos serviços +
produtos vendidos) em `stock_movements`, grava `commissions` por item de
serviço e marca `paid`. Receber exige caixa aberto (todas as formas).
Pix pendente: atendimento fica `paid`, mas a comissão fica `blocked` até
a confirmação manual do Pix, quando vira `available`.

**Correções** (admin): atendimento pago não é editado; faz-se estorno,
que cria lançamentos inversos (transação `reversed` + nova saída, estoque
de volta, comissão `reversed`) e evento no histórico.

**Caixa**: uma sessão aberta por salão. Abrir com valor inicial; ao
fechar, sistema mostra o esperado por forma de pagamento (Pix pendente
aparece em linha separada, fora do total conferido), usuário informa o
contado, grava diferença.

**Comissões**: relatório mensal por profissional; admin marca como paga
(opcionalmente gerando a despesa correspondente em `transactions`).

**Relatórios** (admin): faturamento por período, serviço, profissional e
forma de pagamento; custo real por atendimento (custo dos consumíveis);
comissões do mês. Profissional vê só seus atendimentos, recebimentos e
comissão.

## 8. Permissões por perfil

| Área | Admin | Recepção | Profissional |
|---|---|---|---|
| Agenda / walk-in | tudo | tudo | só a própria |
| Atendimento e pagamento | sim | sim | iniciar/concluir os próprios |
| Caixa (abrir/fechar) | sim | sim | não |
| Clientes | sim | sim | leitura |
| Estoque / equipamentos | sim | leitura | leitura |
| Financeiro e relatórios | sim | não | só os próprios ganhos |
| Equipe, comissões, configurações, logo | sim | não | não |

## 9. Identidade visual

- Paleta: azul-petróleo `#1B3B4B` (primária), âmbar `#F59E0B` (destaque),
  tokens CSS para claro/dark via `next-themes`; preferência salva em
  `profiles.theme`.
- Logos fornecidas são JPEG com fundo sólido e **nomes trocados**:
  `Salonix_Normal.jpeg` (texto branco) serve ao tema dark;
  `Salonix_Dark2.jpeg` (texto azul) serve ao tema claro. Serão convertidas
  em PNG com fundo transparente (e ícones PWA 192/512/maskable) e ficam
  como logo padrão de fallback.
- Upload de logo do salão: PNG/JPG/SVG, até 2 MB, uma versão para claro e
  opcional para dark; exibida sempre via `<img>` (SVG nunca inline).

## 10. Testes e qualidade

- Unitários (Vitest): cálculo de comissão, próximo horário livre, totais
  de caixa, formatação BRL/fuso.
- Banco (pgTAP via `supabase test db`): **isolamento entre salões e
  permissões por perfil em toda tabela**; RPCs de atendimento e caixa.
- E2E (Playwright): fluxo completo — cadastrar salão → serviço →
  agendar/walk-in → atender → pagar → fechar caixa.

## 11. Fases de construção

1. **Base**: projeto, Supabase local, auth, onboarding de salão, convites e
   perfis, layout responsivo com navegação, tema, logo, PWA.
2. **Cadastros**: serviços, profissionais (jornada, bloqueios, comissão),
   clientes.
3. **Agenda + walk-in** em tempo real.
4. **Atendimento + caixa + comissão**.
5. **Estoque + equipamentos**.
6. **Financeiro + relatórios**.

Cada fase termina com testes passando e o app rodando.

## 12. Decisões tomadas pelo Claude (corrigíveis)

- Logo e personalização são **por salão** (o spec diz "por usuário";
  interpretado como por tenant, já que a equipe compartilha a marca).
- Comissão calculada sobre o **valor bruto** do serviço (sem descontar taxa
  de cartão) no MVP.
- Pagamento pode ser dividido em mais de uma forma; a UI usa uma por padrão.
- Uma sessão de caixa por salão; todas as formas de pagamento ficam ligadas a ela.
- Correção de atendimento pago só por estorno, feito pelo admin.
- Comissão tem estado "paga" marcado pelo admin; gerar a despesa é opcional.
- Ao convidar um profissional, o admin pode vincular o convite a um
  cadastro de profissional já existente (preenche `user_id`); um admin
  que também atende tem os dois registros (membro admin + profissional).
- Walk-in com profissional escolhido entra na mesma fila, aguardando
  aquele profissional (interpretação da resposta "fila única").
- Estoque pode ficar negativo após baixa automática (não bloqueia o
  atendimento), gerando alerta.
- Profissional pode existir sem login; Admin também pode ser profissional.
- Cor primária `#1B3B4B` do spec (a imagem mostra `#1B3B44`).

## 13. Deixado ao construtor

Estrutura de pastas, bibliotecas auxiliares (calendário, gráficos, PWA),
design detalhado de cada tela, nomes de colunas além do resumo acima,
seed de dados de demonstração.
