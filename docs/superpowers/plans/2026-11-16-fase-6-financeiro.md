# Salonix — Fase 6 (Financeiro + Relatórios)

**Objetivo:** contas a pagar (despesas com vencimento) e relatórios do admin: faturamento por período, serviço, profissional e forma de pagamento; custo real por atendimento; comissões; resultado estimado; exportação CSV.

## Decisões (spec §4.4, §7, §8)
- **Faturamento = vendas pagas no período** (`total − desconto` dos atendimentos `paid`, pela data do evento "paid"). Pix pendente conta como venda e aparece separado ("a confirmar"). Estornados saem sozinhos (viram `cancelled`).
- **Desconto rateado sem erro de arredondamento**: alocação acumulada por item (a soma dos serviços + produtos é exatamente o faturamento).
- **Custo de materiais** = soma de `−delta × custo unitário (snapshot)` dos movimentos de consumo/venda ligados aos atendimentos do período.
- **Resultado estimado** = faturamento − custo de materiais − comissões (competência) − outras despesas pagas no período. Estornos e despesas de "comissão" não entram de novo (evita contagem dupla).
- Despesas: admin cria/paga/exclui (pendentes) por RPC; categorias fixas (aluguel, energia, água, internet, produtos, manutenção, impostos, salários, marketing, outros).
- Relatórios só para admin (RPC `security definer` com checagem de perfil). Profissional segue vendo apenas "Meus ganhos".

## Tarefas
1. Migration `..08_financial_reports.sql` (`create_expense`, `pay_expense`, `delete_expense`, `financial_report`) + pgTAP.
2. Funções puras (períodos, CSV, percentuais) + testes.
3. Telas: `/financeiro` (relatório), `/financeiro/contas`, `/financeiro/comissoes`, exportação CSV; alertas de contas vencidas no painel.
4. Seed, lint/build/testes.
