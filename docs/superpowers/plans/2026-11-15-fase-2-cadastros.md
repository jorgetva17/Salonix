# Salonix — Fase 2 (Cadastros)

**Objetivo:** serviços, profissionais (jornada, bloqueios, comissão padrão e por serviço) e clientes, com RLS por salão e permissões por perfil (spec §8).

## Decisões
- Escrita: **admin** em serviços, profissionais, jornada e comissões; **admin + recepção** em bloqueios (folgas) e clientes; **profissional** só lê.
- Valores em centavos (`price_cents`); comissão em `numeric(5,2)` entre 0 e 100.
- Integridade entre salões garantida por **FK composta** `(id, salon_id)` nas tabelas filhas.
- Convite pode ser vinculado a um profissional existente (spec §12): `salon_invites.professional_id`; `accept_invite` preenche `professionals.user_id`.

## Tarefas
1. Migration `..04_catalog.sql` + pgTAP (`catalog.test.sql`, `invite_professional.test.sql`).
2. Validação (Zod) + utilitários (`parseBRLToCents`, telefone) com testes.
3. Serviços (`/servicos`): lista, criar/editar, ativar/desativar.
4. Profissionais (`/profissionais`, `/profissionais/[id]`): dados, jornada semanal, bloqueios, comissão por serviço, vínculo de convite.
5. Clientes (`/clientes`): busca, criar/editar/excluir, link `wa.me`.
6. Navegação por perfil atualizada e testada; lint, build, testes.
