"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { rpcError } from "@/lib/agenda/rpc-errors";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/methods";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { billSchema } from "@/lib/validation/finance";

const uuid = z.uuid();

function revalidate() {
  revalidatePath("/financeiro/contas");
  revalidatePath("/caixa");
}

export async function saveBill(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin"]);
  const parsed = billSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  const { category, description, amountCents, dueDate, paidMethod } = parsed.data;
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("create_bill", {
    p_salon_id: salon.id,
    p_category: category,
    p_description: description,
    p_amount_cents: amountCents,
    p_due_date: dueDate,
    p_paid_method: paidMethod ?? undefined,
  });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível salvar a conta.") };
  revalidate();
  return { ok: true, message: paidMethod ? "Conta lançada como paga." : "Conta lançada." };
}

export async function payBill(id: string, method: PaymentMethod): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = z.object({ id: uuid, method: z.enum(PAYMENT_METHODS) }).safeParse({ id, method });
  if (!parsed.success) return { ok: false, error: "Não foi possível pagar a conta." };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("pay_bill", { p_transaction_id: parsed.data.id, p_method: parsed.data.method });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível pagar a conta.") };
  revalidate();
  return { ok: true };
}

export async function cancelBill(id: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Não foi possível cancelar a conta." };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("cancel_bill", { p_transaction_id: parsed.data });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível cancelar a conta.") };
  revalidate();
  return { ok: true };
}
