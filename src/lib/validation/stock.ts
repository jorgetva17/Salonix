import { z } from "zod";
import { parseBRLToCents } from "@/lib/format";
import { parseQuantity } from "@/lib/stock";

const qty = (msg: string, { allowZero = false } = {}) =>
  z.string().transform((v, ctx) => {
    const n = parseQuantity(v);
    if (n === null || (!allowZero && n === 0)) {
      ctx.addIssue({ code: "custom", message: msg });
      return z.NEVER;
    }
    return n;
  });

const optionalCents = (msg: string) =>
  z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const c = parseBRLToCents(v);
    if (c === null) {
      ctx.addIssue({ code: "custom", message: msg });
      return z.NEVER;
    }
    return c;
  });

const optionalUuid = z.string().uuid().optional().or(z.literal("").transform(() => undefined));
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined));

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(2, { error: "Informe o nome do item" }),
  unit: z.string().trim().min(1, { error: "Informe a unidade (un, ml, g…)" }).max(12, { error: "Máximo de 12 caracteres" }),
  minQuantity: qty("Informe uma quantidade mínima válida", { allowZero: true }),
  salePrice: optionalCents("Informe um preço de venda válido (ex.: 35,00)"),
});

export const movementSchema = z.object({
  itemId: z.string().uuid(),
  type: z.enum(["in", "out", "adjust"], { error: "Escolha o tipo" }),
  quantity: qty("Informe uma quantidade válida", { allowZero: true }),
  reason: z.string().trim().max(120, { error: "Máximo de 120 caracteres" }).default(""),
  unitCost: optionalCents("Informe um custo válido (ex.: 12,00)"),
});

export const consumableSchema = z.object({
  serviceId: z.string().uuid({ error: "Escolha o serviço" }),
  itemId: z.string().uuid({ error: "Escolha o material" }),
  quantity: qty("Informe a quantidade consumida por atendimento"),
});

export const equipmentSchema = z.object({
  name: z.string().trim().min(2, { error: "Informe o nome do equipamento" }),
  responsibleId: optionalUuid,
  notes: z.string().trim().max(300, { error: "Máximo de 300 caracteres" }).default(""),
});

export const maintenanceSchema = z
  .object({
    equipmentId: z.string().uuid(),
    performedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Informe a data" }),
    description: z.string().trim().min(2, { error: "Descreva a manutenção" }).max(200),
    nextDueOn: optionalDate,
    cost: optionalCents("Informe um custo válido (ex.: 80,00)"),
  })
  .refine((v) => !v.nextDueOn || v.nextDueOn >= v.performedOn, { path: ["nextDueOn"], error: "A próxima manutenção deve ser depois da realizada" });

export const counterSaleSchema = z.object({
  inventoryItemId: z.string().uuid({ error: "Escolha o produto" }),
  quantity: z.coerce.number().int({ error: "Quantidade inválida" }).min(1, { error: "Mínimo 1" }).max(999),
  customerId: optionalUuid,
  guestName: z.string().trim().max(80).optional(),
});
