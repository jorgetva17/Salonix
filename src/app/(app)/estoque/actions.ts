"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { rpcError } from "@/lib/agenda/rpc-errors";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { inventoryItemSchema, movementSchema } from "@/lib/validation/inventory";
import { parseQuantity } from "@/lib/inventory/quantity";

const uuid = z.uuid();

export async function saveInventoryItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin"]);
  const raw = Object.fromEntries(formData);
  const parsed = inventoryItemSchema.safeParse({ ...raw, id: raw.id || undefined });
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  }
  const { id, name, unit, minQuantity, unitCostCents, salePriceCents } = parsed.data;
  const values = { name, unit, min_quantity: minQuantity, unit_cost_cents: unitCostCents, sale_price_cents: salePriceCents };

  const supabase = await createServerClient();
  const { error } = id
    ? await supabase.from("inventory_items").update(values).eq("id", id).eq("salon_id", salon.id)
    : await supabase.from("inventory_items").insert({ ...values, salon_id: salon.id });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Já existe um item com este nome." : "Não foi possível salvar o item.",
    };
  }
  revalidatePath("/estoque", "layout");
  return { ok: true, message: id ? "Item atualizado." : "Item criado." };
}

export async function setInventoryItemActive(id: string, active: boolean): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Item inválido." };
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({ active })
    .eq("id", parsedId.data)
    .eq("salon_id", salon.id);
  if (error) return { ok: false, error: "Não foi possível alterar o item." };
  revalidatePath("/estoque", "layout");
  return { ok: true };
}

export async function recordStockMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["admin"]);
  const raw = Object.fromEntries(formData);
  const parsed = movementSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  }
  const { itemId, type, quantity, unitCostCents, reason } = parsed.data;
  const supabase = await createServerClient();
  // A RPC confere se o item é do salão do admin.
  const { error } = await supabase.rpc("record_stock_movement", {
    p_item_id: itemId,
    p_type: type,
    p_quantity: quantity,
    p_unit_cost_cents: type === "in" ? (unitCostCents ?? undefined) : undefined,
    p_reason: reason ?? undefined,
  });
  if (error) return { ok: false, error: rpcError(error.message, "Não foi possível registrar o movimento.") };
  revalidatePath("/estoque", "layout");
  return { ok: true, message: "Movimento registrado." };
}

export async function saveServiceConsumable(itemId: string, serviceId: string, quantity: string): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const ids = z.object({ itemId: uuid, serviceId: uuid }).safeParse({ itemId, serviceId });
  if (!ids.success) return { ok: false, error: "Escolha o serviço." };
  const q = parseQuantity(quantity);
  if (q === null || q <= 0) return { ok: false, error: "Quantidade inválida." };
  const supabase = await createServerClient();
  // A FK composta garante que serviço e item são deste salão.
  const { error } = await supabase
    .from("service_consumables")
    .upsert(
      { salon_id: salon.id, service_id: ids.data.serviceId, inventory_item_id: ids.data.itemId, quantity: q },
      { onConflict: "service_id,inventory_item_id" },
    );
  if (error) return { ok: false, error: "Não foi possível salvar o consumo." };
  revalidatePath("/estoque", "layout");
  return { ok: true };
}

export async function removeServiceConsumable(id: string): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Consumo inválido." };
  const supabase = await createServerClient();
  const { error } = await supabase.from("service_consumables").delete().eq("id", parsedId.data).eq("salon_id", salon.id);
  if (error) return { ok: false, error: "Não foi possível remover o consumo." };
  revalidatePath("/estoque", "layout");
  return { ok: true };
}
