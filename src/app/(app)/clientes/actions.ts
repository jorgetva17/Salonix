"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { customerSchema } from "@/lib/validation/customers";
import { escapeLike, normalizeSearch } from "@/lib/search";

export type CustomerOption = { id: string; name: string; phone: string | null };

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

/** Sugestões para o seletor de cliente (agenda e walk-in). */
export async function searchCustomers(q: string): Promise<CustomerOption[]> {
  const { salon } = await requireRole(["admin", "reception"]);
  const term = q.trim().slice(0, 80);
  if (!term) return [];
  const supabase = await createServerClient();
  const digits = term.replace(/\D/g, "");
  let query = supabase.from("customers").select("id, name, phone").eq("salon_id", salon.id).order("name").limit(8);
  query =
    digits && /^[\d\s()+-]+$/.test(term)
      ? query.like("phone", `%${digits}%`)
      : query.ilike("name_search", `%${escapeLike(normalizeSearch(term))}%`);
  const { data } = await query;
  return data ?? [];
}

/** Cadastro rápido pelo seletor; telefone já cadastrado devolve o cliente existente. */
export async function quickCreateCustomer(name: string, phone: string): Promise<ActionResult<CustomerOption>> {
  const { salon } = await requireRole(["admin", "reception"]);
  const parsed = customerSchema.safeParse({ name, phone });
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos.", fieldErrors: firstErrors(parsed) };
  }
  const supabase = await createServerClient();
  if (parsed.data.phone) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("salon_id", salon.id)
      .eq("phone", parsed.data.phone)
      .maybeSingle();
    if (existing) return { ok: true, data: existing };
  }
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...parsed.data, salon_id: salon.id })
    .select("id, name, phone")
    .single();
  if (error) return { ok: false, error: "Não foi possível cadastrar o cliente." };
  revalidatePath("/clientes");
  return { ok: true, data };
}
