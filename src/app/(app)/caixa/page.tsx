import { Wallet } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/cash/methods";
import { cashSummary, type CashTx } from "@/lib/cash/summary";
import { formatBRL, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { CloseCashForm, OpenCashForm } from "./cash-client";

export const metadata = { title: "Caixa · Salonix" };

export default async function CashPage() {
  const { salon } = await requireRole(["admin", "reception"]);
  const tz = salon.timezone;
  const supabase = await createServerClient();

  const [{ data: open, error: e1 }, { data: closed, error: e2 }] = await Promise.all([
    supabase.from("cash_sessions").select("id, opened_at, opening_cents").eq("salon_id", salon.id).is("closed_at", null).maybeSingle(),
    supabase
      .from("cash_sessions")
      .select("id, closed_at, difference_cents")
      .eq("salon_id", salon.id)
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false })
      .limit(5),
  ]);
  if (e1 || e2) throw e1 ?? e2;

  const { data: txs, error: e3 } = open
    ? await supabase.from("transactions").select("type, method, status, amount_cents").eq("cash_session_id", open.id)
    : { data: [], error: null };
  if (e3) throw e3;
  const summary = open
    ? cashSummary(
        open.opening_cents,
        txs.map((t) => ({ type: t.type, method: t.method, status: t.status, amountCents: t.amount_cents }) as CashTx),
      )
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <RealtimeRefresh salonId={salon.id} />
      <h1 className="text-2xl font-semibold">Caixa</h1>

      {!open || !summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Caixa fechado</CardTitle>
          </CardHeader>
          <CardContent>
            <OpenCashForm />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Caixa aberto</CardTitle>
            <p className="text-sm text-muted-foreground">
              Aberto em {formatDateTime(open.opened_at, tz)} com {formatBRL(open.opening_cents)}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              {PAYMENT_METHODS.map((m) => (
                <div key={m} className="contents">
                  <dt>{PAYMENT_METHOD_LABELS[m]} esperado</dt>
                  <dd className="text-right tabular-nums" data-testid={`expected-${m}`}>
                    {formatBRL(summary.expected[m])}
                  </dd>
                </div>
              ))}
              <dt className="font-medium">Total esperado</dt>
              <dd className="text-right font-medium tabular-nums">{formatBRL(summary.totalExpectedCents)}</dd>
              <dt className="text-muted-foreground">Pix a confirmar (fora do total)</dt>
              <dd className="text-right text-muted-foreground tabular-nums" data-testid="pix-pending">
                {formatBRL(summary.pixPendingCents)}
              </dd>
            </dl>
            <CloseCashForm key={open.id} expected={summary.expected} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Últimos fechamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {closed.length === 0 ? (
            <EmptyState icon={Wallet} title="Nenhum fechamento ainda" description="Os fechamentos de caixa aparecem aqui." />
          ) : (
            <ul className="divide-y text-sm" data-testid="closed-sessions">
              {closed.map((s) => (
                <li key={s.id} className="flex justify-between py-2">
                  <span>{formatDateTime(s.closed_at!, tz)}</span>
                  <span className="tabular-nums">Diferença {formatBRL(s.difference_cents ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
