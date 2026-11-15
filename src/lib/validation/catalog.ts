import { z } from "zod";
import { digitsOnly, parseBRLToCents } from "@/lib/format";

const name = (msg: string) => z.string().trim().min(2, { error: msg });

export const serviceSchema = z.object({
  name: name("Informe o nome do serviço"),
  durationMinutes: z.coerce
    .number({ error: "Informe a duração em minutos" })
    .int({ error: "Informe a duração em minutos" })
    .min(5, { error: "A duração mínima é 5 minutos" })
    .max(600, { error: "A duração máxima é 600 minutos" }),
  price: z
    .string()
    .transform((v, ctx) => {
      const cents = parseBRLToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Informe um preço válido (ex.: 45,00)" });
        return z.NEVER;
      }
      return cents;
    }),
});

const percent = z
  .string()
  .transform((v, ctx) => {
    const n = Number(v.replace(",", "."));
    if (v.trim() === "" || Number.isNaN(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Informe um percentual entre 0 e 100" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

export const professionalSchema = z.object({
  name: name("Informe o nome do profissional"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { error: "Escolha uma cor válida" }),
  commissionPercent: percent,
});

export const commissionOverrideSchema = z.object({
  serviceId: z.string().uuid({ error: "Escolha um serviço" }),
  percent,
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Informe um horário válido (HH:MM)" });

export const scheduleSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], error: "O fim deve ser depois do início" });

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Informe data e hora" });

export const blockSchema = z
  .object({
    startsAt: localDateTime,
    endsAt: localDateTime,
    reason: z.string().trim().max(120, { error: "Máximo de 120 caracteres" }).default(""),
  })
  .refine((v) => v.endsAt > v.startsAt, { path: ["endsAt"], error: "O fim deve ser depois do início" });

export const customerSchema = z.object({
  name: name("Informe o nome do cliente"),
  phone: z
    .string()
    .transform((v) => digitsOnly(v))
    .refine((d) => d === "" || (d.length >= 10 && d.length <= 13), { error: "Telefone inválido (use DDD + número)" }),
  notes: z.string().trim().max(500, { error: "Máximo de 500 caracteres" }).default(""),
});
