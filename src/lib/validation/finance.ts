import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/cash/methods";
import { BILL_CATEGORIES } from "@/lib/finance/bills";
import { parseBRLToCents } from "@/lib/money";

export const billSchema = z
  .object({
    category: z.enum(BILL_CATEGORIES, { error: "Escolha a categoria" }),
    description: z
      .string()
      .trim()
      .min(2, "Informe a descrição")
      .max(200, "Use no máximo 200 caracteres"),
    amount: z.string().transform((v, ctx) => {
      const cents = parseBRLToCents(v);
      if (cents === null || cents <= 0) {
        ctx.addIssue({ code: "custom", message: "Valor inválido" });
        return z.NEVER;
      }
      return cents;
    }),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o vencimento"),
    paidMethod: z.union([z.literal("").transform(() => null), z.enum(PAYMENT_METHODS)], { error: "Forma de pagamento inválida" }),
  })
  .transform(({ amount, ...rest }) => ({ ...rest, amountCents: amount }));
