"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { failed, parseForm } from "@/lib/actions/parse";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { serviceSchema } from "@/lib/validation/catalog";

export async function saveService(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = parseForm(serviceSchema, formData);
  if (!parsed.ok) return parsed.result;
  const id = String(formData.get("id") ?? "");

  const supabase = await createServerClient();
  const values = { name: parsed.data.name, duration_minutes: parsed.data.durationMinutes, price_cents: parsed.data.price };
  const { error } = id
    ? await supabase.from("services").update(values).eq("id", id)
    : await supabase.from("services").insert({ ...values, salon_id: membership.salonId });
  if (error) return failed("Não foi possível salvar o serviço. Tente novamente");
  revalidatePath("/servicos");
  return { ok: true };
}

export async function setServiceActive(id: string, active: boolean): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("services").update({ active }).eq("id", id);
  if (error) return failed("Não foi possível atualizar o serviço");
  revalidatePath("/servicos");
  return { ok: true };
}
