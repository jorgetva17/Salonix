"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { failed, parseForm } from "@/lib/actions/parse";
import { rpcFailure } from "@/lib/actions/rpc";
import { zonedLocalToIso } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { appointmentSchema, rescheduleSchema, serviceIdsSchema, walkInSchema } from "@/lib/validation/agenda";

const refresh = () => {
  revalidatePath("/agenda");
  revalidatePath("/fila");
};

type Parsed = { ok: true } | { ok: false; result: ActionResult };
type Services = { success: true } | { success: false; error: { issues: { message: string }[] } };

/** Junta os erros de campo do formulário com o de serviços (checkboxes). */
function invalid(parsed: Parsed, services: Services): ActionResult {
  const fieldErrors: Record<string, string> = {};
  if (!parsed.ok && !parsed.result.ok && parsed.result.fieldErrors) Object.assign(fieldErrors, parsed.result.fieldErrors);
  if (!services.success) fieldErrors.serviceIds = services.error.issues[0].message;
  return { ok: false, error: "Confira os campos", fieldErrors };
}

function readServiceIds(formData: FormData) {
  return serviceIdsSchema.safeParse(formData.getAll("serviceIds").map(String));
}

export async function createAppointment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership, salon } = await requireRole(["admin", "reception"]);
  const parsed = parseForm(appointmentSchema, formData);
  const services = readServiceIds(formData);
  if (!parsed.ok || !services.success) return invalid(parsed, services);

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("create_appointment", {
    p_salon_id: membership.salonId,
    p_customer_id: parsed.data.customerId ?? null,
    p_guest_name: parsed.data.guestName || null,
    p_professional_id: parsed.data.professionalId,
    p_starts_at: zonedLocalToIso(parsed.data.startsAt, salon.timezone),
    p_service_ids: services.data,
    p_notes: parsed.data.notes,
  });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}

export async function rescheduleAppointment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { salon } = await requireRole(["admin", "reception"]);
  const parsed = parseForm(rescheduleSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: parsed.data.id,
    p_starts_at: zonedLocalToIso(parsed.data.startsAt, salon.timezone),
    p_professional_id: parsed.data.professionalId ?? null,
  });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}

export async function cancelAppointment(id: string, reason = ""): Promise<ActionResult> {
  await requireRole(["admin", "reception"]);
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("cancel_appointment", { p_appointment_id: id, p_reason: reason });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}

export async function markNoShow(id: string): Promise<ActionResult> {
  await requireRole(["admin", "reception"]);
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("mark_no_show", { p_appointment_id: id });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}

export async function startAppointment(id: string): Promise<ActionResult> {
  await requireRole(["admin", "reception", "professional"]);
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("start_appointment", { p_appointment_id: id });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}

export async function enqueueWalkIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin", "reception"]);
  const parsed = parseForm(walkInSchema, formData);
  const services = readServiceIds(formData);
  if (!parsed.ok || !services.success) return invalid(parsed, services);

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("enqueue_walk_in", {
    p_salon_id: membership.salonId,
    p_customer_id: parsed.data.customerId ?? null,
    p_guest_name: parsed.data.guestName || null,
    p_professional_id: parsed.data.professionalId ?? null,
    p_service_ids: services.data,
  });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}

export async function callNext(professionalId: string): Promise<ActionResult> {
  const { membership } = await requireRole(["admin", "reception", "professional"]);
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("call_next", { p_salon_id: membership.salonId, p_professional_id: professionalId });
  if (error) return rpcFailure(error);
  if (!data || !data.id) return failed("Não há ninguém na fila para este profissional");
  refresh();
  return { ok: true };
}
