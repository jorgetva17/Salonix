import "server-only";
import type { createServerClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validation/customers";

type Supabase = Awaited<ReturnType<typeof createServerClient>>;

/** Id temporário para validar o restante do formulário antes de criar o cliente. */
export const PENDING_CUSTOMER_ID = "00000000-0000-4000-8000-000000000000";

/**
 * Cliente escolhido no seletor ou, se a pessoa só digitou o nome, o que esse nome indica:
 * `{ pendingName }` para criar depois de validar o resto, ou erro de campo.
 */
export function readCustomerChoice(formData: FormData): { customerId: string; pendingName: string | null } | { error: string } {
  const customerId = String(formData.get("customerId") ?? "");
  if (customerId) return { customerId, pendingName: null };
  const typed = String(formData.get("customerName") ?? "").trim();
  if (!typed) return { error: "Escolha o cliente" };
  const parsed = customerSchema.shape.name.safeParse(typed);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { customerId: PENDING_CUSTOMER_ID, pendingName: parsed.data };
}

/** Cria o cliente digitado (só nome) e devolve o id. */
export async function createTypedCustomer(supabase: Supabase, salonId: string, name: string): Promise<string | null> {
  const { data, error } = await supabase.from("customers").insert({ salon_id: salonId, name }).select("id").single();
  return error ? null : data.id;
}
