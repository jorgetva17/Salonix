import { z } from "zod";

/** Cores da agenda; todas com contraste para texto branco. */
export const PROFESSIONAL_COLORS = [
  "#1B3B4B",
  "#B45309",
  "#047857",
  "#1D4ED8",
  "#7C3AED",
  "#BE185D",
  "#B91C1C",
  "#475569",
] as const;

const percentError = "Entre 0 e 100%";

/** "40", "37,5", "37.5" → number; null se inválido ou fora de 0–100. */
export function parsePercent(input: string): number | null {
  const value = input.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
  const n = Number(value);
  return n <= 100 ? n : null;
}

export const percentField = z.string({ error: percentError }).transform((v, ctx) => {
  const n = parsePercent(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: percentError });
    return z.NEVER;
  }
  return n;
});

export const professionalSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome" })
    .max(80, { error: "O nome deve ter no máximo 80 caracteres" }),
  color: z.enum(PROFESSIONAL_COLORS, { error: "Escolha uma cor" }),
  commissionPercent: percentField,
});
