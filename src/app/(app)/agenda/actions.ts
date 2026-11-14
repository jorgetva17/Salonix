"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/action-result";
import { rpcError } from "@/lib/agenda/rpc-errors";
import { availableSlots } from "@/lib/agenda/slots";
import { todayIn, toLocalMinutes } from "@/lib/agenda/time";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { appointmentSchema } from "@/lib/validation/appointments";
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
