"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { failed, parseForm } from "@/lib/actions/parse";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validation/catalog";

export async function saveCustomer(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin", "reception"]);
  const parsed = parseForm(customerSchema, formData);
  if (!parsed.ok) return parsed.result;
  const id = String(formData.get("id") ?? "");

  const supabase = await createServerClient();
  const values = { name: parsed.data.name, phone: parsed.data.phone || null, notes: parsed.data.notes };
  const { error } = id
    ? await supabase.from("customers").update(values).eq("id", id)
    : await supabase.from("customers").insert({ ...values, salon_id: membership.salonId });
  if (error) return failed("Não foi possível salvar o cliente. Tente novamente");
  revalidatePath("/clientes");
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  await requireRole(["admin", "reception"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return failed("Não foi possível excluir o cliente");
  revalidatePath("/clientes");
  return { ok: true };
}
