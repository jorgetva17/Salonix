"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/salon/active-salon";
import { getSiteUrl } from "@/lib/site/url";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SalonRole } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase/server";
import { fieldErrorsOf, inviteSchema } from "@/lib/validation/auth";

const ROLES: SalonRole[] = ["admin", "reception", "professional"];

function dbError(message: string): string {
  if (message.includes("pelo menos um administrador")) return "O salão precisa ter pelo menos um administrador ativo";
  return "Não foi possível concluir a ação. Tente novamente";
}

export async function inviteMember(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
    professionalId: String(formData.get("professionalId") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error: insertError } = await supabase.from("salon_invites").insert({
    salon_id: membership.salonId,
    email: parsed.data.email,
    role: parsed.data.role,
    invited_by: user?.id ?? null,
    professional_id: parsed.data.professionalId ?? null,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, error: "Já existe um convite pendente para este e-mail" };
    }
    return { ok: false, error: "Não foi possível criar o convite. Tente novamente" };
  }

  const admin = createAdminClient();
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${await getSiteUrl()}/auth/callback?next=/convite/aceitar`,
  });
  revalidatePath("/equipe");

  if (mailError) {
    const text = mailError.message.toLowerCase();
    if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
      // Conta já existe: o convite continua valendo e aparece quando a pessoa entrar.
      return { ok: true, existingUser: true };
    }
    return { ok: false, error: "Convite criado, mas o e-mail não pôde ser enviado. Avise a pessoa para entrar no app" };
  }
  return { ok: true };
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("salon_invites").update({ status: "revoked" }).eq("id", inviteId).eq("status", "pending");
  if (error) return { ok: false, error: dbError(error.message) };
  revalidatePath("/equipe");
  return { ok: true };
}

export async function updateMemberRole(memberId: string, role: SalonRole): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (!ROLES.includes(role)) return { ok: false, error: "Perfil inválido" };
  const supabase = await createServerClient();
  const { error } = await supabase.from("salon_members").update({ role }).eq("id", memberId);
  if (error) return { ok: false, error: dbError(error.message) };
  revalidatePath("/equipe");
  return { ok: true };
}

export async function setMemberActive(memberId: string, active: boolean): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { error } = await supabase.from("salon_members").update({ active }).eq("id", memberId);
  if (error) return { ok: false, error: dbError(error.message) };
  revalidatePath("/equipe");
  return { ok: true };
}
