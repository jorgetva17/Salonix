"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { failed, parseForm } from "@/lib/actions/parse";
import { rpcFailure } from "@/lib/actions/rpc";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { consumableSchema, inventoryItemSchema, movementSchema } from "@/lib/validation/stock";

const refresh = () => {
  revalidatePath("/estoque");
  revalidatePath("/painel");
};

export async function saveInventoryItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = parseForm(inventoryItemSchema, formData);
  if (!parsed.ok) return parsed.result;
  const id = String(formData.get("id") ?? "");
  const supabase = await createServerClient();
  const values = { name: parsed.data.name, unit: parsed.data.unit, min_quantity: parsed.data.minQuantity, sale_price_cents: parsed.data.salePrice };
  const { error } = id
    ? await supabase.from("inventory_items").update(values).eq("id", id)
    : await supabase.from("inventory_items").insert({ ...values, salon_id: membership.salonId });
  if (error) return failed("Não foi possível salvar o item. Tente novamente");
  refresh();
  return { ok: true };
}

export async function setInventoryItemActive(id: string, active: boolean): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("inventory_items").update({ active }).eq("id", id);
  if (error) return failed("Não foi possível atualizar o item");
  refresh();
  return { ok: true };
}

export async function recordMovement(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = parseForm(movementSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_item_id: parsed.data.itemId,
    p_type: parsed.data.type,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason,
    p_unit_cost_cents: parsed.data.unitCost,
  });
  if (error) return rpcFailure(error);
  refresh();
  return { ok: true };
}

export async function saveConsumable(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = parseForm(consumableSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createServerClient();
  const { error } = await supabase.from("service_consumables").upsert(
    { salon_id: membership.salonId, service_id: parsed.data.serviceId, item_id: parsed.data.itemId, quantity: parsed.data.quantity },
    { onConflict: "service_id,item_id" },
  );
  if (error) return failed("Não foi possível salvar o consumo");
  refresh();
  return { ok: true };
}

export async function removeConsumable(id: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("service_consumables").delete().eq("id", id);
  if (error) return failed("Não foi possível remover o consumo");
  refresh();
  return { ok: true };
}
