import Link from "next/link";
import { AlertTriangle, CalendarDays, Users, Wallet } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/agenda/status";
import { localDayRange, todayIn } from "@/lib/agenda/time";
import { maintenanceStatus } from "@/lib/equipment/status";
import { BILL_CATEGORIES, billStatus } from "@/lib/finance/bills";
import { formatTime } from "@/lib/format";
import { stockStatus } from "@/lib/inventory/status";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Painel · Salonix" };

/** Ordem em que os status do dia aparecem no cartão. */
const DAY_STATUSES = ["scheduled", "waiting", "in_progress", "awaiting_payment", "paid", "no_show"] as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage() {
  const { user, salon, membership } = await requireRole();
  const role = membership.role;
  const tz = salon.timezone;
  const today = todayIn(tz);
  const day = localDayRange(today, tz);
  const supabase = await createServerClient();

  // Profissional: só os próprios atendimentos (a RLS também mostra a fila geral).
  const { data: me } =
    role === "professional"
      ? await supabase.from("professionals").select("id").eq("salon_id", salon.id).eq("user_id", user.id).maybeSingle()
      : { data: null };

  let todayQuery = supabase
    .from("appointments")
    .select("id, status, starts_at, arrived_at, customers(name), professionals(name)")
    .eq("salon_id", salon.id)
    .neq("kind", "sale")
    .neq("status", "cancelled")
    .or(`and(starts_at.gte.${day.from},starts_at.lt.${day.to}),and(arrived_at.gte.${day.from},arrived_at.lt.${day.to})`)
    .order("starts_at", { nullsFirst: false });
  if (role === "professional") todayQuery = todayQuery.eq("professional_id", me?.id ?? "00000000-0000-0000-0000-000000000000");

  const [{ data: appts, error: e1 }, { count: queue, error: e2 }, { data: openCash, error: e3 }] = await Promise.all([
    todayQuery,
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("salon_id", salon.id).eq("status", "waiting"),
    role === "professional"
      ? Promise.resolve({ data: null, error: null })
      : supabase.from("cash_sessions").select("opened_at").eq("salon_id", salon.id).is("closed_at", null).maybeSingle(),
  ]);
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;

  const counts = new Map<string, number>();
  for (const a of appts) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);

  // Alertas, só para o admin.
  let alerts: { href: string; label: string }[] = [];
  if (role === "admin") {
    const [{ data: items, error: e4 }, { data: equipment, error: e5 }, { data: bills, error: e6 }] = await Promise.all([
      supabase.from("inventory_items").select("quantity, min_quantity").eq("salon_id", salon.id).eq("active", true),
      supabase
        .from("equipment")
        .select("status, equipment_maintenance(performed_on, created_at, next_due)")
        .eq("salon_id", salon.id)
        .neq("status", "inactive"),
      supabase
        .from("transactions")
        .select("status, due_date")
        .eq("salon_id", salon.id)
        .eq("type", "expense")
        .eq("status", "pending")
        .in("category", [...BILL_CATEGORIES]),
    ]);
    if (e4 || e5 || e6) throw e4 ?? e5 ?? e6;
    const lowStock = items.filter((i) => stockStatus(Number(i.quantity), Number(i.min_quantity)) !== "ok").length;
    const maintenance = equipment.filter((e) => {
      // Mesma regra da tela de equipamentos: vale a próxima data da manutenção mais recente.
      const last = [...e.equipment_maintenance].sort(
        (a, b) => b.performed_on.localeCompare(a.performed_on) || b.created_at.localeCompare(a.created_at),
      )[0];
      const st = maintenanceStatus(last?.next_due ?? null, today);
      return st === "overdue" || st === "soon";
    }).length;
    const dueBills = bills.filter((b) => ["overdue", "due_soon"].includes(billStatus(b, today))).length;
    alerts = [
      lowStock > 0 && { href: "/estoque", label: `${plural(lowStock, "item", "itens")} com estoque baixo ou negativo` },
      maintenance > 0 && {
        href: "/estoque/equipamentos",
        label: `${plural(maintenance, "equipamento", "equipamentos")} com manutenção atrasada ou próxima`,
      },
      dueBills > 0 && { href: "/financeiro/contas", label: `${plural(dueBills, "conta", "contas")} vencida(s) ou vencendo em 7 dias` },
    ].filter((a): a is { href: string; label: string } => Boolean(a));
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <RealtimeRefresh salonId={salon.id} />
      <h1 className="text-2xl font-semibold">{salon.name}</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card data-testid="dashboard-today" className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5" aria-hidden />
              {role === "professional" ? "Meus atendimentos de hoje" : "Atendimentos de hoje"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {appts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atendimento hoje até agora.</p>
            ) : role === "professional" ? (
              <ul className="divide-y text-sm">
                {appts.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 py-2">
                    <span className="min-w-0 truncate">
                      {a.starts_at ? formatTime(a.starts_at, tz) : "Sem horário"} · {a.customers?.name}
                    </span>
                    <span className="text-muted-foreground">{APPOINTMENT_STATUS_LABELS[a.status]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DAY_STATUSES.filter((s) => counts.has(s)).map((s) => (
                  <div key={s} className="rounded-lg border p-3">
                    <dt className="text-sm text-muted-foreground">{APPOINTMENT_STATUS_LABELS[s]}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{counts.get(s)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <Link href="/agenda" className="min-h-11 self-start py-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
              Abrir a agenda
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="dashboard-queue">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" aria-hidden />
              Fila de espera
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-lg font-semibold">{(queue ?? 0) === 0 ? "Ninguém na fila" : plural(queue ?? 0, "cliente", "clientes")}</p>
            <Link href="/agenda/fila" className="min-h-11 self-start py-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
              Ver a fila
            </Link>
          </CardContent>
        </Card>

        {role !== "professional" && (
          <Card data-testid="dashboard-cash">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-5" aria-hidden />
                {openCash ? "Caixa aberto" : "Caixa fechado"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {openCash ? `Aberto às ${formatTime(openCash.opened_at, tz)}` : "Abra o caixa para receber os atendimentos."}
              </p>
              <Link href="/caixa" className="min-h-11 self-start py-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
                Ir para o caixa
              </Link>
            </CardContent>
          </Card>
        )}

        {role === "admin" && (
          <Card data-testid="dashboard-alerts" className="sm:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5" aria-hidden />
                Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada pedindo atenção agora.</p>
              ) : (
                <ul className="flex flex-col">
                  {alerts.map((a) => (
                    <li key={a.href}>
                      <Link href={a.href} className="flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
                        {a.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
