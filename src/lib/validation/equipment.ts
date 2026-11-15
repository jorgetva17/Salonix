import { z } from "zod";
import { EQUIPMENT_STATUSES } from "@/lib/equipment/status";
import { parseBRLToCents } from "@/lib/money";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const costError = "Informe um valor válido, ex.: 80,00";

export const equipmentSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome do equipamento" })
    .max(80, { error: "O nome deve ter no máximo 80 caracteres" }),
  status: z.enum(EQUIPMENT_STATUSES, { error: "Escolha o status" }),
  professionalId: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  notes: z
    .string()
    .trim()
    .max(300, { error: "No máximo 300 caracteres" })
    .optional()
    .transform((v) => v || null),
});

export const maintenanceSchema = z
  .object({
    equipmentId: z.uuid(),
    performedOn: z.string().regex(DATE, { error: "Informe a data" }),
    description: z
      .string()
      .trim()
      .min(2, { error: "Descreva a manutenção" })
      .max(300, { error: "No máximo 300 caracteres" }),
    cost: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v?.trim()) return 0;
        const cents = parseBRLToCents(v);
        if (cents === null) {
          ctx.addIssue({ code: "custom", message: costError });
          return z.NEVER;
        }
        return cents;
      }),
    nextDue: z
      .string()
      .optional()
      .transform((v) => v || null)
      .pipe(z.string().regex(DATE, { error: "Data inválida" }).nullable()),
  })
  .refine((m) => !m.nextDue || m.nextDue >= m.performedOn, {
    error: "A próxima manutenção deve ser depois desta",
    path: ["nextDue"],
  })
  .transform(({ cost, ...rest }) => ({ ...rest, costCents: cost }));
