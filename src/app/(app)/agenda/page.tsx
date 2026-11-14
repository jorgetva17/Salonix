import Link from "next/link";
import { ChevronLeft, ChevronRight, UserCog } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { addDays, localDayRange, timeToMinutes, todayIn, toLocalMinutes, weekdayOf } from "@/lib/agenda/time";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { DayGrid, WeekList, type AgendaAppointment, type AgendaColumn } from "./agenda-client";
import { AppointmentSheetProvider } from "./appointment-sheet";
import { ACTIVE_STATUSES } from "./data";
import { NewAppointmentButton } from "./new-appointment";

export const metadata = { title: "Agenda · Salonix" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const formatDay = (date: string) => `${WEEKDAYS[weekdayOf(date)]}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;

type SearchParams = { data?: string; visao?: string; profissional?: string };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { salon, membership } = await requireRole();
  const params = await searchParams;
  const tz = salon.timezone;
  const today = todayIn(tz);
  const date = params.data && DATE.test(params.data) ? params.data : today;
  const view = params.visao === "semana" ? "semana" : "dia";
  const canManage = membership.role === "admin" || membership.role === "reception";

  const supabase = await createServerClient();
  const { data: myProfessionalId } = await supabase.rpc("my_professional_id", { p_salon_id: salon.id });
  let professionalsQuery = supabase.from("professionals").select("id, name, color").eq("salon_id", salon.id).eq("active", true).order("name");
  if (!canManage) {
    professionalsQuery = professionalsQuery.eq("id", myProfessionalId ?? "00000000-0000-0000-0000-000000000000");
  }
  const { data: professionals, error } = await professionalsQuery;
  if (error) throw error;

  const selectedId = professionals.find((p) => p.id === params.profissional)?.id ?? professionals[0]?.id ?? "";
  const weekStart = addDays(date, -((weekdayOf(date) + 6) % 7));
  const rangeStart = view === "dia" ? date : weekStart;
  const rangeEnd = view === "dia" ? date : addDays(weekStart, 6);
  const from = localDayRange(rangeStart, tz).from;
  const to = localDayRange(rangeEnd, tz).to;

  const ids = view === "dia" ? professionals.map((p) => p.id) : [selectedId];
  const [{ data: appointments, error: e1 }, { data: schedules, error: e2 }, { data: blocks, error: e3 }, { data: services, error: e4 }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, professional_id, starts_at, ends_at, status, kind, total_cents, customers(name, phone), appointment_items(services(name))")
        .eq("salon_id", salon.id)
        .in("professional_id", ids)
        .in("status", [...ACTIVE_STATUSES])
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at"),
      supabase.from("professional_schedules").select("professional_id, weekday, starts_at, ends_at").in("professional_id", ids),
      supabase.from("schedule_blocks").select("professional_id, starts_at, ends_at").in("professional_id", ids).lt("starts_at", to).gt("ends_at", from),
      canManage
        ? supabase.from("services").select("id, name, duration_minutes, price_cents").eq("salon_id", salon.id).eq("active", true).order("name")
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (e1 || e2 || e3 || e4) throw e1 ?? e2 ?? e3 ?? e4;

  const toAgenda = (a: (typeof appointments)[number], day: string): AgendaAppointment => ({
    id: a.id,
    professionalId: a.professional_id!,
    start: toLocalMinutes(a.starts_at!, day, tz),
    end: toLocalMinutes(a.ends_at!, day, tz),
    startsAt: a.starts_at!,
    status: a.status,
    kind: a.kind,
    customerName: a.customers?.name ?? "",
    customerPhone: a.customers?.phone ?? null,
    services: a.appointment_items.map((i) => i.services?.name ?? ""),
    totalCents: a.total_cents,
  });

  const href = (changes: Partial<SearchParams>) => {
    const next = { data: date, visao: view, profissional: selectedId, ...changes };
    return `/agenda?${new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][])}`;
  };
  const step = view === "dia" ? 1 : 7;

  let body: React.ReactNode;
  if (professionals.length === 0) {
    body = (
      <EmptyState
        icon={UserCog}
        title={canManage ? "Nenhum profissional ativo" : "Sua agenda ainda não está ligada a um profissional"}
        description={canManage ? "Cadastre profissionais com jornada para começar a agendar." : "Peça ao administrador para vincular seu acesso."}
      />
    );
  } else if (view === "dia") {
    const columns: AgendaColumn[] = professionals.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      intervals: schedules
        .filter((s) => s.professional_id === p.id && s.weekday === weekdayOf(date))
        .map((s) => ({ start: timeToMinutes(s.starts_at), end: timeToMinutes(s.ends_at) })),
      blocks: blocks
        .filter((b) => b.professional_id === p.id)
        .map((b) => ({ start: toLocalMinutes(b.starts_at, date, tz), end: toLocalMinutes(b.ends_at, date, tz) })),
      appointments: appointments.filter((a) => a.professional_id === p.id).map((a) => toAgenda(a, date)),
    }));
    const edges = columns.flatMap((c) => [...c.intervals, ...c.appointments]);
    const range = {
      start: Math.min(480, ...edges.map((e) => Math.floor(e.start / 60) * 60)),
      end: Math.max(1200, ...edges.map((e) => Math.ceil(e.end / 60) * 60)),
    };
    body = <DayGrid columns={columns} range={{ start: Math.max(0, range.start), end: Math.min(1440, range.end) }} selectedId={selectedId} />;
  } else {
    const selected = professionals.find((p) => p.id === selectedId)!;
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
      const { from: dFrom, to: dTo } = localDayRange(day, tz);
      return {
        date: day,
        label: formatDay(day),
        appointments: appointments.filter((a) => a.starts_at! >= dFrom && a.starts_at! < dTo).map((a) => toAgenda(a, day)),
      };
    });
    body = <WeekList days={days} color={selected.color} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <RealtimeRefresh salonId={salon.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        {canManage && (
          <NewAppointmentButton
            services={services}
            professionals={professionals}
            defaultDate={date < today ? today : date}
            defaultProfessionalId={selectedId}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ data: addDays(date, -step) })} aria-label="Anterior" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11")}>
          <ChevronLeft aria-hidden />
        </Link>
        <Link href={href({ data: today })} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          Hoje
        </Link>
        <Link href={href({ data: addDays(date, step) })} aria-label="Próximo" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11")}>
          <ChevronRight aria-hidden />
        </Link>
        <span className="font-medium">
          {view === "dia" ? formatDay(date) : `Semana de ${formatDay(weekStart)}`}
        </span>
        <div className="ml-auto flex rounded-lg border p-1" role="group" aria-label="Visão">
          {(["dia", "semana"] as const).map((v) => (
            <Link
              key={v}
              href={href({ visao: v })}
              aria-current={view === v ? "page" : undefined}
              className={cn("flex h-9 items-center rounded-md px-3 text-sm", view === v && "bg-primary text-primary-foreground")}
            >
              {v === "dia" ? "Dia" : "Semana"}
            </Link>
          ))}
        </div>
      </div>

      {view === "semana" && professionals.length > 1 && (
        <div className="flex flex-wrap gap-2" aria-label="Profissional">
          {professionals.map((p) => (
            <Link
              key={p.id}
              href={href({ profissional: p.id })}
              aria-current={p.id === selectedId ? "page" : undefined}
              className={cn("flex h-11 items-center gap-2 rounded-full border px-4", p.id === selectedId && "border-primary bg-primary text-primary-foreground")}
            >
              <span className="size-3 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
              {p.name}
            </Link>
          ))}
        </div>
      )}

      <AppointmentSheetProvider
        salonName={salon.name}
        timeZone={tz}
        canManage={canManage}
        myProfessionalId={myProfessionalId ?? null}
        professionals={professionals}
      >
        {body}
      </AppointmentSheetProvider>
    </div>
  );
}
