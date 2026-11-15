# Salonix — Fase 7 (Endurecimento do MVP)

Escopo escolhido na ausência de uma Fase 7 no spec: reduzir risco antes do piloto. Não adiciona funcionalidades.

## Itens
1. **Privilégios no banco (defesa em profundidade):** o Supabase concede `ALL` a `anon`/`authenticated` por padrão em tabelas e funções novas. Revogar o que não é necessário e provar com pgTAP (invariantes: RLS em toda tabela, `search_path` fixo em toda função `security definer`, `anon` sem acesso, tabelas só-RPC sem DML direto).
2. **Políticas com referência ambígua** (`salon_id` resolvia para a tabela interna) — qualificar.
3. **Injeção de fórmula em CSV** (nomes começando com `=`, `+`, `-`, `@` executam no Excel) — neutralizar nos textos exportados.
4. **Cabeçalhos de segurança** e região das functions (`gru1`).
5. **Falhas elegantes:** app sem variáveis do Supabase responde 503 claro (hoje daria erro 500 genérico); páginas de erro e 404 em pt-BR.
6. **Acessibilidade:** axe-core nas telas públicas, nos temas claro e escuro.
7. **Checklist de go-live** (Supabase Auth, e-mail, backups, Vercel, LGPD) e README.
