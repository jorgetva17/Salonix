"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { rpcError } from "@/lib/agenda/rpc-errors";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/methods";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

const input = z.object({
  professionalId: z.uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  expenseMethod: z.enum(PAYMENT_METHODS).nullable(),
});

export async function payCommissions(
  professionalId: string,
  month: string,
  expenseMethod: PaymentMethod | null,
): Promise<ActionResult<{ paidCents: number }>> {
  const { salon } = await requireRole(["admin"]);
  const parsed = input.safeParse({ professionalId, month, expenseMethod });
  if (!parsed.success) return { ok: false, error: "Não foi possível pagar as comissões." };
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("pay_commissions", {
    p_salon_id: salon.id,
    p_professional_id: parsed.data.professionalId,
    p_month: `${parsed.data.month}-01`,
    p_expense_method: parsed.data.expenseMethod ?? undefined,
  });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível pagar as comissões.") };
  revalidatePath("/financeiro");
  revalidatePath("/caixa");
  return { ok: true, data: { paidCents: data } };
}
