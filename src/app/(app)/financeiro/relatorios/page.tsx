import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { todayIn } from "@/lib/agenda/time";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/cash/methods";
import { PERIOD_PRESETS, resolvePeriod } from "@/lib/finance/period";
import { formatBRL, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FinanceTabs } from "../tabs";

export const metadata = { title: "Relatórios · Salonix" };

/** Formato devolvido pela RPC finance_report. */
type Report = {
  revenue_cents: number;
  appointments: number;
  discount_cents: number;
  services_cents: number;
  products_cents: number;
  by_method: Record<(typeof PAYMENT_METHODS)[number], number>;
  pix_pending_cents: number;
  by_item: { type: "service" | "product"; name: string; quantity: number; amount_cents: number }[];
  by_professional: { name: string; appointments: number; amount_cents: number }[];
  material_cost_cents: number;
  commission_cents: number;
  refunded: { appointments: number; amount_cents: number };
  bills_paid_cents: number;
  costs: { appointment_id: string; paid_at: string; label: string; revenue_cents: number; material_cost_cents: number }[];
};

const percent = (part: number, total: number) => (total > 0 ? Math.round((part * 100) / total) : 0);

function Stat({ label, value, testId, muted }: { label: string; value: string; testId?: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg tabular-nums", !muted && "font-semibold")} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function Bars({ rows, total, testId }: { rows: { key: string; label: string; detail?: string; amount: number }[]; total: number; testId: string }) {
  return (
    <ul className="flex flex-col gap-3" data-testid={testId}>
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="min-w-0 truncate">
              {r.label}
              {r.detail && <span className="text-muted-foreground"> · {r.detail}</span>}
            </span>
            <span className="tabular-nums">
              {formatBRL(r.amount)} <span className="text-muted-foreground">({percent(r.amount, total)}%)</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted" aria-hidden>
            <div className="h-2 rounded-full bg-primary" style={{ width: `${percent(r.amount, total)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { salon } = await requireRole(["admin"]);
  const tz = salon.timezone;
  const today = todayIn(tz);
  const period = resolvePeriod(await searchParams, today);
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("finance_report", { p_salon_id: salon.id, p_from: period.from, p_to: period.to });
  if (error) throw error;
  const r = data as unknown as Report;
  const total = r.revenue_cents;
  const average = r.appointments > 0 ? Math.round(total / r.appointments) : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-semibold">Relatórios</h1>
      <FinanceTabs current="relatorios" />

      <div className="flex flex-col gap-3">
        <nav aria-label="Atalhos de período" className="flex flex-wrap gap-2">
          {PERIOD_PRESETS(today).map((p) => (
            <Link
              key={p.label}
              href={`/financeiro/relatorios?de=${p.from}&ate=${p.to}`}
              aria-current={p.from === period.from && p.to === period.to ? "page" : undefined}
              className={cn(
                "flex h-11 items-center rounded-full border px-4 text-sm",
                p.from === period.from && p.to === period.to && "bg-primary text-primary-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            De
            <Input type="date" name="de" defaultValue={period.from} className="h-11 text-base" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Até
            <Input type="date" name="ate" defaultValue={period.to} className="h-11 text-base" />
          </label>
          <Button type="submit" variant="outline" className="h-11">
            Ver período
          </Button>
        </form>
      </div>

      {r.appointments === 0 && r.refunded.appointments === 0 && r.bills_paid_cents === 0 ? (
        <EmptyState icon={BarChart3} title="Nada recebido neste período" description="Escolha outro período ou receba atendimentos no caixa." />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Faturamento" value={formatBRL(total)} testId="report-revenue" />
            <Stat label="Atendimentos" value={String(r.appointments)} testId="report-appointments" />
            <Stat label="Ticket médio" value={formatBRL(average)} />
            <Stat label="Descontos" value={formatBRL(r.discount_cents)} muted />
            <Stat
              label="Estornados"
              value={`${r.refunded.appointments} · ${formatBRL(r.refunded.amount_cents)}`}
              testId="report-refunded"
              muted
            />
            <Stat label="Pix a confirmar" value={formatBRL(r.pix_pending_cents)} muted />
            <Stat label="Custo de material" value={formatBRL(r.material_cost_cents)} testId="report-material" muted />
            <Stat label="Comissões" value={formatBRL(r.commission_cents)} muted />
            <Stat label="Contas pagas" value={formatBRL(r.bills_paid_cents)} testId="report-bills" muted />
          </dl>

          {total > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Por forma de pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <Bars
                    testId="report-by-method"
                    total={total}
                    rows={PAYMENT_METHODS.filter((m) => r.by_method[m] > 0).map((m) => ({
                      key: m,
                      label: PAYMENT_METHOD_LABELS[m],
                      amount: r.by_method[m],
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Por serviço e produto</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Serviços {formatBRL(r.services_cents)} · Produtos {formatBRL(r.products_cents)} · valores já com desconto
                  </p>
                </CardHeader>
                <CardContent>
                  <Bars
                    testId="report-by-item"
                    total={total}
                    rows={r.by_item.map((i) => ({
                      key: `${i.type}-${i.name}`,
                      label: i.name,
                      detail: `${i.type === "product" ? "produto" : "serviço"} × ${i.quantity}`,
                      amount: i.amount_cents,
                    }))}
                  />
                </CardContent>
              </Card>

              {r.by_professional.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Por profissional</CardTitle>
                    <p className="text-sm text-muted-foreground">Só serviços</p>
                  </CardHeader>
                  <CardContent>
                    <Bars
                      testId="report-by-professional"
                      total={r.services_cents}
                      rows={r.by_professional.map((p) => ({
                        key: p.name,
                        label: p.name,
                        detail: `${p.appointments} ${p.appointments === 1 ? "atendimento" : "atendimentos"}`,
                        amount: p.amount_cents,
                      }))}
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Custo por atendimento</CardTitle>
                  <p className="text-sm text-muted-foreground">Consumíveis dos serviços e produtos vendidos, pelo custo da baixa.</p>
                </CardHeader>
                <CardContent>
                  <details>
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
                      Ver atendimentos ({r.costs.length}
                      {r.costs.length < r.appointments && ` de ${r.appointments}`})
                    </summary>
                    <ul className="divide-y text-sm" data-testid="report-costs">
                      {r.costs.map((c) => (
                        <li key={c.appointment_id} className="flex flex-wrap justify-between gap-2 py-2">
                          <span className="min-w-0">
                            {formatDateTime(c.paid_at, tz)} · {c.label}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatBRL(c.revenue_cents)} · custo <span className="text-foreground">{formatBRL(c.material_cost_cents)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
