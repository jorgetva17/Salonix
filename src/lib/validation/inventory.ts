import { z } from "zod";
import { parseQuantity } from "@/lib/inventory/quantity";
import { parseBRLToCents } from "@/lib/money";

const quantityError = "Quantidade inválida";
const priceError = "Informe um valor válido, ex.: 12,00";

const quantity = z.string({ error: quantityError }).transform((v, ctx) => {
  const q = parseQuantity(v);
  if (q === null) {
    ctx.addIssue({ code: "custom", message: quantityError });
    return z.NEVER;
  }
  return q;
});

/** Valor em reais opcional: vazio → null. */
const optionalCents = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v?.trim()) return null;
    const cents = parseBRLToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: priceError });
      return z.NEVER;
    }
    return cents;
  });

export const inventoryItemSchema = z
  .object({
    id: z.uuid().optional(),
    name: z
      .string()
      .trim()
      .min(2, { error: "Informe o nome do item" })
      .max(80, { error: "O nome deve ter no máximo 80 caracteres" }),
    unit: z.enum(["un", "ml", "g"], { error: "Escolha a unidade" }),
    minQuantity: quantity,
    unitCost: optionalCents,
    salePrice: optionalCents,
  })
  .transform(({ unitCost, salePrice, ...rest }) => ({
    ...rest,
    unitCostCents: unitCost ?? 0,
    salePriceCents: salePrice,
  }));

export const MOVEMENT_TYPES = ["in", "out", "adjust"] as const;

export const movementSchema = z
  .object({
    itemId: z.uuid(),
    type: z.enum(MOVEMENT_TYPES, { error: "Escolha o tipo de movimento" }),
    quantity,
    unitCost: optionalCents,
    reason: z
      .string()
      .trim()
      .max(200, { error: "O motivo deve ter no máximo 200 caracteres" })
      .optional()
      .transform((v) => v || null),
  })
  // Entrada e saída precisam de quantidade; o ajuste é a contagem (pode ser 0).
  .refine((m) => m.type === "adjust" || m.quantity > 0, { error: quantityError, path: ["quantity"] })
  .transform(({ unitCost, ...rest }) => ({ ...rest, unitCostCents: unitCost }));
