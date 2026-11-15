import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentActions } from "@/components/agenda/appointment-actions";
import { AppointmentForm, RescheduleForm } from "@/components/agenda/forms";
import { RealtimeRefresh } from "@/components/agenda/realtime-refresh";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { STATUS_LABELS, findFreeSlots, isValidDate, shiftDate, weekdayOf } from "@/lib/agenda";
import { withDetails } from "@/lib/agenda-data";
import { DEFAULT_TIMEZONE, WEEKDAYS, formatBRL, formatDateTime, formatTime, isoToZonedLocal, whatsappLink, zonedLocalToIso } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agenda · Salonix" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const { membership, salon } = await requireRole(["admin", "reception", "professional"]);
  const canManage = membership.role !== "professional";
  const tz = salon.timezone || DEFAULT_TIMEZONE;
  const sp = await searchParams;

  const today = isoToZonedLocal(new Date().toISOString(), tz).slice(0, 10);
  const dateParam = first(sp.d);
  const date = isValidDate(dateParam) ? dateParam : today;
  const dayStart = zonedLocalToIso(`${date}T00:00`, tz);
  const dayEnd = zonedLocalToIso(`${shiftDate(date, 1)}T00:00`, tz);
  const filterPro = first(sp.p) ?? "";

  const supabase = await createServerClient();
  let query = supabase.from("appointments").select("*").gte("starts_at", dayStart).lt("starts_at", dayEnd).order("starts_at");
  if (filterPro) query = query.eq("professional_id", filterPro);
  const [{ data: rows }, { data: pros }, { data: services }, { data: customers }] = await Promise.all([
    query,
    supabase.from("professionals").select("id, name, color").eq("active", true).order("name"),
    supabase.from("services").select("id, name, duration_minutes, price_cents").eq("active", true).order("name"),
    canManage ? supabase.from("customers").select("id, name").order("name").limit(300) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const appointments = await withDetails(supabase, rows ?? []);
  const proOf = new Map((pros ?? []).map((p) => [p.id, p]));
  const serviceOptions = (services ?? []).map((s) => ({ id: s.id, name: s.name, durationMinutes: s.duration_minutes, priceCents: s.price_cents }));

  // Busca de horários livres (GET): ?pf=profissional&sv=id,id
  const pf = first(sp.pf) ?? "";
  const sv = (first(sp.sv) ?? "").split(",").filter(Boolean);
  let slots: string[] = [];
  let slotDuration = 0;
  if (canManage && pf && sv.length) {
    slotDuration = serviceOptions.filter((s) => sv.includes(s.id)).reduce((n, s) => n + s.durationMinutes, 0);
    const [{ data: sched }, { data: busyAppts }, { data: blocks }] = await Promise.all([
      supabase.from("professional_schedules").select("start_time, end_time").eq("professional_id", pf).eq("weekday", weekdayOf(date)),
      supabase.from("appointments").select("starts_at, ends_at").eq("professional_id", pf).gte("ends_at", dayStart).lt("starts_at", dayEnd).not("status", "in", "(cancelled,no_show)"),
      supabase.from("schedule_blocks").select("starts_at, ends_at").eq("professional_id", pf).gte("ends_at", dayStart).lt("starts_at", dayEnd),
    ]);
    if (slotDuration > 0) {
      slots = findFreeSlots({
        date,
        timeZone: tz,
        durationMinutes: slotDuration,
        intervals: (sched ?? []).map((s) => ({ start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) })),
        busy: [...(busyAppts ?? []), ...(blocks ?? [])].filter((b) => b.starts_at && b.ends_at).map((b) => ({ start: b.starts_at as string, end: b.ends_at as string })),
      });
    }
  }
  const prefill = first(sp.novo);
  const link = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { d: date, p: filterPro || undefined, pf: pf || undefined, sv: sv.join(",") || undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/agenda?${params.toString()}`;
  };

  const [y, m, d] = date.split("-");
  const title = `${WEEKDAYS[weekdayOf(date)]}, ${d}/${m}/${y}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <RealtimeRefresh salonId={membership.salonId} />
      </div>

      <nav aria-label="Dia" className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon" aria-label="Dia anterior"><Link href={link({ d: shiftDate(date, -1) })}><ChevronLeft /></Link></Button>
        <Button asChild variant={date === today ? "default" : "outline"}><Link href={link({ d: today })}>Hoje</Link></Button>
        <Button asChild variant="outline" size="icon" aria-label="Próximo dia"><Link href={link({ d: shiftDate(date, 1) })}><ChevronRight /></Link></Button>
        <form className="flex items-center gap-2">
          {filterPro ? <input type="hidden" name="p" value={filterPro} /> : null}
          <Input type="date" name="d" defaultValue={date} aria-label="Escolher data" className="w-auto" />
          <Button type="submit" variant="secondary">Ir</Button>
        </form>
        <span className="ml-auto text-sm font-medium">{title}</span>
      </nav>

      {canManage && (pros?.length ?? 0) > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por profissional">
          <Button asChild size="sm" variant={filterPro ? "outline" : "default"}><Link href={link({ p: undefined })}>Todos</Link></Button>
          {(pros ?? []).map((p) => (
            <Button key={p.id} asChild size="sm" variant={filterPro === p.id ? "default" : "outline"}>
              <Link href={link({ p: p.id })}><span className="size-3 rounded-full border" style={{ background: p.color }} aria-hidden />{p.name}</Link>
            </Button>
          ))}
        </div>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader><CardTitle>Novo agendamento</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {serviceOptions.length === 0 || (pros?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Cadastre ao menos um serviço e um profissional (com jornada) para agendar.</p>
            ) : (
              <>
                <form className="grid gap-3 rounded-md bg-muted p-3 sm:grid-cols-[1fr_1fr_auto]" aria-label="Buscar horários livres">
                  <input type="hidden" name="d" value={date} />
                  <label className="grid gap-1 text-sm font-medium">Profissional
                    <select name="pf" defaultValue={pf} className="min-h-11 rounded-md border border-input bg-card px-3 font-normal">
                      <option value="">Escolha…</option>
                      {(pros ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium">Serviços (Ctrl/⌘ para vários)
                    <select name="sv" multiple defaultValue={sv} size={Math.min(4, serviceOptions.length)} className="rounded-md border border-input bg-card px-3 py-1 font-normal">
                      {serviceOptions.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min</option>)}
                    </select>
                  </label>
                  <Button type="submit" variant="secondary" className="self-end">Ver horários livres</Button>
                </form>
                {pf && sv.length ? (
                  slots.length > 0 ? (
                    <div>
                      <p className="mb-2 text-sm text-muted-foreground">Horários livres em {title} ({slotDuration} min):</p>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((s) => (
                          <Button key={s} asChild size="sm" variant={prefill === s ? "default" : "outline"}>
                            <Link href={link({ novo: s })}>{formatTime(s, tz)}</Link>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem horários livres nesse dia para essa combinação.</p>
                  )
                ) : null}
                <AppointmentForm
                  key={`${prefill ?? ""}-${pf}-${sv.join(",")}`}
                  customers={(customers ?? []).map((c) => ({ id: c.id, name: c.name }))}
                  professionals={(pros ?? []).map((p) => ({ id: p.id, name: p.name }))}
                  services={serviceOptions}
                  defaults={{ startsAt: prefill ? isoToZonedLocal(prefill, tz) : `${date}T09:00`, professionalId: pf || undefined, serviceIds: sv }}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {appointments.length === 0 ? (
        <EmptyState title="Nenhum agendamento neste dia" description={canManage ? "Use o formulário acima para agendar." : "Você não tem atendimentos neste dia."} />
      ) : (
        <ul className="grid gap-3">
          {appointments.map((a) => {
            const pro = a.professional_id ? proOf.get(a.professional_id) : undefined;
            const done = a.status === "cancelled" || a.status === "no_show";
            const reminder = `Olá ${a.displayName}! Lembrete do seu horário na ${salon.name}: ${a.starts_at ? formatDateTime(a.starts_at, tz) : ""}. Responda para confirmar.`;
            return (
              <li key={a.id} className={cn("rounded-lg border bg-card p-4", done && "opacity-60")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {a.starts_at ? formatTime(a.starts_at, tz) : "--:--"}
                      {a.ends_at ? ` – ${formatTime(a.ends_at, tz)}` : ""}{" "}
                      <Badge className="ml-1 align-middle">{STATUS_LABELS[a.status]}</Badge>
                      {a.kind === "walk_in" ? <Badge className="ml-1 align-middle">Sem hora marcada</Badge> : null}
                    </p>
                    <p className="mt-1 truncate">{a.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.serviceNames} · {formatBRL(a.total_cents)}
                    </p>
                    {pro ? (
                      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="size-3 rounded-full border" style={{ background: pro.color }} aria-hidden /> {pro.name}
                      </p>
                    ) : null}
                    {a.notes ? <p className="mt-1 text-sm">{a.notes}</p> : null}
                  </div>
                  {["in_progress", "awaiting_payment", "paid"].includes(a.status) ? (
                    <Button asChild variant="secondary" size="sm"><Link href={`/atendimento/${a.id}`}>Abrir atendimento</Link></Button>
                  ) : null}
                  {!done && a.status === "scheduled" ? (
                    <div className="flex flex-col items-end gap-2">
                      <AppointmentActions id={a.id} name={a.displayName} canManage={canManage} canStart />
                      {canManage && a.phone ? (
                        <Button asChild variant="ghost" size="sm">
                          <a href={whatsappLink(a.phone, reminder)} target="_blank" rel="noopener noreferrer"><MessageCircle /> Lembrar no WhatsApp</a>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {canManage && a.status === "scheduled" && a.starts_at ? (
                  <details className="mt-3">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">Reagendar</summary>
                    <div className="pt-2">
                      <RescheduleForm id={a.id} startsAt={isoToZonedLocal(a.starts_at, tz)} professionalId={a.professional_id ?? ""}
                        professionals={(pros ?? []).map((p) => ({ id: p.id, name: p.name }))} />
                    </div>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
