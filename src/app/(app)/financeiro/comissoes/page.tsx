import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PayCommissionsButton } from "@/components/cash/pay-commissions";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TIMEZONE, formatBRL, isoToZonedLocal } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Comissões · Salonix" };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ComissoesPage({ searchParams }: PageProps<"/financeiro/comissoes">) {
  const { salon } = await requireRole(["admin"]);
  const sp = await searchParams;
  const current = isoToZonedLocal(new Date().toISOString(), salon.timezone || DEFAULT_TIMEZONE).slice(0, 7);
  const m = typeof sp.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : current;
  const [year, monthNumber] = m.split("-").map(Number);

  const supabase = await createServerClient();
  const [{ data: commissions }, { data: pros }] = await Promise.all([
    supabase.from("commissions").select("*").eq("reference_month", `${m}-01`).neq("status", "reversed"),
    supabase.from("professionals").select("id, name").order("name"),
  ]);
  const nameOf = new Map((pros ?? []).map((p) => [p.id, p.name]));
  const byPro = new Map<string, { available: number; blocked: number; paid: number; count: number }>();
  for (const c of commissions ?? []) {
    const e = byPro.get(c.professional_id) ?? { available: 0, blocked: 0, paid: 0, count: 0 };
    if (c.status === "available" || c.status === "blocked" || c.status === "paid") e[c.status] += c.amount_cents;
    e.count += 1;
    byPro.set(c.professional_id, e);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Financeiro</h1>
      <FinanceTabs active="comissoes" />
      <Card>
        <CardHeader>
          <CardTitle>Comissões do mês</CardTitle>
          <CardDescription>Calculadas sobre o valor bruto dos serviços. “Aguardando Pix” só é liberada quando o Pix for confirmado no caixa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <nav aria-label="Mês" className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="icon" aria-label="Mês anterior"><Link href={`/financeiro/comissoes?m=${shiftMonth(m, -1)}`}><ChevronLeft /></Link></Button>
            <span className="min-w-36 text-center font-medium capitalize">{MONTHS[monthNumber - 1]} de {year}</span>
            <Button asChild variant="outline" size="icon" aria-label="Próximo mês"><Link href={`/financeiro/comissoes?m=${shiftMonth(m, 1)}`}><ChevronRight /></Link></Button>
          </nav>
          {byPro.size === 0 ? (
            <EmptyState title="Sem comissões neste mês" />
          ) : (
            <ul className="grid gap-3">
              {[...byPro.entries()].map(([proId, t]) => (
                <li key={proId} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{nameOf.get(proId) ?? "Profissional"}</p>
                      <p className="text-sm text-muted-foreground">Disponível {formatBRL(t.available)} · Aguardando Pix {formatBRL(t.blocked)} · Paga {formatBRL(t.paid)} · {t.count} item(ns)</p>
                    </div>
                    {t.available > 0 ? <PayCommissionsButton professionalId={proId} professionalName={nameOf.get(proId) ?? "profissional"} month={m} amountCents={t.available} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
