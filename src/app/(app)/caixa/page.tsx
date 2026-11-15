import { Wallet } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/methods";
import { localDayRange, todayIn } from "@/lib/agenda/time";
import { formatBRL, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { CloseCashForm, ConfirmPixButton, OpenCashForm } from "./cash-client";
import { CounterSaleButton, UndoSaleButton } from "./counter-sale";
import { PaymentDialog } from "./payment-dialog";

export const metadata = { title: "Caixa · Salonix" };

function toSummary(json: Record<string, number>) {
  const expected = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, json[m] ?? 0])) as Record<PaymentMethod, number>;
  return {
    expected,
    pixPendingCents: json.pix_pending ?? 0,
    totalExpectedCents: PAYMENT_METHODS.reduce((sum, m) => sum + expected[m], 0),
  };
}

export default async function CashPage() {
  const { salon, membership } = await requireRole(["admin", "reception"]);
  const isAdmin = membership.role === "admin";
  const tz = salon.timezone;
  const supabase = await createServerClient();

  const [
    { data: open, error: e1 },
    { data: closed, error: e2 },
    { data: awaiting, error: e4 },
    { data: pixPending, error: e5 },
    { data: products, error: e7 },
    { data: paidSales, error: e8 },
  ] = await Promise.all([
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
      .select("id, kind, total_cents, starts_at, arrived_at, customers(name), professionals(name)")
      .eq("salon_id", salon.id)
      .eq("status", "awaiting_payment")
      .order("starts_at", { nullsFirst: false })
      .order("arrived_at"),
    // Pix pendente de qualquer sessão: a confirmação pode vir depois do fechamento.
    supabase
      .from("transactions")
      .select("id, amount_cents, created_at, appointments(kind, customers(name))")
      .eq("salon_id", salon.id)
      .eq("type", "income")
      .eq("method", "pix")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("inventory_items")
      .select("id, name, sale_price_cents")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .not("sale_price_cents", "is", null)
      .order("name"),
    // Vendas no balcão recebidas hoje: é daqui que se estorna uma devolução.
    supabase
      .from("appointments")
      .select("id, kind, total_cents, discount_cents, arrived_at, refunded_at, customers(name)")
      .eq("salon_id", salon.id)
      .eq("kind", "sale")
      .eq("status", "paid")
      .gte("arrived_at", localDayRange(todayIn(tz), tz).from)
      .order("arrived_at", { ascending: false }),
  ]);
  if (e1 || e2 || e4 || e5 || e7 || e8) throw e1 ?? e2 ?? e4 ?? e5 ?? e7 ?? e8;
  const saleLabel = (a: { kind: string; customers: { name: string } | null }) =>
    a.customers?.name ?? (a.kind === "sale" ? "Venda no balcão" : "");

  const [{ data: txs, error: e3 }, { data: expectedJson, error: e6 }] = open
    ? await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, category, method, status, amount_cents, created_at, appointments(kind, customers(name))")
          .eq("cash_session_id", open.id)
          .order("created_at", { ascending: false }),
        // O esperado vem do banco: a recepção não lê as despesas de comissão.
        supabase.rpc("cash_session_summary", { p_salon_id: salon.id }),
      ])
    : [
        { data: [], error: null },
        { data: null, error: null },
      ];
  if (e3 || e6) throw e3 ?? e6;
  const summary = open && expectedJson ? toSummary(expectedJson as Record<string, number>) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <RealtimeRefresh salonId={salon.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Caixa</h1>
        <CounterSaleButton products={products.map((p) => ({ id: p.id, name: p.name, priceCents: p.sale_price_cents ?? 0 }))} />
      </div>

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
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{saleLabel(a)}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.kind === "sale" ? "Venda no balcão" : a.professionals?.name} · {formatBRL(a.total_cents)}
                    </p>
                  </div>
                  <PaymentDialog
                    appointment={{ id: a.id, customerName: saleLabel(a), totalCents: a.total_cents }}
                    cashOpen={Boolean(open)}
                  />
                  {a.kind === "sale" && <UndoSaleButton id={a.id} mode="cancel" />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {paidSales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vendas no balcão de hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y" data-testid="paid-sales">
              {paidSales.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{saleLabel(a)}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.arrived_at && formatDateTime(a.arrived_at, tz)} · {formatBRL(a.total_cents - a.discount_cents)}
                      {a.refunded_at && " · Estornada"}
                    </p>
                  </div>
                  {isAdmin && !a.refunded_at && <UndoSaleButton id={a.id} mode="refund" />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
                    <p className="truncate font-medium">{t.appointments && saleLabel(t.appointments)}</p>
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
                    {t.type === "income" ? t.appointments && saleLabel(t.appointments) : t.category === "estorno" ? "Estorno" : "Comissão"}
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
