# Salonix

Gestão para barbearias e salões: agenda, caixa, estoque e equipe. Web app responsivo
(PWA), multi-salão, em pt-BR.

- Requisitos do produto: [`salonix.md`](salonix.md)
- Design do MVP: [`docs/superpowers/specs/2026-11-13-salonix-mvp-design.md`](docs/superpowers/specs/2026-11-13-salonix-mvp-design.md)
- Planos de implementação: [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) ·
Supabase (Postgres, Auth, Storage) · Zod · Vitest · pgTAP · Playwright.

## Rodando localmente

Pré-requisitos: Node 20+ e Docker Desktop **aberto**.

```bash
npm install
npm run db:start            # sobe o Supabase local (Docker) e mostra as chaves
cp .env.local.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY com a saída do db:start
npm run db:reset            # aplica migrations + dados de demonstração
npm run dev                 # http://localhost:3000
```

| Serviço | Endereço |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| E-mails de teste (Mailpit) | http://127.0.0.1:54324 |

### Usuários de demonstração

Salão **Barbearia Demo**, senha `salonix123` para todos:

| E-mail | Perfil |
|---|---|
| admin@salonix.dev | Administrador |
| recepcao@salonix.dev | Recepção |
| pro@salonix.dev | Profissional |

## Testes

```bash
npm test             # unitários (Vitest)
npm run db:test      # banco: isolamento entre salões e permissões (pgTAP)
npm run test:e2e     # ponta a ponta (Playwright; sobe o `npm run dev` sozinho)
npm run lint
npm run build
```

Rode `npm run db:reset` antes do E2E para recarregar os usuários de demonstração.

## Scripts úteis

| Comando | O que faz |
|---|---|
| `npm run db:types` | Regenera `src/lib/supabase/database.types.ts` após mudar migrations |
| `npm run brand:logos` | Regenera logos transparentes e ícones do PWA a partir de `assets/brand/` |
| `npm run db:stop` | Para o Supabase local |

## Como o multi-salão funciona

- Toda tabela de negócio tem `salon_id` e RLS. As funções `is_salon_member` e
  `has_salon_role` decidem o acesso; o teste pgTAP falha se alguma tabela de
  `public` ficar sem RLS.
- Uma pessoa só entra em um salão **criando o salão** (`create_salon`) ou
  **aceitando um convite** (`accept_invite`). Não há inserção direta em `salon_members`.
- O salão ativo fica no cookie `salonix_salon` (quem trabalha em mais de um salão troca pelo menu).
- Logos são convertidas para PNG no servidor e gravadas no bucket `salon-logos`
  apenas pelo servidor; o bucket é público só para leitura.

## Antes de ir para produção

Itens obrigatórios ao criar o projeto no Supabase Cloud:

1. **Auth → confirmação de e-mail ligada** (`enable_confirmations`). Sem isso, alguém
   poderia criar uma conta com o e-mail de um convidado e aceitar o convite no lugar dele.
2. **Templates de e-mail**: copie `supabase/templates/*.html` (convite, recuperação e
   confirmação) para Auth → Email Templates. Eles usam `token_hash`; o modelo padrão do
   convite não funciona com o fluxo do app.
3. **URLs**: Site URL e Redirect URLs apontando para o domínio do app (`/auth/callback`).
4. Variáveis de ambiente do app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (somente no servidor) e `NEXT_PUBLIC_SITE_URL`.
5. Aplicar as migrations com `supabase db push`. **Não** rode `supabase/seed.sql` em produção.
