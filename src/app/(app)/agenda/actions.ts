"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { rpcError } from "@/lib/agenda/rpc-errors";
import { availableSlots } from "@/lib/agenda/slots";
import { todayIn, toLocalMinutes } from "@/lib/agenda/time";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { appointmentSchema, walkInSchema } from "@/lib/validation/appointments";
import { firstErrors } from "@/lib/validation/auth";
import { loadProfessionalDay } from "./data";

const uuid = z.uuid();
const date = z.iso.date();

export async function getFreeSlots(
  professionalId: string,
  day: string,
  durationMinutes: number,
  ignoreAppointmentId?: string,
): Promise<string[]> {
  const { salon } = await requireRole(["admin", "reception"]);
  const input = z
    .object({ professionalId: uuid, day: date, durationMinutes: z.number().int().min(5).max(600) })
    .safeParse({ professionalId, day, durationMinutes });
  if (!input.success) return [];

  const supabase = await createServerClient();
  const { intervals, busy } = await loadProfessionalDay(supabase, {
    professionalId: input.data.professionalId,
    date: input.data.day,
    timeZone: salon.timezone,
    ignoreAppointmentId: ignoreAppointmentId && uuid.safeParse(ignoreAppointmentId).success ? ignoreAppointmentId : undefined,
  });
  const today = todayIn(salon.timezone);
  if (input.data.day < today) return [];
  const notBefore = input.data.day === today ? toLocalMinutes(new Date().toISOString(), today, salon.timezone) : 0;
  return availableSlots({ intervals, busy, durationMinutes: input.data.durationMinutes, notBefore });
}

export async function createAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin", "reception"]);
  const parsed = appointmentSchema.safeParse({
    customerId: formData.get("customerId"),
    professionalId: formData.get("professionalId"),
    serviceIds: formData.getAll("serviceIds"),
    date: formData.get("date"),
    time: formData.get("time"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  }
  const { customerId, professionalId, serviceIds, date: day, time, notes } = parsed.data;

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("create_appointment", {
    p_salon_id: salon.id,
    p_customer_id: customerId,
    p_professional_id: professionalId,
    p_service_ids: serviceIds,
    p_starts_local: `${day} ${time}`,
    p_notes: notes,
  });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível agendar.") };
  revalidatePath("/agenda");
  return { ok: true, message: `Agendado para ${day.split("-").reverse().join("/")} às ${time}.` };
}

export type AppointmentDetails = {
  notes: string | null;
  events: { event: string; at: string; actorName: string | null; reason: string | null }[];
};

export async function getAppointmentDetails(id: string): Promise<AppointmentDetails | null> {
  await requireRole();
  if (!uuid.safeParse(id).success) return null;
  const supabase = await createServerClient();
  const [{ data: appointment }, { data: events }] = await Promise.all([
    supabase.from("appointments").select("notes").eq("id", id).maybeSingle(),
    supabase.from("appointment_events").select("event, actor, data, created_at").eq("appointment_id", id).order("created_at"),
  ]);
  if (!appointment) return null;
  const actorIds = [...new Set((events ?? []).map((e) => e.actor).filter((a): a is string => Boolean(a)))];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return {
    notes: appointment.notes,
    events: (events ?? []).map((e) => ({
      event: e.event,
      at: e.created_at,
      actorName: (e.actor && names.get(e.actor)) || null,
      reason: (e.data as { reason?: string } | null)?.reason ?? null,
    })),
  };
}

async function runTransition(
  rpc: "cancel_appointment" | "mark_no_show" | "start_appointment" | "complete_appointment",
  id: string,
  fallback: string,
  extra: Record<string, string> = {},
): Promise<ActionResult> {
  await requireRole();
  if (!uuid.safeParse(id).success) return { ok: false, error: fallback };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc(rpc, { p_appointment_id: id, ...extra });
  if (error) return { ok: false, error: rpcError(error.message, fallback) };
  revalidatePath("/agenda");
  revalidatePath("/agenda/fila");
  return { ok: true };
}

export async function cancelAppointment(id: string, reason: string): Promise<ActionResult> {
  return runTransition("cancel_appointment", id, "Não foi possível cancelar.", { p_reason: reason.trim().slice(0, 200) });
}

export async function markNoShow(id: string): Promise<ActionResult> {
  return runTransition("mark_no_show", id, "Não foi possível marcar a falta.");
}

export async function startAppointment(id: string): Promise<ActionResult> {
  return runTransition("start_appointment", id, "Não foi possível iniciar o atendimento.");
}

export async function completeAppointment(id: string): Promise<ActionResult> {
  return runTransition("complete_appointment", id, "Não foi possível concluir o atendimento.");
}

export async function rescheduleAppointment(
  id: string,
  professionalId: string,
  day: string,
  time: string,
): Promise<ActionResult> {
  await requireRole(["admin", "reception"]);
  const input = z
    .object({ id: uuid, professionalId: uuid, day: date, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })
    .safeParse({ id, professionalId, day, time });
  if (!input.success) return { ok: false, error: "Escolha um horário." };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: input.data.id,
    p_professional_id: input.data.professionalId,
    p_starts_local: `${input.data.day} ${input.data.time}`,
  });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível reagendar.") };
  revalidatePath("/agenda");
  return { ok: true };
}

export async function enqueueWalkIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin", "reception"]);
  const parsed = walkInSchema.safeParse({
    customerId: formData.get("customerId"),
    serviceIds: formData.getAll("serviceIds"),
    professionalId: formData.get("professionalId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  }
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("enqueue_walk_in", {
    p_salon_id: salon.id,
    p_customer_id: parsed.data.customerId,
    p_service_ids: parsed.data.serviceIds,
    p_professional_id: parsed.data.professionalId ?? undefined,
  });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível colocar na fila.") };
  revalidatePath("/agenda/fila");
  return { ok: true, message: "Cliente na fila." };
}

export async function callNextWalkIn(professionalId: string): Promise<ActionResult<{ customerName: string }>> {
  const { salon } = await requireRole();
  if (!uuid.safeParse(professionalId).success) return { ok: false, error: "Profissional inválido." };
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("call_next_walk_in", { p_salon_id: salon.id, p_professional_id: professionalId });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível chamar o próximo.") };
  const { data: customer } = await supabase.from("customers").select("name").eq("id", data.customer_id).maybeSingle();
  revalidatePath("/agenda/fila");
  return { ok: true, data: { customerName: customer?.name ?? "" } };
}
