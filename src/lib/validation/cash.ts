import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/cash/methods";
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

const paymentLines = z
  .string()
  .transform((v, ctx) => {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Informe o pagamento" });
      return z.NEVER;
    }
  })
  .pipe(
    z.array(
      z
        .object({ method: z.enum(PAYMENT_METHODS, { error: "Forma de pagamento inválida" }), amount: reais("Valor inválido", null) })
        .transform(({ method, amount }) => ({ method, amountCents: amount })),
    ),
  );

export const paymentSchema = z
  .object({
    appointmentId: z.uuid(),
    discount: reais("Valor inválido", 0),
    payments: paymentLines,
  })
  .transform(({ discount, ...rest }) => ({ ...rest, discountCents: discount }));

export const closeCashSchema = z.object({
  cash: reais("Valor inválido", 0),
  debit: reais("Valor inválido", 0),
  credit: reais("Valor inválido", 0),
  pix: reais("Valor inválido", 0),
});
