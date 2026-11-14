import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addMonths, todayIn } from "@/lib/agenda/time";
import { formatBRL, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PayCommissionsButton } from "./commissions-client";

export const metadata = { title: "Financeiro · Salonix" };

const STATUS_LABELS: Record<string, string> = {
  blocked: "Bloqueada (Pix)",
  available: "Disponível",
  paid: "Paga",
  reversed: "Estornada",
};

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { salon, membership } = await requireRole(["admin", "professional"]);
  const isAdmin = membership.role === "admin";
  const tz = salon.timezone;
  const { mes } = await searchParams;
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : todayIn(tz).slice(0, 7);
  const supabase = await createServerClient();

  // A RLS já limita o profissional às próprias comissões.
  const { data: rows, error } = await supabase
    .from("commissions")
    .select(
      "id, professional_id, base_cents, percent, amount_cents, status, created_at, professionals(name), appointments(customers(name)), appointment_items(services(name))",
    )
    .eq("salon_id", salon.id)
    .eq("reference_month", `${month}-01`)
    .order("created_at");
  if (error) throw error;

  type Group = { id: string; name: string; available: number; blocked: number; paid: number; rows: typeof rows };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const g = groups.get(r.professional_id) ?? {
      id: r.professional_id,
      name: r.professionals?.name ?? "",
      available: 0,
      blocked: 0,
      paid: 0,
      rows: [],
    };
    if (r.status === "available") g.available += r.amount_cents;
    else if (r.status === "blocked") g.blocked += r.amount_cents;
    else if (r.status === "paid") g.paid += r.amount_cents;
    g.rows.push(r);
    groups.set(r.professional_id, g);
  }
  const list = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const [year, monthNumber] = month.split("-").map(Number);
  const nav = (m: string) => `/financeiro?mes=${m}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{isAdmin ? "Comissões" : "Meus ganhos"}</h1>
        <div className="flex items-center gap-1">
          <Link href={nav(addMonths(month, -1))} aria-label="Mês anterior" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11")}>
            <ChevronLeft aria-hidden />
          </Link>
          <span className="min-w-36 text-center font-medium capitalize" data-testid="finance-month">
            {MONTH_NAMES[monthNumber - 1]} de {year}
          </span>
          <Link href={nav(addMonths(month, 1))} aria-label="Próximo mês" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11")}>
            <ChevronRight aria-hidden />
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Nenhuma comissão neste mês" description="As comissões aparecem aqui quando um atendimento é recebido." />
      ) : (
        list.map((g) => (
          <Card key={g.id} data-testid={`commissions-${g.name}`}>
            <CardHeader>
              <CardTitle>{g.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Disponível</dt>
                  <dd className="text-lg font-semibold tabular-nums" data-testid="commission-available">
                    {formatBRL(g.available)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Bloqueada (Pix)</dt>
                  <dd className="text-lg tabular-nums" data-testid="commission-blocked">
                    {formatBRL(g.blocked)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Paga</dt>
                  <dd className="text-lg tabular-nums" data-testid="commission-paid">
                    {formatBRL(g.paid)}
                  </dd>
                </div>
              </dl>
              {isAdmin && g.available > 0 && (
                <PayCommissionsButton key={g.available} professionalId={g.id} professionalName={g.name} month={month} amountCents={g.available} />
              )}
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Ver atendimentos ({g.rows.length})</summary>
                <ul className="divide-y text-sm">
                  {g.rows.map((r) => (
                    <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span className="min-w-0">
                        {formatDateTime(r.created_at, tz)} · {r.appointments?.customers?.name} · {r.appointment_items?.services?.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatBRL(r.base_cents)} × {Number(r.percent)}% = <span className="text-foreground">{formatBRL(r.amount_cents)}</span> ·{" "}
                        {STATUS_LABELS[r.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
