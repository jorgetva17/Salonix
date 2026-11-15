import { DEFAULT_TIMEZONE, zonedLocalToIso } from "@/lib/format";

// ---------------------------------------------------------------------------
// Fila de walk-in: posição e estimativa de espera
// ---------------------------------------------------------------------------
export type QueueEntry = { id: string; professionalId: string | null; durationMinutes: number };
export type ProfessionalLoad = { id: string; freeAt: Date };
export type WaitEstimate = {
  position: number;
  /** Minutos até começar; null quando ninguém elegível pode atender. */
  waitMinutes: number | null;
  professionalId: string | null;
};

/**
 * A fila é sempre por ordem de chegada. Cada cliente é simulado no primeiro profissional
 * elegível que ficar livre (o preferido, se houver); a espera é a soma das durações restantes
 * dos atendimentos em curso e da fila à frente naquele profissional.
 */
export function estimateWaits(queue: QueueEntry[], professionals: ProfessionalLoad[], now: Date): Map<string, WaitEstimate> {
  const freeAt = new Map(professionals.map((p) => [p.id, Math.max(p.freeAt.getTime(), now.getTime())]));
  const result = new Map<string, WaitEstimate>();
  queue.forEach((entry, index) => {
    const eligible = entry.professionalId ? professionals.filter((p) => p.id === entry.professionalId) : professionals;
    if (eligible.length === 0) {
      result.set(entry.id, { position: index + 1, waitMinutes: null, professionalId: null });
      return;
    }
    const best = eligible.reduce((a, b) => (freeAt.get(b.id)! < freeAt.get(a.id)! ? b : a));
    const start = freeAt.get(best.id)!;
    result.set(entry.id, {
      position: index + 1,
      waitMinutes: Math.max(0, Math.ceil((start - now.getTime()) / 60000)),
      professionalId: best.id,
    });
    freeAt.set(best.id, start + entry.durationMinutes * 60000);
  });
  return result;
}

/** Quando o profissional fica livre: fim do atendimento em curso (início + duração) ou agora. */
export function freeAtFor(inProgress: { startedAt: string; durationMinutes: number } | null, now: Date): Date {
  if (!inProgress) return now;
  const end = new Date(inProgress.startedAt).getTime() + inProgress.durationMinutes * 60000;
  return new Date(Math.max(end, now.getTime()));
}

// ---------------------------------------------------------------------------
// Horários livres de um profissional num dia
// ---------------------------------------------------------------------------
export type DayInterval = { start: string; end: string }; // "HH:MM"
export type BusyRange = { start: string; end: string }; // ISO

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Horários de início (ISO/UTC) que cabem na jornada, sem conflito e não passados. */
export function findFreeSlots(input: {
  date: string; // YYYY-MM-DD no fuso do salão
  intervals: DayInterval[]; // jornada do dia da semana
  busy: BusyRange[]; // atendimentos e bloqueios
  durationMinutes: number;
  stepMinutes?: number;
  timeZone?: string;
  now?: Date;
}): string[] {
  const { date, intervals, busy, durationMinutes } = input;
  const step = input.stepMinutes ?? 15;
  const tz = input.timeZone ?? DEFAULT_TIMEZONE;
  const now = (input.now ?? new Date()).getTime();
  const busyMs = busy.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()] as const);
  const slots: string[] = [];

  for (const interval of intervals) {
    const from = toMinutes(interval.start);
    const to = toMinutes(interval.end);
    for (let t = from; t + durationMinutes <= to; t += step) {
      const startIso = zonedLocalToIso(`${date}T${toHHMM(t)}`, tz);
      const s = new Date(startIso).getTime();
      const e = s + durationMinutes * 60000;
      if (s < now) continue;
      if (busyMs.some(([bs, be]) => s < be && e > bs)) continue;
      slots.push(startIso);
    }
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Apresentação
// ---------------------------------------------------------------------------
export const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  waiting: "Na fila",
  in_progress: "Em atendimento",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

/** Soma/subtrai dias de uma data "YYYY-MM-DD". */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const isValidDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
