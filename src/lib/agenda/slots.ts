import { minutesToTime } from "./time";

/** Intervalo em minutos locais do dia, [start, end). */
export type Busy = { start: number; end: number };

/**
 * Horários ("HH:MM") em que um atendimento de `durationMinutes` cabe inteiro num
 * trecho da jornada sem cruzar nada ocupado (agendamentos e bloqueios).
 */
export function availableSlots(input: {
  intervals: { start: number; end: number }[];
  busy: Busy[];
  durationMinutes: number;
  stepMinutes?: number;
  notBefore?: number;
}): string[] {
  const { intervals, busy, durationMinutes, stepMinutes = 15, notBefore = 0 } = input;
  const slots: string[] = [];
  for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
    const first = Math.ceil(Math.max(interval.start, notBefore) / stepMinutes) * stepMinutes;
    for (let t = first; t + durationMinutes <= interval.end; t += stepMinutes) {
      const end = t + durationMinutes;
      if (!busy.some((b) => t < b.end && end > b.start)) slots.push(minutesToTime(t));
    }
  }
  return slots;
}
