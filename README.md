# Salonix

Gestão para barbearias e salões: agenda (com fila de walk-in), caixa, estoque, equipe e financeiro.
Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, Storage, Realtime).

Spec: `docs/superpowers/specs/2026-11-13-salonix-mvp-design.md` · Plano da Fase 1: `docs/superpowers/plans/2026-11-13-fase-1-base.md`

## Pré-requisitos

- Node 22+
- Docker (para o Supabase local)

## Primeiros passos

```bash
npm install
npm run db:start        # sobe o Supabase local e mostra as chaves
cp .env.local.example .env.local   # preencha URL e chaves exibidas acima
npm run db:reset        # aplica migrations + seed
npm run dev             # http://localhost:3000
```

Usuários de demonstração (senha `salonix123`), salão "Barbearia Demo":

| E-mail | Perfil |
|---|---|
| admin@salonix.dev | Admin / Dono |
| recepcao@salonix.dev | Recepção |
| pro@salonix.dev | Profissional |

E-mails de desenvolvimento (convites, recuperação de senha) caem no Mailpit: http://127.0.0.1:54324

## Testes

```bash
npm test                 # unitários (Vitest)
npm run db:test          # pgTAP (isolamento entre salões, RLS, convites, storage)
npx playwright test      # e2e (precisa do Supabase local + .env.local)
npm run lint && npm run build
```

Sem Docker/Supabase CLI? `scripts/pg-harness/run.sh` aplica as migrations e roda os testes pgTAP num
Postgres 16 comum (com um stub de `auth`/`storage`). Não substitui o `supabase test db`, mas pega erros de SQL/RLS.

## Deploy (Vercel)

1. Crie um projeto no Supabase e rode `supabase link` + `supabase db push`.
2. No Vercel, cadastre as variáveis (separadas por ambiente: Production / Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (**sem** prefixo `NEXT_PUBLIC_`), `NEXT_PUBLIC_SITE_URL`.
3. No Supabase Auth, ajuste **Site URL** e **Redirect URLs** para o domínio do Vercel.
4. Em Deployment Protection, desative o Vercel Authentication na produção.

## Estrutura

- `supabase/migrations` — tenancy (RLS por `salon_id`), convites, bucket de logos, cadastros (serviços, profissionais, clientes), agenda e fila de walk-in (RPCs + Realtime), caixa, pagamentos, comissões e estorno
- `supabase/tests` — pgTAP
- `src/lib/supabase` — clientes (browser, server, admin) e proxy de sessão
- `src/app/(auth)`, `src/app/(app)` — autenticação e telas privadas
- `scripts/process-logos.ts` — gera logos transparentes e ícones PWA a partir de `assets/brand/`
