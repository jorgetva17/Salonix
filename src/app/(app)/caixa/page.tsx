import type { Metadata } from "next";
import Link from "next/link";
import { RealtimeRefresh } from "@/components/agenda/realtime-refresh";
import { ConfirmPixButton } from "@/components/cash/appointment-flow";
import { CloseCashForm, CounterSaleForm, OpenCashForm } from "@/components/cash/cash-forms";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withDetails } from "@/lib/agenda-data";
import { DEFAULT_TIMEZONE, formatBRL, formatDateTime } from "@/lib/format";
import { METHODS, METHOD_LABELS } from "@/lib/payments";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Caixa · Salonix" };

export default async function CaixaPage() {
  const { membership, salon } = await requireRole(["admin", "reception"]);
  const tz = salon.timezone || DEFAULT_TIMEZONE;
  const supabase = await createServerClient();

  const { data: open } = await supabase.from("cash_sessions").select("*").is("closed_at", null).maybeSingle();
  const [{ data: awaitingRows }, { data: pendingPix }, { data: history }, summary, { data: products }, { data: customers }] = await Promise.all([
    supabase.from("appointments").select("*").eq("status", "awaiting_payment").order("updated_at"),
    open
      ? supabase.from("transactions").select("*").eq("cash_session_id", open.id).eq("payment_method", "pix").eq("status", "pending").eq("type", "income")
      : Promise.resolve({ data: [] }),
    supabase.from("cash_sessions").select("*").not("closed_at", "is", null).order("closed_at", { ascending: false }).limit(5),
    open ? supabase.rpc("cash_session_summary", { p_session_id: open.id }) : Promise.resolve({ data: null }),
    supabase.from("inventory_items").select("id, name, sale_price_cents").eq("active", true).not("sale_price_cents", "is", null).order("name"),
    supabase.from("customers").select("id, name").order("name").limit(300),
  ]);
  const awaiting = await withDetails(supabase, awaitingRows ?? []);
  const expected = summary.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Caixa</h1>
        <RealtimeRefresh salonId={membership.salonId} />
      </div>

      {!open ? (
        <Card>
          <CardHeader>
            <CardTitle>Caixa fechado</CardTitle>
            <CardDescription>Abra o caixa para receber pagamentos. Só pode haver um caixa aberto por salão.</CardDescription>
          </CardHeader>
          <CardContent><OpenCashForm /></CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Caixa aberto</CardTitle>
              <CardDescription>Desde {formatDateTime(open.opened_at, tz)} · valor inicial {formatBRL(open.opening_cents)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Esperado até agora (dinheiro inclui o valor inicial):</p>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {METHODS.map((m) => (
                  <div key={m} className="rounded-md border p-3">
                    <dt className="text-xs text-muted-foreground">{METHOD_LABELS[m]}</dt>
                    <dd className="text-lg font-semibold">{formatBRL(expected?.[m] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
              {(expected?.pending_pix ?? 0) > 0 ? (
                <p className="rounded-md bg-secondary px-3 py-2 text-sm">Pix pendente (fora do total conferido): <strong>{formatBRL(expected?.pending_pix ?? 0)}</strong></p>
              ) : null}
            </CardContent>
          </Card>

          {(pendingPix ?? []).length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Pix a confirmar</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {(pendingPix ?? []).map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>{formatBRL(t.amount_cents)} <span className="text-sm text-muted-foreground">· {formatDateTime(t.created_at, tz)}</span></span>
                      <ConfirmPixButton transactionId={t.id} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <section aria-labelledby="receber" className="space-y-3">
        <h2 id="receber" className="text-lg font-semibold">A receber ({awaiting.length})</h2>
        {awaiting.length === 0 ? (
          <EmptyState title="Nada a receber" description="Os atendimentos concluídos aparecem aqui para o pagamento." />
        ) : (
          <ul className="grid gap-3">
            {awaiting.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.displayName}</p>
                  <p className="text-sm text-muted-foreground">{a.serviceNames}</p>
                </div>
                <div className="flex items-center gap-3">
                  <strong>{formatBRL(a.total_cents)}</strong>
                  <Button asChild><Link href={`/atendimento/${a.id}`}>Receber</Link></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(products ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Venda de produto no balcão</CardTitle>
            <CardDescription>Cria uma venda sem atendimento; depois é só receber em “A receber”.</CardDescription>
          </CardHeader>
          <CardContent>
            <CounterSaleForm products={(products ?? []).map((p) => ({ id: p.id, name: p.name, priceCents: p.sale_price_cents ?? 0 }))} customers={customers ?? []} />
          </CardContent>
        </Card>
      ) : null}

      {open ? (
        <Card>
          <CardHeader><CardTitle>Fechar caixa</CardTitle></CardHeader>
          <CardContent><CloseCashForm sessionId={open.id} /></CardContent>
        </Card>
      ) : null}

      {(history ?? []).length > 0 ? (
        <section aria-labelledby="hist" className="space-y-3">
          <h2 id="hist" className="text-lg font-semibold">Últimos fechamentos</h2>
          <ul className="grid gap-2">
            {(history ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-4 py-3 text-sm">
                <span>{s.closed_at ? formatDateTime(s.closed_at, tz) : ""}</span>
                <span>
                  Diferença:{" "}
                  <Badge className={(s.difference_cents ?? 0) < 0 ? "bg-destructive/15 text-destructive" : ""}>
                    {formatBRL(s.difference_cents ?? 0)}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
