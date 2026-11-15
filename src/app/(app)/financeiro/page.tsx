import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DailyBars, ShareList } from "@/components/finance/charts";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEFAULT_TIMEZONE, formatBRL, formatDateTime, isoToZonedLocal } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/payments";
import { CATEGORY_LABELS, parsePeriod, periodFor } from "@/lib/reports";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Financeiro · Salonix" };

const STATUS = { blocked: "Aguardando Pix", available: "Disponível", paid: "Paga", reversed: "Estornada" } as const;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const br = (d: string) => d.split("-").reverse().join("/");

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanceiroPage({ searchParams }: PageProps<"/financeiro">) {
  const { membership, salon } = await requireRole(["admin", "professional"]);
  const tz = salon.timezone || DEFAULT_TIMEZONE;
  const today = isoToZonedLocal(new Date().toISOString(), tz).slice(0, 10);
  const sp = await searchParams;
  const supabase = await createServerClient();

  if (membership.role === "admin") {
    const { from, to } = parsePeriod(sp.de, sp.ate, today);
    const { data: report, error } = await supabase.rpc("financial_report", { p_salon_id: membership.salonId, p_from: from, p_to: to });
    const presets = [
      { label: "Hoje", ...periodFor("today", today) },
      { label: "7 dias", ...periodFor("7d", today) },
      { label: "Este mês", ...periodFor("month", today) },
      { label: "Mês passado", ...periodFor("last_month", today) },
    ];
    const qs = `de=${from}&ate=${to}`;

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <FinanceTabs active="resumo" />

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Períodos rápidos">
            {presets.map((p) => (
              <Button key={p.label} asChild size="sm" variant={p.from === from && p.to === to ? "default" : "outline"}>
                <Link href={`/financeiro?de=${p.from}&ate=${p.to}`}>{p.label}</Link>
              </Button>
            ))}
          </div>
          <form className="flex flex-wrap items-end gap-2" aria-label="Período personalizado">
            <label className="grid gap-1 text-sm font-medium">De<Input type="date" name="de" defaultValue={from} className="w-auto" /></label>
            <label className="grid gap-1 text-sm font-medium">Até<Input type="date" name="ate" defaultValue={to} className="w-auto" /></label>
            <Button type="submit" variant="secondary">Aplicar</Button>
            <span className="ml-auto flex gap-2">
              <Button asChild variant="outline" size="sm"><a href={`/financeiro/exportar?tipo=vendas&${qs}`}><Download /> Vendas (CSV)</a></Button>
              <Button asChild variant="outline" size="sm"><a href={`/financeiro/exportar?tipo=despesas&${qs}`}><Download /> Despesas (CSV)</a></Button>
            </span>
          </form>
          <p className="text-sm text-muted-foreground">Período: {br(from)} a {br(to)}</p>
        </div>

        {error || !report ? (
          <p role="alert" className="text-sm text-destructive">Não foi possível gerar o relatório. {error?.message?.includes("Período") ? error.message : "Tente novamente."}</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Faturamento" value={formatBRL(report.revenue_cents)} hint={`${report.appointments_count} venda(s) · ticket ${formatBRL(report.avg_ticket_cents)}`} />
              <Kpi label="Custo de materiais" value={formatBRL(report.materials_cost_cents)} hint={`${formatBRL(report.cost_per_appointment_cents)} por atendimento`} />
              <Kpi label="Comissões" value={formatBRL(report.commissions_cents)} />
              <Kpi label="Outras despesas pagas" value={formatBRL(report.expenses_cents)} />
            </dl>
            <Card className={cn(report.result_cents < 0 && "border-destructive")}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
                <div>
                  <p className="text-sm text-muted-foreground">Resultado estimado do período</p>
                  <p className={cn("text-3xl font-bold", report.result_cents < 0 && "text-destructive")}>{formatBRL(report.result_cents)}</p>
                </div>
                <p className="max-w-md text-xs text-muted-foreground">
                  Faturamento − custo de materiais − comissões − outras despesas pagas. Estornos já saem do faturamento; Pix pendente conta como venda (a confirmar).
                </p>
              </CardContent>
            </Card>

            {report.pending_pix_cents > 0 ? <p className="rounded-md bg-secondary px-3 py-2 text-sm">Pix a confirmar neste período: <strong>{formatBRL(report.pending_pix_cents)}</strong></p> : null}
            {report.discount_cents > 0 || report.refunds_cents > 0 ? (
              <p className="text-sm text-muted-foreground">
                {report.discount_cents > 0 ? <>Descontos concedidos: {formatBRL(report.discount_cents)}. </> : null}
                {report.refunds_cents > 0 ? <>Estornos no período: {formatBRL(report.refunds_cents)}.</> : null}
              </p>
            ) : null}

            {report.appointments_count === 0 ? (
              <EmptyState title="Sem vendas no período" description="Escolha outro período ou receba atendimentos no caixa." />
            ) : (
              <>
                <Card>
                  <CardHeader><CardTitle>Faturamento por dia</CardTitle></CardHeader>
                  <CardContent><DailyBars data={report.by_day} /></CardContent>
                </Card>
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle>Por forma de pagamento</CardTitle></CardHeader>
                    <CardContent>
                      <ShareList total={report.by_method.reduce((n, m) => n + m.cents, 0)} rows={report.by_method.map((m) => ({ label: m.method ? METHOD_LABELS[m.method] : "—", cents: m.cents }))} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Por profissional</CardTitle><CardDescription>Serviços realizados, já com o desconto rateado.</CardDescription></CardHeader>
                    <CardContent>
                      <ShareList total={report.by_professional.reduce((n, p) => n + p.cents, 0)} rows={report.by_professional.map((p) => ({ label: p.name ?? "Sem profissional", cents: p.cents, extra: `${p.count} atend.` }))} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Por serviço</CardTitle></CardHeader>
                    <CardContent>
                      <ShareList
                        total={report.by_service.reduce((n, s) => n + s.cents, 0) + report.products_cents}
                        rows={[...report.by_service.map((s) => ({ label: s.name, cents: s.cents, extra: `${s.count}×` })), ...(report.products_cents > 0 ? [{ label: "Produtos (revenda)", cents: report.products_cents }] : [])]}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Despesas pagas por categoria</CardTitle></CardHeader>
                    <CardContent>
                      <ShareList total={report.expenses_cents} empty="Nenhuma despesa paga no período." rows={report.expenses_by_category.map((c) => ({ label: CATEGORY_LABELS[c.category] ?? c.category, cents: c.cents }))} />
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            <Card>
              <CardHeader><CardTitle>Contas a pagar</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  Pendentes: <strong>{formatBRL(report.payable_pending_cents)}</strong>
                  {report.payable_overdue_cents > 0 ? <> · <Badge className="bg-destructive/15 text-destructive">Vencidas {formatBRL(report.payable_overdue_cents)}</Badge></> : null}
                </span>
                <Button asChild variant="secondary" size="sm"><Link href="/financeiro/contas">Ver contas a pagar</Link></Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  // Profissional: "Meus ganhos" (somente as próprias comissões)
  const current = today.slice(0, 7);
  const m = typeof sp.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : current;
  const [year, monthNumber] = m.split("-").map(Number);
  const { data: commissions } = await supabase.from("commissions").select("*").eq("reference_month", `${m}-01`).neq("status", "reversed").order("created_at");
  let dateOf = new Map<string, string>();
  if ((commissions ?? []).length > 0) {
    const { data: appts } = await supabase.from("appointments").select("id, starts_at, arrived_at").in("id", [...new Set((commissions ?? []).map((c) => c.appointment_id))]);
    dateOf = new Map((appts ?? []).map((a) => [a.id, a.starts_at ?? a.arrived_at ?? ""]));
  }
  const mine = commissions ?? [];
  const total = (s: string) => mine.filter((c) => c.status === s).reduce((n, c) => n + c.amount_cents, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Meus ganhos</h1>
      <nav aria-label="Mês" className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon" aria-label="Mês anterior"><Link href={`/financeiro?m=${shiftMonth(m, -1)}`}><ChevronLeft /></Link></Button>
        <span className="min-w-36 text-center font-medium capitalize">{MONTHS[monthNumber - 1]} de {year}</span>
        <Button asChild variant="outline" size="icon" aria-label="Próximo mês"><Link href={`/financeiro?m=${shiftMonth(m, 1)}`}><ChevronRight /></Link></Button>
        {m !== current ? <Button asChild variant="secondary" size="sm"><Link href="/financeiro">Mês atual</Link></Button> : null}
      </nav>
      <dl className="grid grid-cols-3 gap-3">
        {(["available", "blocked", "paid"] as const).map((s) => (
          <div key={s} className="rounded-md border bg-card p-3"><dt className="text-xs text-muted-foreground">{STATUS[s]}</dt><dd className="text-lg font-semibold">{formatBRL(total(s))}</dd></div>
        ))}
      </dl>
      {mine.length === 0 ? (
        <EmptyState title="Sem comissões neste mês" description="Suas comissões aparecem aqui quando os atendimentos forem pagos." />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {mine.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>{dateOf.get(c.appointment_id) ? formatDateTime(dateOf.get(c.appointment_id)!, tz) : "—"} · {c.percent}% de {formatBRL(c.base_cents)} <Badge>{STATUS[c.status]}</Badge></span>
              <strong>{formatBRL(c.amount_cents)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
      {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}
