import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompleteButton, ConfirmPixButton, ItemEditor, ReverseForm } from "@/components/cash/appointment-flow";
import { PaymentForm } from "@/components/cash/payment-form";
import { RealtimeRefresh } from "@/components/agenda/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/agenda";
import { withDetails } from "@/lib/agenda-data";
import { DEFAULT_TIMEZONE, formatBRL, formatDateTime } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/payments";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Atendimento · Salonix" };

const EVENT_LABELS: Record<string, string> = {
  created: "Criado", rescheduled: "Reagendado", cancelled: "Cancelado", no_show: "Faltou", started: "Iniciado", called: "Chamado da fila",
  item_added: "Serviço adicionado", item_removed: "Serviço removido", completed: "Concluído", paid: "Pago", reversed: "Estornado",
};

export default async function AtendimentoPage({ params }: PageProps<"/atendimento/[id]">) {
  const { id } = await params;
  const { membership, salon } = await requireRole(["admin", "reception", "professional"]);
  const tz = salon.timezone || DEFAULT_TIMEZONE;
  const isAdmin = membership.role === "admin";
  const canReceive = membership.role !== "professional";

  const supabase = await createServerClient();
  const { data: row } = await supabase.from("appointments").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const [appt] = await withDetails(supabase, [row]);

  const [{ data: pro }, { data: services }, { data: events }, { data: txs }, { data: commissions }] = await Promise.all([
    row.professional_id ? supabase.from("professionals").select("name, color").eq("id", row.professional_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("services").select("id, name, price_cents").eq("active", true).order("name"),
    supabase.from("appointment_events").select("*").eq("appointment_id", id).order("created_at"),
    canReceive ? supabase.from("transactions").select("*").eq("appointment_id", id).order("created_at") : Promise.resolve({ data: [] }),
    supabase.from("commissions").select("*").eq("appointment_id", id),
  ]);

  const status = appt.status;
  const editable = status === "in_progress" || (status === "awaiting_payment" && canReceive);
  const due = appt.total_cents - appt.discount_cents;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/agenda" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary"><ArrowLeft className="size-4" /> Agenda</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{appt.displayName}</h1>
        <div className="flex items-center gap-3"><RealtimeRefresh salonId={membership.salonId} /><Badge>{STATUS_LABELS[status]}</Badge></div>
      </div>
      <p className="text-sm text-muted-foreground">
        {pro ? <>Profissional: <strong>{pro.name}</strong> · </> : null}
        {appt.starts_at ? `Início: ${formatDateTime(appt.starts_at, tz)}` : "Sem horário marcado"}
      </p>

      <Card>
        <CardHeader><CardTitle>Serviços</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ItemEditor
            id={id}
            editable={editable}
            items={appt.items.map((i) => ({ id: i.id, description: i.description, priceCents: i.unit_price_cents, quantity: i.quantity }))}
            services={(services ?? []).map((s) => ({ id: s.id, name: s.name, priceCents: s.price_cents }))}
          />
          <p className="flex justify-between border-t pt-3 font-semibold">
            <span>Total</span><span>{formatBRL(appt.total_cents)}</span>
          </p>
          {appt.discount_cents > 0 ? (
            <p className="flex justify-between text-sm text-muted-foreground">
              <span>Desconto</span><span>− {formatBRL(appt.discount_cents)}</span>
            </p>
          ) : null}
          {status === "in_progress" ? <CompleteButton id={id} /> : null}
        </CardContent>
      </Card>

      {status === "awaiting_payment" && canReceive ? (
        <Card>
          <CardHeader>
            <CardTitle>Receber pagamento</CardTitle>
            <CardDescription>É preciso ter o caixa aberto. Valor a receber sem desconto: {formatBRL(due)}.</CardDescription>
          </CardHeader>
          <CardContent><PaymentForm id={id} totalCents={appt.total_cents} /></CardContent>
        </Card>
      ) : null}
      {status === "awaiting_payment" && !canReceive ? (
        <p className="rounded-md bg-secondary px-3 py-2 text-sm">Atendimento concluído. Aguardando o recebimento na recepção.</p>
      ) : null}

      {(txs ?? []).length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Pagamentos</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {(txs ?? []).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {t.type === "expense" ? "Estorno · " : ""}{t.payment_method ? METHOD_LABELS[t.payment_method] : ""}{" "}
                    <Badge>{t.status === "pending" ? "Pendente" : t.status === "reversed" ? "Estornado" : "Pago"}</Badge>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={t.type === "expense" ? "text-destructive" : ""}>{t.type === "expense" ? "− " : ""}{formatBRL(t.amount_cents)}</span>
                    {t.payment_method === "pix" && t.status === "pending" && t.type === "income" ? <ConfirmPixButton transactionId={t.id} appointmentId={id} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {(commissions ?? []).length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Comissão</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {(commissions ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{c.percent}% de {formatBRL(c.base_cents)} <Badge>{{ blocked: "Aguardando Pix", available: "Disponível", paid: "Paga", reversed: "Estornada" }[c.status]}</Badge></span>
                  <strong>{formatBRL(c.amount_cents)}</strong>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isAdmin && status === "paid" ? (
        <Card>
          <CardHeader><CardTitle>Estorno</CardTitle></CardHeader>
          <CardContent><ReverseForm id={id} /></CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-1 text-sm">
            {(events ?? []).map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span>{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                <span className="text-muted-foreground">{formatDateTime(e.created_at, tz)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
