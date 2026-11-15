# Salonix — Fase 5 (Estoque + Equipamentos)

**Objetivo:** itens de consumo com estoque mínimo e alertas; vínculo serviço ↔ materiais com **baixa automática** ao receber o pagamento; venda de produto (no atendimento e no balcão); equipamentos com status, responsável e histórico de manutenção.

## Decisões (spec §6, §7, §8, §12)
- **Razão de movimentações** (`stock_movements`, `delta` com sinal) é a fonte da verdade; `inventory_items.quantity` é cache mantido por trigger e **não pode ser editado diretamente**.
- Estoque **pode ficar negativo** após a baixa automática (não bloqueia o atendimento) e gera alerta.
- A baixa roda **dentro de `receive_payment`** (mesma transação); o **estorno devolve** o estoque.
- Permissões: admin escreve; recepção e profissional só leem. **Custos** (custo unitário, custo de manutenção) e o histórico de movimentações ficam em acesso só do admin (financeiro).
- Produto à venda = item com `sale_price_cents`. Venda no balcão cria um atendimento já `awaiting_payment` só com produtos.
- Equipamentos: status `active|maintenance|inactive`, responsável = profissional (opcional), manutenção com data, descrição e próxima data.

## Tarefas
1. Migration `..07_inventory_equipment.sql` (+ `receive_payment`/`reverse_appointment` atualizados) e pgTAP.
2. Funções puras (status do estoque, quantidades, vencimento de manutenção) + testes.
3. Telas: `/estoque` (itens, movimentações, materiais por serviço), `/estoque/equipamentos`, venda de balcão no `/caixa`, produto no atendimento, alertas no painel.
4. Seed, lint/build/testes.
