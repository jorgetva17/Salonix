import "server-only";
import type { Busy } from "@/lib/agenda/slots";
import { localDayRange, timeToMinutes, toLocalMinutes, weekdayOf } from "@/lib/agenda/time";
import type { createServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createServerClient>>;

/** Status que ocupam horário na agenda. */
export const ACTIVE_STATUSES = ["scheduled", "waiting", "in_progress", "awaiting_payment", "paid"] as const;

/** Jornada e horários ocupados (atendimentos ativos e bloqueios) de um profissional num dia local. */
export async function loadProfessionalDay(
  supabase: Supabase,
  opts: { professionalId: string; date: string; timeZone: string; ignoreAppointmentId?: string },
): Promise<{ intervals: Busy[]; busy: Busy[] }> {
  const { from, to } = localDayRange(opts.date, opts.timeZone);
  const [{ data: schedule, error: e1 }, { data: blocks, error: e2 }, { data: appointments, error: e3 }] =
    await Promise.all([
      supabase
        .from("professional_schedules")
        .select("starts_at, ends_at")
        .eq("professional_id", opts.professionalId)
        .eq("weekday", weekdayOf(opts.date)),
      supabase
        .from("schedule_blocks")
        .select("starts_at, ends_at")
        .eq("professional_id", opts.professionalId)
        .lt("starts_at", to)
        .gt("ends_at", from),
      supabase
        .from("appointments")
        .select("id, starts_at, ends_at")
        .eq("professional_id", opts.professionalId)
        .eq("kind", "scheduled")
        .in("status", [...ACTIVE_STATUSES])
        .lt("starts_at", to)
        .gt("ends_at", from),
    ]);
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;

  const toBusy = (r: { starts_at: string | null; ends_at: string | null }) => ({
    start: toLocalMinutes(r.starts_at!, opts.date, opts.timeZone),
    end: toLocalMinutes(r.ends_at!, opts.date, opts.timeZone),
  });
  return {
    intervals: schedule.map((s) => ({ start: timeToMinutes(s.starts_at), end: timeToMinutes(s.ends_at) })),
    busy: [...blocks.map(toBusy), ...appointments.filter((a) => a.id !== opts.ignoreAppointmentId).map(toBusy)],
  };
}
