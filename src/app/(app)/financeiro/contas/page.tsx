import Link from "next/link";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { monthRange, todayIn } from "@/lib/agenda/time";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/cash/methods";
import { BILL_CATEGORIES, BILL_CATEGORY_LABELS, BILL_STATUS_LABELS, billStatus, type BillCategory } from "@/lib/finance/bills";
import { formatBRL } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FinanceTabs } from "../tabs";
import { BillActions, BillDialog } from "./bills-client";

export const metadata = { title: "Contas a pagar · Salonix" };

const FILTERS = { abertas: "Em aberto", pagas: "Pagas", todas: "Todas" } as const;
type Filter = keyof typeof FILTERS;

/** "2026-11-20" → "20/11/2026". */
const formatDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { salon } = await requireRole(["admin"]);
  const { status } = await searchParams;
  const filter: Filter = status && status in FILTERS ? (status as Filter) : "abertas";
  const today = todayIn(salon.timezone);
  const month = monthRange(today.slice(0, 7), salon.timezone);
  const supabase = await createServerClient();

  const base = () =>
    supabase
      .from("transactions")
      .select("id, category, description, amount_cents, status, method, due_date, paid_at")
      .eq("salon_id", salon.id)
      .eq("type", "expense")
      .in("category", [...BILL_CATEGORIES]);
  const listQuery =
    filter === "abertas"
      ? base().eq("status", "pending").order("due_date")
      : filter === "pagas"
        ? base().eq("status", "paid").order("paid_at", { ascending: false }).limit(100)
        : base().order("due_date", { ascending: false }).limit(200);
  const [{ data: list, error: e1 }, { data: open, error: e2 }, { data: paidMonth, error: e3 }] = await Promise.all([
    listQuery,
    base().eq("status", "pending"),
    base().eq("status", "paid").gte("paid_at", month.from).lt("paid_at", month.to),
  ]);
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;

  const sum = (rows: { amount_cents: number }[]) => rows.reduce((s, r) => s + r.amount_cents, 0);
  const overdue = open.filter((b) => billStatus(b, today) === "overdue");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contas a pagar</h1>
        <BillDialog today={today} />
      </div>
      <FinanceTabs current="contas" />

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Em aberto</dt>
          <dd className="text-lg font-semibold tabular-nums" data-testid="bills-open">
            {formatBRL(sum(open))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Vencidas</dt>
          <dd className={cn("text-lg tabular-nums", overdue.length > 0 && "text-destructive")} data-testid="bills-overdue">
            {formatBRL(sum(overdue))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Pagas no mês</dt>
          <dd className="text-lg tabular-nums" data-testid="bills-paid-month">
            {formatBRL(sum(paidMonth))}
          </dd>
        </div>
      </dl>

      <nav aria-label="Filtrar contas" className="flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link
            key={f}
            href={`/financeiro/contas?status=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={cn("flex h-11 items-center rounded-full border px-4 text-sm", filter === f && "bg-primary text-primary-foreground")}
          >
            {FILTERS[f]}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma conta"
          description={filter === "abertas" ? "Lance aluguel, fornecedores e outras despesas para acompanhar os vencimentos." : "Nenhuma conta neste filtro."}
        />
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {list.map((b) => {
                const st = billStatus(b, today);
                return (
                  <li key={b.id} data-testid="bill" className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{b.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {BILL_CATEGORY_LABELS[b.category as BillCategory]}
                        {b.due_date && ` · vence ${formatDay(b.due_date)}`}
                        {b.method && st === "paid" && ` · ${PAYMENT_METHOD_LABELS[b.method as PaymentMethod]}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={st === "overdue" ? "destructive" : st === "due_soon" ? "secondary" : "outline"}>
                        {BILL_STATUS_LABELS[st]}
                      </Badge>
                      <span className="font-semibold tabular-nums">{formatBRL(b.amount_cents)}</span>
                    </div>
                    {b.status === "pending" && <BillActions id={b.id} />}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
