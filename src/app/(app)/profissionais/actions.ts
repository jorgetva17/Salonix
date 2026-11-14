"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { parsePercent, professionalSchema } from "@/lib/validation/professionals";

const uuid = z.uuid();

const revalidate = (professionalId?: string) => {
  revalidatePath("/profissionais");
  if (professionalId) revalidatePath(`/profissionais/${professionalId}`);
};

export async function saveProfessional(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin"]);
  const raw = Object.fromEntries(formData);
  const parsed = professionalSchema.safeParse({ ...raw, id: raw.id || undefined });
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  }
  const { id, name, color, commissionPercent } = parsed.data;

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("save_professional", {
    p_salon_id: salon.id,
    p_name: name,
    p_color: color,
    p_commission_percent: commissionPercent,
    p_id: id,
  });
  if (error) return { ok: false, error: "Não foi possível salvar o profissional." };
  revalidate(id);
  return { ok: true, message: id ? "Profissional atualizado." : "Profissional criado." };
}

export async function setProfessionalActive(id: string, active: boolean): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Profissional inválido." };
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("professionals")
    .update({ active })
    .eq("id", parsedId.data)
    .eq("salon_id", salon.id);
  if (error) return { ok: false, error: "Não foi possível alterar o profissional." };
  revalidate(parsedId.data);
  return { ok: true };
}

/** Percentual vazio remove a sobrescrita (volta a valer a comissão padrão). */
export async function saveServiceCommission(
  professionalId: string,
  serviceId: string,
  percent: string,
): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const ids = z.object({ professionalId: uuid, serviceId: uuid }).safeParse({ professionalId, serviceId });
  if (!ids.success) return { ok: false, error: "Serviço inválido." };
  const supabase = await createServerClient();
  const match = { salon_id: salon.id, professional_id: ids.data.professionalId, service_id: ids.data.serviceId };

  if (percent.trim() === "") {
    const { error } = await supabase.from("commission_rates").delete().match(match);
    if (error) return { ok: false, error: "Não foi possível remover a comissão." };
  } else {
    const value = parsePercent(percent);
    if (value === null) return { ok: false, error: "Comissão entre 0 e 100%." };
    // O índice único é parcial (service_id não nulo), então o upsert do PostgREST não serve.
    const { data, error } = await supabase.from("commission_rates").update({ percent: value }).match(match).select("id");
    if (error) return { ok: false, error: "Não foi possível salvar a comissão." };
    if (data.length === 0) {
      const { error: insertError } = await supabase.from("commission_rates").insert({ ...match, percent: value });
      if (insertError) return { ok: false, error: "Não foi possível salvar a comissão." };
    }
  }
  revalidate(ids.data.professionalId);
  return { ok: true };
}

export async function linkProfessionalUser(professionalId: string, userId: string | null): Promise<ActionResult> {
  await requireRole(["admin"]);
  const ids = z.object({ professionalId: uuid, userId: uuid.nullable() }).safeParse({ professionalId, userId });
  if (!ids.success) return { ok: false, error: "Escolha uma pessoa da equipe." };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("link_professional_user", {
    p_professional_id: ids.data.professionalId,
    p_user_id: ids.data.userId as string,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Essa pessoa já está vinculada a outro profissional." };
    if (error.message === "Pessoa não faz parte da equipe.") return { ok: false, error: error.message };
    return { ok: false, error: "Não foi possível alterar o acesso." };
  }
  revalidate(ids.data.professionalId);
  return { ok: true };
}
