"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/action-result";
import { authErrorMessage } from "@/lib/auth-helpers";
import { needsPasswordSetup } from "@/lib/invites";
import { ACTIVE_SALON_COOKIE } from "@/lib/salon/membership";
import { getCurrentUser } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { firstErrors } from "@/lib/validation/auth";
import { acceptWithPasswordSchema } from "@/lib/validation/team";

export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const inviteId = z.uuid().safeParse(formData.get("inviteId"));
  if (!inviteId.success) return { ok: false, error: "Convite inválido." };
  const supabase = await createServerClient();

  const user = await getCurrentUser();
  if (needsPasswordSetup(user)) {
    const parsed = acceptWithPasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, error: "Revise os campos destacados.", fieldErrors: firstErrors(parsed) };
    }
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: { full_name: parsed.data.fullName, password_set: true },
    });
    if (error) return { ok: false, error: authErrorMessage(error.code) };
    if (user) await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  }

  const { data: member, error } = await supabase.rpc("accept_invite", { p_invite_id: inviteId.data });
  if (error || !member) {
    const known = ["Convite não encontrado.", "Confirme seu e-mail antes de aceitar o convite."];
    return { ok: false, error: known.find((m) => m === error?.message) ?? "Não foi possível aceitar o convite." };
  }

  (await cookies()).set(ACTIVE_SALON_COOKIE, member.salon_id, { path: "/", sameSite: "lax", httpOnly: true });
  redirect("/painel");
}

export async function declineInvite(inviteId: string) {
  const supabase = await createServerClient();
  await supabase.rpc("decline_invite", { p_invite_id: z.uuid().parse(inviteId) });
  revalidatePath("/convite/aceitar");
}
