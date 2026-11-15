"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { parseForm } from "@/lib/actions/parse";
import { rpcFailure } from "@/lib/actions/rpc";
import { parseBRLToCents } from "@/lib/format";
import { METHODS, parsePayments } from "@/lib/payments";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const refresh = (id?: string) => {
  revalidatePath("/agenda");
  revalidatePath("/fila");
  revalidatePath("/caixa");
  revalidatePath("/financeiro");
  if (id) revalidatePath(`/atendimento/${id}`);
};

export async function completeAppointment(id: string): Promise<ActionResult> {
  await requireRole(["admin", "reception", "professional"]);
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("complete_appointment", { p_appointment_id: id });
  if (error) return rpcFailure(error);
  refresh(id);
  return { ok: true };
}

export async function addAppointmentItem(id: string, serviceId: string): Promise<ActionResult> {
  await requireRole(["admin", "reception", "professional"]);
  if (!serviceId) return { ok: false, error: "Escolha um serviço" };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("add_appointment_item", { p_appointment_id: id, p_service_id: serviceId });
  if (error) return rpcFailure(error);
  refresh(id);
  return { ok: true };
}

export async function addProductItem(id: string, inventoryItemId: string, quantity: number): Promise<ActionResult> {
  await requireRole(["admin", "reception", "professional"]);
  if (!inventoryItemId) return { ok: false, error: "Escolha um produto" };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("add_product_item", { p_appointment_id: id, p_inventory_item_id: inventoryItemId, p_quantity: quantity });
  if (error) return rpcFailure(error);
  refresh(id);
  return { ok: true };
}

export async function removeAppointmentItem(id: string, itemId: string): Promise<ActionResult> {
  await requireRole(["admin", "reception", "professional"]);
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("remove_appointment_item", { p_item_id: itemId });
  if (error) return rpcFailure(error);
  refresh(id);
  return { ok: true };
}

export async function receivePayment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(["admin", "reception"]);
  const id = String(formData.get("id") ?? "");
  const discountRaw = String(formData.get("discount") ?? "").trim();
  const discount = discountRaw === "" ? 0 : parseBRLToCents(discountRaw);
  if (discount === null) return { ok: false, error: "Confira os campos", fieldErrors: { discount: "Informe um desconto válido (ex.: 5,00)" } };

  const values = Object.fromEntries(METHODS.map((m) => [m, String(formData.get(`pay_${m}`) ?? "")]));
  const parsed = parsePayments(values);
  if (!parsed.ok) return { ok: false, error: "Confira os campos", fieldErrors: { [`pay_${parsed.field}`]: parsed.error } };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("receive_payment", { p_appointment_id: id, p_payments: parsed.payments, p_discount_cents: discount });
  if (error) return rpcFailure(error);
  refresh(id);
  return { ok: true };
}

export async function confirmPix(transactionId: string, appointmentId?: string): Promise<ActionResult> {
  await requireRole(["admin", "reception"]);
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("confirm_pix", { p_transaction_id: transactionId });
  if (error) return rpcFailure(error);
  refresh(appointmentId);
  return { ok: true };
}

const reverseSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().min(3, { error: "Informe o motivo do estorno" }).max(200) });

export async function reverseAppointment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = parseForm(reverseSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("reverse_appointment", { p_appointment_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return rpcFailure(error);
  refresh(parsed.data.id);
  return { ok: true };
}
