"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { customerSchema } from "@/lib/validation/customers";

const uuid = z.uuid();

export async function saveCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin", "reception"]);
  const raw = Object.fromEntries(formData);
  const parsed = customerSchema.safeParse({ ...raw, id: raw.id || undefined });
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  }
  const { id, ...values } = parsed.data;

  const supabase = await createServerClient();
  const { error } = id
    ? await supabase.from("customers").update(values).eq("id", id).eq("salon_id", salon.id)
    : await supabase.from("customers").insert({ ...values, salon_id: salon.id });
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Já existe um cliente com este telefone.",
        fieldErrors: { phone: "Já existe um cliente com este telefone." },
      };
    }
    return { ok: false, error: "Não foi possível salvar o cliente." };
  }
  revalidatePath("/clientes");
  return { ok: true, message: id ? "Cliente atualizado." : "Cliente cadastrado." };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Cliente inválido." };
  const supabase = await createServerClient();
  const { error } = await supabase.from("customers").delete().eq("id", parsedId.data).eq("salon_id", salon.id);
  if (error) return { ok: false, error: "Não foi possível excluir o cliente." };
  revalidatePath("/clientes");
  return { ok: true };
}
