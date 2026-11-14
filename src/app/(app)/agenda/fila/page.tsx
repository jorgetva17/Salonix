import { Users } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { estimateWaits, type Server } from "@/lib/agenda/queue";
import { timeToMinutes, todayIn, toLocalMinutes, weekdayOf } from "@/lib/agenda/time";
import { formatTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { AgendaTabs } from "../tabs";
import { WalkInButton } from "../walk-in";
import { CallNextButton, CompleteButton, QueueItemActions } from "./queue-client";

export const metadata = { title: "Fila · Salonix" };

export default async function QueuePage() {
  const { salon, membership } = await requireRole();
  const canManage = membership.role === "admin" || membership.role === "reception";
  const tz = salon.timezone;
  const supabase = await createServerClient();

  const { data: myProfessionalId } = await supabase.rpc("my_professional_id", { p_salon_id: salon.id });
  let professionalsQuery = supabase.from("professionals").select("id, name, color").eq("salon_id", salon.id).eq("active", true).order("name");
  if (!canManage) professionalsQuery = professionalsQuery.eq("id", myProfessionalId ?? "00000000-0000-0000-0000-000000000000");

  const nowIso = new Date().toISOString();
  const today = todayIn(tz);
  const [
    { data: professionals, error: e1 },
    { data: waiting, error: e2 },
    { data: inProgress, error: e3 },
    { data: schedules, error: e4 },
    { data: blocks, error: e5 },
    { data: services, error: e6 },
  ] = await Promise.all([
    professionalsQuery,
    supabase
      .from("appointments")
      .select("id, professional_id, arrived_at, duration_minutes, customers(name), appointment_items(services(name))")
      .eq("salon_id", salon.id)
      .eq("kind", "walk_in")
      .eq("status", "waiting")
      .order("arrived_at"),
    supabase
      .from("appointments")
      .select("id, professional_id, ends_at, customers(name), appointment_items(services(name))")
      .eq("salon_id", salon.id)
      .eq("status", "in_progress"),
    supabase.from("professional_schedules").select("professional_id, starts_at, ends_at").eq("salon_id", salon.id).eq("weekday", weekdayOf(today)),
    supabase.from("schedule_blocks").select("professional_id").eq("salon_id", salon.id).lte("starts_at", nowIso).gt("ends_at", nowIso),
    canManage
      ? supabase.from("services").select("id, name, duration_minutes, price_cents").eq("salon_id", salon.id).eq("active", true).order("name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (e1 || e2 || e3 || e4 || e5 || e6) throw e1 ?? e2 ?? e3 ?? e4 ?? e5 ?? e6;

  // Quem trabalha agora entra na estimativa; o atendimento em curso ocupa até o fim previsto.
  const nowMinutes = toLocalMinutes(nowIso, today, tz);
  const blocked = new Set(blocks.map((b) => b.professional_id));
  const servers: Server[] = professionals
    .filter(
      (p) =>
        !blocked.has(p.id) &&
        schedules.some((s) => s.professional_id === p.id && timeToMinutes(s.starts_at) <= nowMinutes && nowMinutes < timeToMinutes(s.ends_at)),
    )
    .map((p) => ({ professionalId: p.id, busyUntil: inProgress.find((a) => a.professional_id === p.id)?.ends_at ?? null }));
  const waits = estimateWaits(
    waiting.map((w) => ({ id: w.id, arrivedAt: w.arrived_at!, durationMinutes: w.duration_minutes, professionalId: w.professional_id })),
    servers,
    nowIso,
  );
  const nameOf = new Map(professionals.map((p) => [p.id, p.name]));
  const serviceNames = (items: { services: { name: string } | null }[]) => items.map((i) => i.services?.name ?? "").join(" + ");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <RealtimeRefresh salonId={salon.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fila</h1>
        <div className="flex items-center gap-2">
          <AgendaTabs current="fila" />
          {canManage && <WalkInButton services={services} professionals={professionals} />}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aguardando</CardTitle>
        </CardHeader>
        <CardContent>
          {waiting.length === 0 ? (
            <EmptyState icon={Users} title="Ninguém na fila" description="Use “Cliente na porta” quando alguém chegar sem horário." />
          ) : (
            <ol className="divide-y" data-testid="queue-list">
              {waiting.map((w, index) => {
                const wait = waits.get(w.id);
                const name = w.customers?.name ?? "";
                return (
                  <li key={w.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid="queue-item">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">
                        {serviceNames(w.appointment_items)} ·{" "}
                        {w.professional_id ? `aguarda ${nameOf.get(w.professional_id) ?? "profissional"}` : "qualquer profissional"} · chegou{" "}
                        {formatTime(w.arrived_at!, tz)} · {wait == null ? "sem estimativa" : wait === 0 ? "próximo a ser atendido" : `espera ~${wait} min`}
                      </p>
                    </div>
                    {canManage && <QueueItemActions appointmentId={w.id} customerName={name} />}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profissionais</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {professionals.map((p) => {
              const current = inProgress.find((a) => a.professional_id === p.id);
              return (
                <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid={`queue-professional-${p.id}`}>
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {current
                        ? `Em atendimento: ${current.customers?.name ?? ""} (${serviceNames(current.appointment_items)}) até ~${formatTime(current.ends_at!, tz)}`
                        : "Livre"}
                    </p>
                  </div>
                  {current ? (
                    <CompleteButton appointmentId={current.id} />
                  ) : (
                    <CallNextButton professionalId={p.id} professionalName={p.name} />
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
