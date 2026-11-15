import { NextResponse, type NextRequest } from "next/server";
import { withDetails } from "@/lib/agenda-data";
import { DEFAULT_TIMEZONE, formatDateTime, isoToZonedLocal, zonedLocalToIso } from "@/lib/format";
import { shiftDate } from "@/lib/agenda";
import { METHOD_LABELS } from "@/lib/payments";
import { CATEGORY_LABELS, csvMoney, csvText, parsePeriod, toCsv } from "@/lib/reports";
import { getActiveMembership } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** CSV de vendas ou despesas do período (só admin). */
export async function GET(request: NextRequest) {
  const active = await getActiveMembership();
  if (!active) return new NextResponse("Não autenticado", { status: 401 });
  if (active.membership.role !== "admin") return new NextResponse("Sem permissão", { status: 403 });

  const tz = active.salon.timezone || DEFAULT_TIMEZONE;
  const sp = request.nextUrl.searchParams;
  const today = isoToZonedLocal(new Date().toISOString(), tz).slice(0, 10);
  const { from, to } = parsePeriod(sp.get("de"), sp.get("ate"), today);
  const start = zonedLocalToIso(`${from}T00:00`, tz);
  const end = zonedLocalToIso(`${shiftDate(to, 1)}T00:00`, tz);
  const type = sp.get("tipo") === "despesas" ? "despesas" : "vendas";
  const supabase = await createServerClient();

  let csv: string;
  if (type === "vendas") {
    const { data: events } = await supabase.from("appointment_events").select("appointment_id, created_at").eq("event_type", "paid").gte("created_at", start).lt("created_at", end).limit(5000);
    const paidAt = new Map((events ?? []).map((e) => [e.appointment_id, e.created_at]));
    const ids = [...paidAt.keys()];
    const { data: rows } = ids.length ? await supabase.from("appointments").select("*").in("id", ids).eq("status", "paid") : { data: [] };
    const appts = await withDetails(supabase, rows ?? []);
    const [{ data: pros }, { data: txs }] = await Promise.all([
      supabase.from("professionals").select("id, name"),
      ids.length ? supabase.from("transactions").select("appointment_id, payment_method, amount_cents, status").in("appointment_id", ids).eq("type", "income").in("status", ["paid", "pending"]) : Promise.resolve({ data: [] }),
    ]);
    const proName = new Map((pros ?? []).map((p) => [p.id, p.name]));
    csv = toCsv(
      ["Data", "Cliente", "Profissional", "Serviços e produtos", "Total (R$)", "Desconto (R$)", "Líquido (R$)", "Formas de pagamento"],
      appts
        .sort((a, b) => (paidAt.get(a.id) ?? "").localeCompare(paidAt.get(b.id) ?? ""))
        .map((a) => [
          formatDateTime(paidAt.get(a.id) ?? a.updated_at, tz),
          csvText(a.displayName),
          a.professional_id ? csvText(proName.get(a.professional_id) ?? "") : "",
          csvText(a.serviceNames || a.items.map((i) => i.description).join(" + ")),
          csvMoney(a.total_cents),
          csvMoney(a.discount_cents),
          csvMoney(a.total_cents - a.discount_cents),
          (txs ?? []).filter((t) => t.appointment_id === a.id).map((t) => `${t.payment_method ? METHOD_LABELS[t.payment_method] : ""} ${csvMoney(t.amount_cents)}${t.status === "pending" ? " (pendente)" : ""}`).join(" + "),
        ]),
    );
  } else {
    const [{ data: paid }, { data: pending }] = await Promise.all([
      supabase.from("transactions").select("*").eq("type", "expense").eq("status", "paid").not("category", "in", "(refund)").gte("paid_at", start).lt("paid_at", end).limit(5000),
      supabase.from("transactions").select("*").eq("type", "expense").eq("status", "pending").gte("due_date", from).lte("due_date", to).limit(5000),
    ]);
    csv = toCsv(
      ["Categoria", "Descrição", "Valor (R$)", "Situação", "Vencimento", "Pago em", "Forma de pagamento"],
      [...(paid ?? []), ...(pending ?? [])].map((t) => [
        csvText(CATEGORY_LABELS[t.category] ?? t.category),
        csvText(t.description),
        csvMoney(t.amount_cents),
        t.status === "paid" ? "Paga" : "Pendente",
        t.due_date ? t.due_date.split("-").reverse().join("/") : "",
        t.paid_at ? formatDateTime(t.paid_at, tz) : "",
        t.payment_method ? METHOD_LABELS[t.payment_method] : "",
      ]),
    );
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="salonix-${type}-${from}-a-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
