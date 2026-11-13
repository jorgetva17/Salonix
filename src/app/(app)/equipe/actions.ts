"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { sendInviteEmail } from "@/lib/invites";
import { requireRole } from "@/lib/salon/active-salon";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { SALON_ROLES, inviteSchema } from "@/lib/validation/team";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const uuid = z.uuid();
const ownerError = "O salão precisa de pelo menos um administrador ativo.";

export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin"]);
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
  }
  const { email, role } = parsed.data;

  const supabase = await createServerClient();
  // Convite vencido ainda conta como pendente no índice único: libera para reenviar.
  await supabase
    .from("salon_invites")
    .update({ status: "revoked" })
    .eq("salon_id", salon.id)
    .eq("email", email)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
  const { error } = await supabase.from("salon_invites").insert({ salon_id: salon.id, email, role });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Já existe um convite pendente para este e-mail."
          : "Não foi possível criar o convite. Tente novamente.",
    };
  }

  revalidatePath("/equipe");
  try {
    const { existingUser } = await sendInviteEmail(
      createAdminClient().auth.admin,
      email,
      `${siteUrl()}/auth/callback?next=/convite/aceitar`,
    );
    return {
      ok: true,
      message: existingUser
        ? "Essa pessoa já tem conta: o convite aparecerá quando ela entrar no Salonix."
        : `Convite enviado para ${email}.`,
    };
  } catch {
    return {
      ok: false,
      error: "O convite foi criado, mas o e-mail não pôde ser enviado. Peça para a pessoa entrar com este e-mail.",
    };
  }
}

export async function revokeInvite(inviteId: string) {
  const { salon } = await requireRole(["admin"]);
  const supabase = await createServerClient();
  await supabase
    .from("salon_invites")
    .update({ status: "revoked" })
    .eq("id", uuid.parse(inviteId))
    .eq("salon_id", salon.id)
    .eq("status", "pending");
  revalidatePath("/equipe");
}

export async function updateMemberRole(memberId: string, role: string): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const parsedRole = z.enum(SALON_ROLES).safeParse(role);
  if (!parsedRole.success) return { ok: false, error: "Perfil inválido." };
  return updateMember(salon.id, memberId, { role: parsedRole.data }, "Não foi possível alterar o perfil.");
}

export async function setMemberActive(memberId: string, active: boolean): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  return updateMember(salon.id, memberId, { active }, "Não foi possível alterar o acesso.");
}

async function updateMember(
  salonId: string,
  memberId: string,
  changes: { role?: (typeof SALON_ROLES)[number]; active?: boolean },
  fallbackError: string,
): Promise<ActionResult> {
  const id = uuid.safeParse(memberId);
  if (!id.success) return { ok: false, error: fallbackError };
  const supabase = await createServerClient();
  const { error } = await supabase.from("salon_members").update(changes).eq("id", id.data).eq("salon_id", salonId);
  if (error) return { ok: false, error: error.message === ownerError ? ownerError : fallbackError };
  revalidatePath("/equipe");
  return { ok: true };
}
