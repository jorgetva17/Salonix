import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PayCommissionsButton } from "@/components/cash/pay-commissions";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TIMEZONE, formatBRL, formatDateTime, isoToZonedLocal } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Financeiro · Salonix" };

const STATUS = { blocked: "Aguardando Pix", available: "Disponível", paid: "Paga", reversed: "Estornada" } as const;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanceiroPage({ searchParams }: PageProps<"/financeiro">) {
  const { membership, salon } = await requireRole(["admin", "professional"]);
  const isAdmin = membership.role === "admin";
  const tz = salon.timezone || DEFAULT_TIMEZONE;
  const sp = await searchParams;
  const current = isoToZonedLocal(new Date().toISOString(), tz).slice(0, 7);
  const m = typeof sp.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : current;
  const [year, monthNumber] = m.split("-").map(Number);

  const supabase = await createServerClient();
  const [{ data: commissions }, { data: pros }] = await Promise.all([
    supabase.from("commissions").select("*").eq("reference_month", `${m}-01`).neq("status", "reversed").order("created_at"),
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

  // "Meus ganhos": datas dos atendimentos
  let dateOf = new Map<string, string>();
  if (!isAdmin && (commissions ?? []).length > 0) {
    const { data: appts } = await supabase.from("appointments").select("id, starts_at, arrived_at").in("id", [...new Set((commissions ?? []).map((c) => c.appointment_id))]);
    dateOf = new Map((appts ?? []).map((a) => [a.id, a.starts_at ?? a.arrived_at ?? ""]));
  }

  const monthNav = (
    <nav aria-label="Mês" className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="icon" aria-label="Mês anterior"><Link href={`/financeiro?m=${shiftMonth(m, -1)}`}><ChevronLeft /></Link></Button>
      <span className="min-w-36 text-center font-medium capitalize">{MONTHS[monthNumber - 1]} de {year}</span>
      <Button asChild variant="outline" size="icon" aria-label="Próximo mês"><Link href={`/financeiro?m=${shiftMonth(m, 1)}`}><ChevronRight /></Link></Button>
      {m !== current ? <Button asChild variant="secondary" size="sm"><Link href="/financeiro">Mês atual</Link></Button> : null}
    </nav>
  );

  if (!isAdmin) {
    const mine = commissions ?? [];
    const total = (s: string) => mine.filter((c) => c.status === s).reduce((n, c) => n + c.amount_cents, 0);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold">Meus ganhos</h1>
        {monthNav}
        <dl className="grid grid-cols-3 gap-3">
          {(["available", "blocked", "paid"] as const).map((s) => (
            <div key={s} className="rounded-md border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{STATUS[s]}</dt>
              <dd className="text-lg font-semibold">{formatBRL(total(s))}</dd>
            </div>
          ))}
        </dl>
        {mine.length === 0 ? (
          <EmptyState title="Sem comissões neste mês" description="Suas comissões aparecem aqui quando os atendimentos forem pagos." />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {mine.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {dateOf.get(c.appointment_id) ? formatDateTime(dateOf.get(c.appointment_id)!, tz) : "—"} · {c.percent}% de {formatBRL(c.base_cents)}{" "}
                  <Badge>{STATUS[c.status]}</Badge>
                </span>
                <strong>{formatBRL(c.amount_cents)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Financeiro</h1>
      <Card>
        <CardHeader>
          <CardTitle>Comissões do mês</CardTitle>
          <CardDescription>Calculadas sobre o valor bruto dos serviços. “Aguardando Pix” só é liberada quando o Pix for confirmado no caixa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {monthNav}
          {byPro.size === 0 ? (
            <EmptyState title="Sem comissões neste mês" />
          ) : (
            <ul className="grid gap-3">
              {[...byPro.entries()].map(([proId, t]) => (
                <li key={proId} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{nameOf.get(proId) ?? "Profissional"}</p>
                      <p className="text-sm text-muted-foreground">
                        Disponível {formatBRL(t.available)} · Aguardando Pix {formatBRL(t.blocked)} · Paga {formatBRL(t.paid)} · {t.count} item(ns)
                      </p>
                    </div>
                    {t.available > 0 ? (
                      <PayCommissionsButton professionalId={proId} professionalName={nameOf.get(proId) ?? "profissional"} month={m} amountCents={t.available} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">Relatórios de faturamento, custo por atendimento e contas a pagar chegam na Fase 6.</p>
    </div>
  );
}
