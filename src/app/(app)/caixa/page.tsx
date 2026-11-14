import { Wallet } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/methods";
import { cashSummary, type CashTx } from "@/lib/cash/summary";
import { formatBRL, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { CloseCashForm, ConfirmPixButton, OpenCashForm } from "./cash-client";
import { PaymentDialog } from "./payment-dialog";

export const metadata = { title: "Caixa · Salonix" };

export default async function CashPage() {
  const { salon } = await requireRole(["admin", "reception"]);
  const tz = salon.timezone;
  const supabase = await createServerClient();

  const [{ data: open, error: e1 }, { data: closed, error: e2 }, { data: awaiting, error: e4 }, { data: pixPending, error: e5 }] = await Promise.all([
    supabase.from("cash_sessions").select("id, opened_at, opening_cents").eq("salon_id", salon.id).is("closed_at", null).maybeSingle(),
    supabase
      .from("cash_sessions")
      .select("id, closed_at, difference_cents")
      .eq("salon_id", salon.id)
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false })
      .limit(5),
    supabase
      .from("appointments")
      .select("id, total_cents, starts_at, customers(name), professionals(name)")
      .eq("salon_id", salon.id)
      .eq("status", "awaiting_payment")
      .order("starts_at"),
    // Pix pendente de qualquer sessão: a confirmação pode vir depois do fechamento.
    supabase
      .from("transactions")
      .select("id, amount_cents, created_at, appointments(customers(name))")
      .eq("salon_id", salon.id)
      .eq("type", "income")
      .eq("method", "pix")
      .eq("status", "pending")
      .order("created_at"),
  ]);
  if (e1 || e2 || e4 || e5) throw e1 ?? e2 ?? e4 ?? e5;

  const { data: txs, error: e3 } = open
    ? await supabase
        .from("transactions")
        .select("id, type, category, method, status, amount_cents, created_at, appointments(customers(name))")
        .eq("cash_session_id", open.id)
        .order("created_at", { ascending: false })
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
          <CardTitle>Aguardando pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          {awaiting.length === 0 ? (
            <EmptyState icon={Wallet} title="Nada para receber" description="Atendimentos concluídos aparecem aqui para receber." />
          ) : (
            <ul className="divide-y" data-testid="awaiting-payment">
              {awaiting.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.customers?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.professionals?.name} · {formatBRL(a.total_cents)}
                    </p>
                  </div>
                  <PaymentDialog
                    appointment={{ id: a.id, customerName: a.customers?.name ?? "", totalCents: a.total_cents }}
                    cashOpen={Boolean(open)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {pixPending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pix a confirmar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y" data-testid="pix-to-confirm">
              {pixPending.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.appointments?.customers?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatBRL(t.amount_cents)} · {formatDateTime(t.created_at, tz)}
                    </p>
                  </div>
                  <ConfirmPixButton transactionId={t.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {open && txs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Movimentos desta sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm" data-testid="session-movements">
              {txs.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    {t.type === "income" ? t.appointments?.customers?.name : t.category === "estorno" ? "Estorno" : "Comissão"}
                    {t.method && ` · ${PAYMENT_METHOD_LABELS[t.method as PaymentMethod]}`}
                    {t.status === "pending" && " · a confirmar"}
                    {t.status === "reversed" && " · estornado"}
                  </span>
                  <span className="tabular-nums">{t.type === "expense" ? `-${formatBRL(t.amount_cents)}` : formatBRL(t.amount_cents)}</span>
                </li>
              ))}
            </ul>
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
