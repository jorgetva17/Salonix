# Salonix — Fase 3 (Agenda + walk-in em tempo real)

**Objetivo:** agendamento por profissional respeitando jornada, bloqueios e conflitos; fila única de walk-in por ordem de chegada ("Cliente na porta", "Chamar próximo", estimativa de espera) com Realtime; reagendar/cancelar/no-show com histórico; link de lembrete no WhatsApp.

## Decisões
- Toda escrita em `appointments` passa por **RPCs `security definer`** que checam o perfil (admin/recepção, ou o próprio profissional onde faz sentido). Tabelas ficam só com `select` para `authenticated`.
- Conflitos de horário garantidos no banco por **exclusion constraint** (`btree_gist`), ignorando cancelados/no-show.
- Walk-in **não reserva horário**: nasce `waiting` com `arrived_at`; ao ser chamado vira `in_progress` com `starts_at = now()`.
- Profissional enxerga só a própria agenda + walk-ins aguardando sem profissional definido.
- Cliente avulso: `guest_name` quando não há cadastro. Cliente com atendimentos não pode ser excluído.
- Fica para a Fase 4: concluir, receber, estoque, comissão (`awaiting_payment`/`paid`).

## Tarefas
1. Migration `..05_appointments.sql` + pgTAP.
2. Funções puras (estimativa de espera da fila, horários livres) + testes.
3. Actions + telas `/agenda` e `/fila` + assinatura Realtime.
4. Navegação, seed, lint/build/testes.
