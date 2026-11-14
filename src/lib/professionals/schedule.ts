import { z } from "zod";
import { formatDateTime } from "@/lib/format";

/** weekday 0 = domingo, igual a Date.getDay() e extract(dow). */
export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

export type ScheduleSlot = { weekday: number; startsAt: string; endsAt: string };

export const BLOCK_KINDS = ["day_off", "vacation", "break", "other"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  day_off: "Folga",
  vacation: "Férias",
  break: "Intervalo",
  other: "Outro",
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Horário inválido" });
const date = z.iso.date({ error: "Data inválida" });

/** Weekday do primeiro par de intervalos que se sobrepõem, ou null. "HH:MM" compara como texto. */
export function findScheduleOverlap(slots: ScheduleSlot[]): number | null {
  const sorted = [...slots].sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.weekday === cur.weekday && cur.startsAt < prev.endsAt) return cur.weekday;
  }
  return null;
}

export const scheduleSchema = z
  .array(
    z
      .object({ weekday: z.number().int().min(0).max(6), startsAt: time, endsAt: time })
      .refine((s) => s.endsAt > s.startsAt, { error: "O fim deve ser depois do início", path: ["endsAt"] }),
  )
  .max(28)
  .superRefine((slots, ctx) => {
    const weekday = findScheduleOverlap(slots);
    if (weekday !== null) {
      ctx.addIssue({ code: "custom", message: `Horários se sobrepõem em ${WEEKDAY_LABELS[weekday]}`, path: [weekday] });
    }
  });

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Bloqueio digitado no horário do salão. Sai como "YYYY-MM-DD HH:MM" sem fuso;
 * a RPC create_schedule_block converte com o fuso do salão.
 */
export const blockSchema = z
  .object({
    kind: z.enum(BLOCK_KINDS, { error: "Escolha o tipo" }),
    startDate: date,
    endDate: date,
    allDay: z.string().optional(),
    startTime: time.optional().or(z.literal("")),
    endTime: time.optional().or(z.literal("")),
    note: z.string().trim().max(200, { error: "Até 200 caracteres" }).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", message: "A data final deve ser igual ou depois da inicial", path: ["endDate"] });
      return;
    }
    if (!v.allDay) {
      if (!v.startTime) ctx.addIssue({ code: "custom", message: "Informe o horário", path: ["startTime"] });
      if (!v.endTime) ctx.addIssue({ code: "custom", message: "Informe o horário", path: ["endTime"] });
      if (v.startTime && v.endTime && `${v.endDate} ${v.endTime}` <= `${v.startDate} ${v.startTime}`) {
        ctx.addIssue({ code: "custom", message: "O fim deve ser depois do início", path: ["endTime"] });
      }
    }
  })
  .transform((v) => ({
    kind: v.kind,
    note: v.note || null,
    startsLocal: v.allDay ? `${v.startDate} 00:00` : `${v.startDate} ${v.startTime}`,
    endsLocal: v.allDay ? `${nextDay(v.endDate)} 00:00` : `${v.endDate} ${v.endTime}`,
  }));

/** Período do bloqueio no fuso do salão; dias inteiros (00:00 a 00:00) mostram só as datas. */
export function formatBlockPeriod(startsAt: string, endsAt: string, timeZone: string): string {
  const [startDate, startTime] = formatDateTime(startsAt, timeZone).split(" ");
  const [endDate, endTime] = formatDateTime(endsAt, timeZone).split(" ");
  if (startTime === "00:00" && endTime === "00:00") {
    // O fim é a meia-noite seguinte ao último dia bloqueado.
    const lastDay = formatDateTime(new Date(new Date(endsAt).getTime() - 60_000).toISOString(), timeZone).split(" ")[0];
    return lastDay === startDate ? `${startDate} (dia inteiro)` : `${startDate} a ${lastDay}`;
  }
  if (startDate === endDate) return `${startDate} ${startTime}–${endTime}`;
  return `${startDate} ${startTime} a ${endDate} ${endTime}`;
}
