"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { failed, parseForm } from "@/lib/actions/parse";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { equipmentSchema, maintenanceSchema } from "@/lib/validation/stock";

const refresh = () => {
  revalidatePath("/estoque/equipamentos");
  revalidatePath("/painel");
};

export async function saveEquipment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = parseForm(equipmentSchema, formData);
  if (!parsed.ok) return parsed.result;
  const id = String(formData.get("id") ?? "");
  const supabase = await createServerClient();
  const values = { name: parsed.data.name, responsible_id: parsed.data.responsibleId ?? null, notes: parsed.data.notes };
  const { error } = id
    ? await supabase.from("equipment").update(values).eq("id", id)
    : await supabase.from("equipment").insert({ ...values, salon_id: membership.salonId });
  if (error) return failed("Não foi possível salvar o equipamento");
  refresh();
  return { ok: true };
}

export async function setEquipmentStatus(id: string, status: "active" | "maintenance" | "inactive"): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("equipment").update({ status }).eq("id", id);
  if (error) return failed("Não foi possível atualizar o status");
  refresh();
  return { ok: true };
}

export async function addMaintenance(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = parseForm(maintenanceSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("equipment_maintenance")
    .insert({
      salon_id: membership.salonId,
      equipment_id: parsed.data.equipmentId,
      performed_on: parsed.data.performedOn,
      description: parsed.data.description,
      next_due_on: parsed.data.nextDueOn ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return failed("Não foi possível registrar a manutenção");
  if (parsed.data.cost !== null && parsed.data.cost > 0) {
    const { error: costError } = await supabase.from("equipment_maintenance_costs").insert({ maintenance_id: data.id, salon_id: membership.salonId, cost_cents: parsed.data.cost });
    if (costError) return failed("Manutenção registrada, mas o custo não pôde ser gravado");
  }
  refresh();
  return { ok: true };
}
