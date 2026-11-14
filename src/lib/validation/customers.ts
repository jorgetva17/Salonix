import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const phoneError = "Informe DDD + número";

export const customerSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome" })
    .max(120, { error: "O nome deve ter no máximo 120 caracteres" }),
  phone: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const digits = normalizePhone(v);
      if (!digits) {
        ctx.addIssue({ code: "custom", message: phoneError });
        return z.NEVER;
      }
      return digits;
    }),
  notes: z
    .string()
    .trim()
    .max(500, { error: "Até 500 caracteres" })
    .optional()
    .transform((v) => v || null),
});
