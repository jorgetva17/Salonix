"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { serviceSchema } from "@/lib/validation/services";

const uuid = z.uuid();

export async function saveService(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin"]);
  const raw = Object.fromEntries(formData);
  const parsed = serviceSchema.safeParse({ ...raw, id: raw.id || undefined });
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  }
  const { id, name, durationMinutes, priceCents } = parsed.data;
  const values = { name, duration_minutes: durationMinutes, price_cents: priceCents };

  const supabase = await createServerClient();
  const { error } = id
    ? await supabase.from("services").update(values).eq("id", id).eq("salon_id", salon.id)
    : await supabase.from("services").insert({ ...values, salon_id: salon.id });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Já existe um serviço com este nome." : "Não foi possível salvar o serviço.",
    };
  }
  revalidatePath("/servicos");
  return { ok: true, message: id ? "Serviço atualizado." : "Serviço criado." };
}

export async function setServiceActive(id: string, active: boolean): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Serviço inválido." };
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", parsedId.data)
    .eq("salon_id", salon.id);
  if (error) return { ok: false, error: "Não foi possível alterar o serviço." };
  revalidatePath("/servicos");
  return { ok: true };
}
