import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { localDayRange, todayIn } from "@/lib/agenda/time";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/methods";
import { PERIOD_PRESETS, resolvePeriod } from "@/lib/finance/period";
import { formatBRL, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FinanceTabs } from "../tabs";

export const metadata = { title: "Caixas fechados · Salonix" };

type ByMethod = Partial<Record<PaymentMethod, number>>;

const total = (values: ByMethod | null) => PAYMENT_METHODS.reduce((sum, m) => sum + (values?.[m] ?? 0), 0);

export default async function ClosedSessionsPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { salon } = await requireRole(["admin"]);
  const tz = salon.timezone;
  const today = todayIn(tz);
  const period = resolvePeriod(await searchParams, today);
  const supabase = await createServerClient();

  const { data: sessions, error } = await supabase
    .from("cash_sessions")
    .select("id, opened_at, closed_at, opened_by, closed_by, opening_cents, expected, counted, difference_cents")
    .eq("salon_id", salon.id)
    .not("closed_at", "is", null)
    .gte("closed_at", localDayRange(period.from, tz).from)
    .lt("closed_at", localDayRange(period.to, tz).to)
    .order("closed_at", { ascending: false });
  if (error) throw error;

  // Nomes de quem abriu e fechou (perfis de colegas são legíveis pela RLS).
  const userIds = [...new Set(sessions.flatMap((s) => [s.opened_by, s.closed_by]).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-semibold">Caixas fechados</h1>
      <FinanceTabs current="caixas" />

      <nav aria-label="Atalhos de período" className="flex flex-wrap gap-2">
        {PERIOD_PRESETS(today).map((p) => {
          const active = p.from === period.from && p.to === period.to;
          return (
            <Link
              key={p.label}
              href={`/financeiro/caixas?de=${p.from}&ate=${p.to}`}
              aria-current={active ? "page" : undefined}
              className={cn("flex h-11 items-center rounded-full border px-4 text-sm", active && "bg-primary text-primary-foreground")}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>

      {sessions.length === 0 ? (
        <EmptyState icon={Wallet} title="Nenhum caixa fechado neste período" description="Os fechamentos aparecem aqui com o esperado, o contado e a diferença." />
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {sessions.map((s) => {
                const expected = s.expected as ByMethod | null;
                const counted = s.counted as ByMethod | null;
                const diff = s.difference_cents ?? 0;
                const who = [s.opened_by && nameOf.get(s.opened_by), s.closed_by && nameOf.get(s.closed_by)];
                return (
                  <li key={s.id} data-testid="closed-session" className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{formatDateTime(s.closed_at!, tz)}</span>
                      <span
                        className={cn("font-semibold tabular-nums", diff < 0 && "text-destructive", diff > 0 && "text-amber-600 dark:text-amber-400")}
                        data-testid="session-difference"
                      >
                        {formatBRL(diff)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Aberto {formatDateTime(s.opened_at, tz)}
                      {who[0] && ` por ${who[0]}`} com {formatBRL(s.opening_cents)}
                      {who[1] && ` · fechado por ${who[1]}`}
                    </p>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Esperado</dt>
                        <dd className="tabular-nums" data-testid="session-expected">
                          {formatBRL(total(expected))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Contado</dt>
                        <dd className="tabular-nums" data-testid="session-counted">
                          {formatBRL(total(counted))}
                        </dd>
                      </div>
                    </dl>
                    <details>
                      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Ver por forma</summary>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-1 font-normal">Forma</th>
                            <th className="py-1 text-right font-normal">Esperado</th>
                            <th className="py-1 text-right font-normal">Contado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PAYMENT_METHODS.map((m) => (
                            <tr key={m}>
                              <td className="py-1">{PAYMENT_METHOD_LABELS[m]}</td>
                              <td className="py-1 text-right tabular-nums">{formatBRL(expected?.[m] ?? 0)}</td>
                              <td className="py-1 text-right tabular-nums">{formatBRL(counted?.[m] ?? 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
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
