"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { rpcFailure } from "@/lib/actions/rpc";
import { parseBRLToCents } from "@/lib/format";
import { METHODS } from "@/lib/payments";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export async function openCashSession(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin", "reception"]);
  const raw = String(formData.get("opening") ?? "").trim();
  const cents = raw === "" ? 0 : parseBRLToCents(raw);
  if (cents === null) return { ok: false, error: "Confira os campos", fieldErrors: { opening: "Informe um valor válido (ex.: 100,00)" } };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("open_cash_session", { p_salon_id: membership.salonId, p_opening_cents: cents });
  if (error) return rpcFailure(error);
  revalidatePath("/caixa");
  return { ok: true };
}

export async function closeCashSession(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(["admin", "reception"]);
  const sessionId = String(formData.get("sessionId") ?? "");
  const counted: Record<string, number> = {};
  const fieldErrors: Record<string, string> = {};
  for (const m of METHODS) {
    const raw = String(formData.get(`count_${m}`) ?? "").trim();
    const cents = raw === "" ? 0 : parseBRLToCents(raw);
    if (cents === null) fieldErrors[`count_${m}`] = "Informe um valor válido (ex.: 100,00)";
    else counted[m] = cents;
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "Confira os campos", fieldErrors };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("close_cash_session", { p_session_id: sessionId, p_counted: counted });
  if (error) return rpcFailure(error);
  revalidatePath("/caixa");
  return { ok: true };
}
