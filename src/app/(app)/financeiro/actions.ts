"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { rpcFailure } from "@/lib/actions/rpc";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export async function payCommissions(professionalId: string, month: string, createExpense: boolean): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Mês inválido" };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("pay_commissions", {
    p_salon_id: membership.salonId,
    p_professional_id: professionalId,
    p_month: `${month}-01`,
    p_create_expense: createExpense,
  });
  if (error) return rpcFailure(error);
  revalidatePath("/financeiro");
  return { ok: true };
}
