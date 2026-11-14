# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Salonix: multi-tenant management app for barbershops and hair salons (agenda, cash register, stock, team). Responsive PWA, all UI in **pt-BR**.

- Product requirements: `salonix.md`
- MVP design (data model, flows, permissions, build phases): `docs/superpowers/specs/2026-11-13-salonix-mvp-design.md`
- Implementation plans per phase: `docs/superpowers/plans/` — Phase 1 (base: auth, onboarding, invites, layout, theme, logo, PWA) is done; agenda/caixa/estoque/financeiro pages are still placeholders.
- Where the spec and the code disagree (e.g. logo storage path), the code and migrations are authoritative.

Stack: Next.js 16 App Router (React 19), TypeScript, Tailwind CSS 4, shadcn/ui on **Base UI** (not Radix), Supabase (Postgres, Auth, Storage) via `@supabase/ssr`, Zod 4, Vitest, pgTAP, Playwright.

## Commands

Requires Docker Desktop running for anything that touches the database.

```bash
npm run db:start      # start local Supabase; copy ANON_KEY / SERVICE_ROLE_KEY into .env.local
npm run db:reset      # reapply migrations + supabase/seed.sql (demo users)
npm run dev           # http://localhost:3000
npm run lint
npm run build
npm test              # Vitest unit tests (tests/unit)
npm run db:test       # pgTAP tests (supabase/tests)
npm run test:e2e      # Playwright (tests/e2e); starts/reuses `npm run dev`
npm run db:types      # regenerate src/lib/supabase/database.types.ts after changing migrations
npm run brand:logos   # regenerate public/brand and public/icons from assets/brand/
```

Single tests:

```bash
npx vitest run tests/unit/format.test.ts
npx vitest run -t "name of the test"
npx playwright test tests/e2e/invites.spec.ts
npx playwright test -g "name of the test"
```

Run `npm run db:reset` before the e2e suite so the demo users exist. Demo salon "Barbearia Demo", password `salonix123`: `admin@salonix.dev`, `recepcao@salonix.dev`, `pro@salonix.dev`. Local Mailpit (invite/recovery emails) is at http://127.0.0.1:54324; e2e helpers read links from it (`tests/e2e/helpers.ts`).

## Architecture

**Tenancy is enforced in Postgres, not in the app.** Every business table has `salon_id` and RLS, using the `security definer` helpers `is_salon_member(salon_id)` and `has_salon_role(salon_id, roles[])` (both check `salon_members.active`, so deactivation takes effect immediately). `supabase/tests/tenancy.test.sql` fails if any table in `public` lacks RLS. New tables need RLS policies plus pgTAP tests for cross-salon isolation and per-role permissions.

**Membership only comes from RPCs.** There is no insert policy on `salon_members`; a user joins a salon only via `create_salon` (becomes admin) or `accept_invite`. A trigger keeps at least one active admin per salon; deactivating a member revokes their pending invites. Roles are the enum `salon_role`: `admin`, `reception`, `professional`. Critical business rules are meant to live in transactional Postgres functions called via RPC.

**Request flow:**
- `src/proxy.ts` (Next 16's replacement for middleware) → `src/lib/supabase/proxy.ts` refreshes the session and redirects unauthenticated users to `/entrar?next=...`, except for `PUBLIC_PATHS` (add new public routes there).
- `src/lib/salon/active-salon.ts`: `requireRole(roles?)` is the guard every page and server action under `src/app/(app)/` calls first. It handles login, pending password setup (`/definir-senha`), no-salon (`/onboarding`) and role checks, and returns `{ user, membership, salon }`. The active salon comes from the `salonix_salon` cookie, falling back to the first membership.
- Role-based nav lives in `src/lib/navigation.ts`, but hiding a link is not access control; pages must also call `requireRole`.

**Supabase clients:**
- `src/lib/supabase/server.ts`: `createServerClient()` with the user's cookies (RLS applies). Use it by default.
- `src/lib/supabase/admin.ts`: `createAdminClient()` with the service role, bypasses RLS. Server-only (`import "server-only"`); used only for auth admin calls (invites) and logo storage writes.
- `src/lib/supabase/client.ts`: browser client.

**Server actions** are `"use server"` files colocated with routes (`actions.ts`). They validate input with Zod schemas from `src/lib/validation/`, scope queries by the `salon.id` that `requireRole` returns (never by a client-supplied salon id), and return `ActionResult` / `FormState` from `src/lib/action-result.ts`. Forms use `useActionState`; `src/components/forms/action-form.tsx` renders field errors from `fieldErrors`. Use `safeNextPath` (`src/lib/auth-helpers.ts`) for any user-supplied redirect target.

**Logos:** uploads (PNG/JPG/SVG, max 2 MB) are content-sniffed, re-rendered to PNG with sharp (`src/lib/salon/normalize-logo.ts`), and written by the server with the service role to the `salon-logos` bucket at `{salon_id}/{light|dark}.png`. The bucket is public-read with no user write policies. Logos render only through `<img>`, never inline SVG. `next.config.ts` raises the server action body limit to 10 MB so oversized files reach the validator and get the proper error message.

**Theme:** `next-themes`, with the preference persisted on `profiles.theme` and synced in `src/app/(app)/layout.tsx`.

## Conventions

- All user-facing text and validation messages in pt-BR; code comments are in Portuguese too.
- Money is stored and handled as integer **centavos** (BRL); timestamps are `timestamptz`, displayed in the salon's timezone (default `America/Sao_Paulo`). Formatting helpers are in `src/lib/format.ts`.
- Brand colors: primary `#1B3B4B`, accent `#F59E0B`. Mobile-first: bottom nav below 768px, sidebar at 768px and up, touch targets at least 44px. Every screen has loading, empty and error states (`src/components/states/`).
- Vitest aliases `server-only` to a stub (`tests/unit/server-only-stub.ts`), so server modules can be unit tested.
- pgTAP tests run inside a transaction and use local helpers (`t.create_user`, `t.login`, `t.logout`) defined at the top of each file.
- Commits in Portuguese, conventional style (`feat: ...`, `fix: ...`).

## Production notes

Production Supabase must have email confirmation enabled (otherwise someone could sign up with an invitee's email and accept the invite), must use the `token_hash` email templates from `supabase/templates/`, and must never run `supabase/seed.sql`. See README "Antes de ir para produção".
