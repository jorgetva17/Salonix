import { z } from "zod";
import { parseBRLToCents } from "@/lib/money";

const priceError = "Informe um preço válido, ex.: 45,00";

export const serviceSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome do serviço" })
    .max(80, { error: "O nome deve ter no máximo 80 caracteres" }),
  durationMinutes: z.coerce
    .number({ error: "Informe a duração" })
    .int({ error: "Use múltiplos de 5 minutos" })
    .min(5, { error: "Entre 5 e 480 minutos" })
    .max(480, { error: "Entre 5 e 480 minutos" })
    .refine((v) => v % 5 === 0, { error: "Use múltiplos de 5 minutos" }),
  price: z
    .string({ error: priceError })
    .transform((v, ctx) => {
      const cents = parseBRLToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: priceError });
        return z.NEVER;
      }
      return cents;
    }),
}).transform(({ price, ...rest }) => ({ ...rest, priceCents: price }));

export type ServiceInput = z.output<typeof serviceSchema>;

/** "30 min", "1h", "1h30". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
