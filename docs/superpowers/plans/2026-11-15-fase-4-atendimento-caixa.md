# Salonix — Fase 4 (Atendimento + Caixa + Comissão)

**Objetivo:** fluxo completo do atendimento: iniciar → ajustar itens → concluir → receber (uma ou mais formas) → comissão; caixa com abertura/fechamento e conferência; estorno pelo admin; Pix com confirmação manual.

## Decisões (spec §7 e §12)
- Escrita só por RPCs `security definer` com checagem de perfil (como na Fase 3); tabelas só com `select`.
- **Receber exige caixa aberto**; uma sessão aberta por salão (índice único parcial).
- Pagamento pode ser dividido; soma deve bater com `total - desconto`. Pix nasce `pending`; comissão fica `blocked` até confirmar.
- Comissão sobre o **valor bruto** do item (sem desconto nem taxa), % da exceção por serviço ou padrão do profissional; arredondamento em centavos (half up).
- Pagamento aprovado não é editado: **estorno** (admin) marca receitas como `reversed`, gera saída de estorno, reverte comissões e cancela o atendimento.
- Baixa de estoque entra na Fase 5 (a RPC `receive_payment` ganha o passo de consumo).
- Comissões: relatório mensal e "marcar como paga" (opcionalmente gerando despesa) em `/financeiro`; "Meus ganhos" para o profissional.

## Tarefas
1. Migration `..06_cash_and_payments.sql` + pgTAP.
2. Funções puras (comissão, pagamentos) + testes.
3. Actions + telas: `/atendimento/[id]`, `/caixa`, `/financeiro` (comissões / meus ganhos).
4. Navegação/ligações, seed, lint/build/testes.
