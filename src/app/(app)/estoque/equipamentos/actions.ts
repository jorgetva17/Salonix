"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { EQUIPMENT_STATUSES } from "@/lib/equipment/status";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { equipmentSchema, maintenanceSchema } from "@/lib/validation/equipment";

const uuid = z.uuid();
const PATH = "/estoque/equipamentos";

export async function saveEquipment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin"]);
  const raw = Object.fromEntries(formData);
  const parsed = equipmentSchema.safeParse({ ...raw, id: raw.id || undefined });
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  const { id, name, status, professionalId, notes } = parsed.data;
  const values = { name, status, professional_id: professionalId, notes };
  const supabase = await createServerClient();
  // A FK composta garante que o responsável é deste salão.
  const { error } = id
    ? await supabase.from("equipment").update(values).eq("id", id).eq("salon_id", salon.id)
    : await supabase.from("equipment").insert({ ...values, salon_id: salon.id });
  if (error) return { ok: false, error: "Não foi possível salvar o equipamento." };
  revalidatePath(PATH);
  return { ok: true, message: id ? "Equipamento atualizado." : "Equipamento criado." };
}

export async function setEquipmentStatus(id: string, status: string): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const parsed = z.object({ id: uuid, status: z.enum(EQUIPMENT_STATUSES) }).safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Status inválido." };
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("equipment")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("salon_id", salon.id);
  if (error) return { ok: false, error: "Não foi possível alterar o status." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function addMaintenance(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin"]);
  const parsed = maintenanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  const { equipmentId, performedOn, description, costCents, nextDue } = parsed.data;
  const supabase = await createServerClient();
  const { error } = await supabase.from("equipment_maintenance").insert({
    salon_id: salon.id,
    equipment_id: equipmentId,
    performed_on: performedOn,
    description,
    cost_cents: costCents,
    next_due: nextDue,
  });
  if (error) return { ok: false, error: "Não foi possível registrar a manutenção." };
  revalidatePath(PATH);
  return { ok: true, message: "Manutenção registrada." };
}

export async function deleteMaintenance(id: string): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  if (!uuid.safeParse(id).success) return { ok: false, error: "Manutenção inválida." };
  const supabase = await createServerClient();
  const { error } = await supabase.from("equipment_maintenance").delete().eq("id", id).eq("salon_id", salon.id);
  if (error) return { ok: false, error: "Não foi possível remover a manutenção." };
  revalidatePath(PATH);
  return { ok: true };
}
