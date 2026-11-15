import type { Metadata } from "next";
import { ExpenseForm, PayExpenseControls } from "@/components/finance/expense-forms";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TIMEZONE, formatBRL, formatDateTime, isoToZonedLocal } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/reports";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contas a pagar · Salonix" };

const br = (iso: string) => iso.split("-").reverse().join("/");

export default async function ContasPage() {
  const { salon } = await requireRole(["admin"]);
  const tz = salon.timezone || DEFAULT_TIMEZONE;
  const today = isoToZonedLocal(new Date().toISOString(), tz).slice(0, 10);
  const supabase = await createServerClient();

  const [{ data: pending }, { data: paid }] = await Promise.all([
    supabase.from("transactions").select("*").eq("type", "expense").eq("status", "pending").order("due_date"),
    supabase.from("transactions").select("*").eq("type", "expense").eq("status", "paid").not("category", "in", "(refund,commission)").order("paid_at", { ascending: false }).limit(15),
  ]);
  const overdue = (pending ?? []).filter((t) => t.due_date && t.due_date < today);
  const sum = (rows: { amount_cents: number }[]) => rows.reduce((n, t) => n + t.amount_cents, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Financeiro</h1>
      <FinanceTabs active="contas" />

      <Card>
        <CardHeader><CardTitle>Lançar despesa</CardTitle><CardDescription>Aluguel, energia, água, produtos, manutenção… Deixe o vencimento para pagar depois ou marque “Já foi paga”.</CardDescription></CardHeader>
        <CardContent><ExpenseForm today={today} /></CardContent>
      </Card>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-md border bg-card p-3"><dt className="text-xs text-muted-foreground">A pagar (pendentes)</dt><dd className="text-lg font-semibold">{formatBRL(sum(pending ?? []))}</dd></div>
        <div className="rounded-md border bg-card p-3"><dt className="text-xs text-muted-foreground">Vencidas</dt><dd className={`text-lg font-semibold ${overdue.length ? "text-destructive" : ""}`}>{formatBRL(sum(overdue))}</dd></div>
      </dl>

      <section aria-labelledby="pend" className="space-y-3">
        <h2 id="pend" className="text-lg font-semibold">A pagar ({pending?.length ?? 0})</h2>
        {!pending || pending.length === 0 ? (
          <EmptyState title="Nenhuma conta pendente" />
        ) : (
          <ul className="grid gap-3">
            {pending.map((t) => {
              const late = !!t.due_date && t.due_date < today;
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{t.description} <Badge className="ml-1">{CATEGORY_LABELS[t.category] ?? t.category}</Badge></p>
                    <p className="text-sm text-muted-foreground">
                      Vence em {t.due_date ? br(t.due_date) : "—"} {late ? <Badge className="ml-1 bg-destructive/15 text-destructive">Vencida</Badge> : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{formatBRL(t.amount_cents)}</strong>
                    <PayExpenseControls id={t.id} description={t.description} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(paid ?? []).length > 0 ? (
        <section aria-labelledby="pagas" className="space-y-3">
          <h2 id="pagas" className="text-lg font-semibold">Pagas recentemente</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {(paid ?? []).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>{t.description} <span className="text-muted-foreground">· {CATEGORY_LABELS[t.category] ?? t.category}{t.paid_at ? ` · ${formatDateTime(t.paid_at, tz)}` : ""}</span></span>
                <strong>{formatBRL(t.amount_cents)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
