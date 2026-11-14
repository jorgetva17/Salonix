"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/action-result";
import { rpcError } from "@/lib/agenda/rpc-errors";
import { formatBRL } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { closeCashSchema, openCashSchema } from "@/lib/validation/cash";

export async function openCashSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin", "reception"]);
  const parsed = openCashSchema.safeParse({ opening: formData.get("opening") ?? "" });
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("open_cash_session", { p_salon_id: salon.id, p_opening_cents: parsed.data.openingCents });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível abrir o caixa.") };
  revalidatePath("/caixa");
  return { ok: true, message: "Caixa aberto." };
}

export async function closeCashSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin", "reception"]);
  const parsed = closeCashSchema.safeParse({
    cash: formData.get("cash") ?? "",
    debit: formData.get("debit") ?? "",
    credit: formData.get("credit") ?? "",
    pix: formData.get("pix") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  const supabase = await createServerClient();
  // A sessão vem do salão ativo, nunca de um id enviado pelo navegador.
  const { data: session } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("salon_id", salon.id)
    .is("closed_at", null)
    .maybeSingle();
  if (!session) return { ok: false, error: "Caixa já fechado." };
  const { data, error } = await supabase.rpc("close_cash_session", { p_session_id: session.id, p_counted: parsed.data });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível fechar o caixa.") };
  revalidatePath("/caixa");
  return { ok: true, message: `Caixa fechado. Diferença: ${formatBRL(data.difference_cents ?? 0)}.` };
}
