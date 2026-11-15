"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { parseForm } from "@/lib/actions/parse";
import { rpcFailure } from "@/lib/actions/rpc";
import { parseBRLToCents } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/reports";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

const METHODS = ["cash", "debit", "credit", "pix"] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const expenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES, { error: "Escolha a categoria" }),
    description: z.string().trim().min(2, { error: "Informe a descrição" }).max(120),
    amount: z.string().transform((v, ctx) => {
      const c = parseBRLToCents(v);
      if (c === null || c <= 0) {
        ctx.addIssue({ code: "custom", message: "Informe um valor maior que zero (ex.: 200,00)" });
        return z.NEVER;
      }
      return c;
    }),
    dueDate: date.optional().or(z.literal("").transform(() => undefined)),
    paid: z.string().optional(),
    method: z.enum(METHODS).optional().or(z.literal("").transform(() => undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.paid === "on" && !v.method) ctx.addIssue({ code: "custom", path: ["method"], message: "Informe a forma de pagamento" });
    if (v.paid !== "on" && !v.dueDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Informe o vencimento" });
  });

const refresh = () => {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/contas");
  revalidatePath("/painel");
};

export async function createExpense(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = parseForm(expenseSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("create_expense", {
    p_salon_id: membership.salonId,
    p_category: parsed.data.category,
    p_description: parsed.data.description,
    p_amount_cents: parsed.data.amount,
    p_due_date: parsed.data.dueDate ?? null,
    p_paid: parsed.data.paid === "on",
    p_method: parsed.data.paid === "on" ? (parsed.data.method ?? null) : null,
  });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}

export async function payExpense(id: string, method: (typeof METHODS)[number]): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (!METHODS.includes(method)) return { ok: false, error: "Forma de pagamento inválida" };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("pay_expense", { p_transaction_id: id, p_method: method });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("delete_expense", { p_transaction_id: id });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}
