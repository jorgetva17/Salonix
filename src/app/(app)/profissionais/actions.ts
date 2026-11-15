"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { failed, parseForm } from "@/lib/actions/parse";
import { zonedLocalToIso } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import {
  blockSchema,
  commissionOverrideSchema,
  professionalSchema,
  scheduleSchema,
} from "@/lib/validation/catalog";

const refresh = (id?: string) => {
  revalidatePath("/profissionais");
  if (id) revalidatePath(`/profissionais/${id}`);
};

export async function saveProfessional(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = parseForm(professionalSchema, formData);
  if (!parsed.ok) return parsed.result;
  const id = String(formData.get("id") ?? "");

  const supabase = await createServerClient();
  const values = { name: parsed.data.name, color: parsed.data.color };
  let professionalId = id;
  if (id) {
    const { error } = await supabase.from("professionals").update(values).eq("id", id);
    if (error) return failed("Não foi possível salvar o profissional. Tente novamente");
  } else {
    const { data, error } = await supabase
      .from("professionals")
      .insert({ ...values, salon_id: membership.salonId })
      .select("id")
      .single();
    if (error || !data) return failed("Não foi possível salvar o profissional. Tente novamente");
    professionalId = data.id;
  }
  const { error: rateError } = await supabase.from("professional_default_commissions").upsert({
    professional_id: professionalId,
    salon_id: membership.salonId,
    commission_percent: parsed.data.commissionPercent,
  });
  if (rateError) return failed("Profissional salvo, mas a comissão não pôde ser gravada");
  refresh(id || undefined);
  return { ok: true };
}

export async function setProfessionalActive(id: string, active: boolean): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("professionals").update({ active }).eq("id", id);
  if (error) return failed("Não foi possível atualizar o profissional");
  refresh(id);
  return { ok: true };
}

export async function addSchedule(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = parseForm(scheduleSchema, formData);
  if (!parsed.ok) return parsed.result;
  const professionalId = String(formData.get("professionalId") ?? "");

  const supabase = await createServerClient();
  const { error } = await supabase.from("professional_schedules").insert({
    salon_id: membership.salonId,
    professional_id: professionalId,
    weekday: parsed.data.weekday,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  });
  if (error) return failed("Não foi possível salvar o horário");
  refresh(professionalId);
  return { ok: true };
}

export async function deleteSchedule(id: string, professionalId: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("professional_schedules").delete().eq("id", id);
  if (error) return failed("Não foi possível remover o horário");
  refresh(professionalId);
  return { ok: true };
}

export async function addBlock(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership, salon } = await requireRole(["admin", "reception"]);
  const parsed = parseForm(blockSchema, formData);
  if (!parsed.ok) return parsed.result;
  const professionalId = String(formData.get("professionalId") ?? "");

  const supabase = await createServerClient();
  const { error } = await supabase.from("schedule_blocks").insert({
    salon_id: membership.salonId,
    professional_id: professionalId,
    starts_at: zonedLocalToIso(parsed.data.startsAt, salon.timezone),
    ends_at: zonedLocalToIso(parsed.data.endsAt, salon.timezone),
    reason: parsed.data.reason,
  });
  if (error) return failed("Não foi possível salvar o bloqueio");
  refresh(professionalId);
  return { ok: true };
}

export async function deleteBlock(id: string, professionalId: string): Promise<ActionResult> {
  await requireRole(["admin", "reception"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("schedule_blocks").delete().eq("id", id);
  if (error) return failed("Não foi possível remover o bloqueio");
  refresh(professionalId);
  return { ok: true };
}

export async function setCommissionOverride(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = parseForm(commissionOverrideSchema, formData);
  if (!parsed.ok) return parsed.result;
  const professionalId = String(formData.get("professionalId") ?? "");

  const supabase = await createServerClient();
  const { error } = await supabase.from("professional_service_commissions").upsert(
    {
      salon_id: membership.salonId,
      professional_id: professionalId,
      service_id: parsed.data.serviceId,
      commission_percent: parsed.data.percent,
    },
    { onConflict: "professional_id,service_id" },
  );
  if (error) return failed("Não foi possível salvar a comissão");
  refresh(professionalId);
  return { ok: true };
}

export async function removeCommissionOverride(id: string, professionalId: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("professional_service_commissions").delete().eq("id", id);
  if (error) return failed("Não foi possível remover a comissão");
  refresh(professionalId);
  return { ok: true };
}
