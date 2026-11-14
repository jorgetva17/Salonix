import { z } from "zod";
import { parseBRLToCents } from "@/lib/money";

/** Valor em reais digitado; vazio vira `emptyAs` (ou erro, se `emptyAs` for nulo). */
function reais(invalid: string, emptyAs: number | null) {
  return z.string({ error: invalid }).transform((v, ctx) => {
    if (v.trim() === "" && emptyAs !== null) return emptyAs;
    const cents = parseBRLToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: invalid });
      return z.NEVER;
    }
    return cents;
  });
}

export const openCashSchema = z
  .object({ opening: reais("Informe o valor inicial", null) })
  .transform(({ opening }) => ({ openingCents: opening }));

export const closeCashSchema = z.object({
  cash: reais("Valor inválido", 0),
  debit: reais("Valor inválido", 0),
  credit: reais("Valor inválido", 0),
  pix: reais("Valor inválido", 0),
});
