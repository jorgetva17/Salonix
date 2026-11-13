"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-result";
import { authErrorMessage, safeNextPath } from "@/lib/auth-helpers";
import { createServerClient } from "@/lib/supabase/server";
import {
  createSalonSchema,
  firstErrors,
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

const invalid = (fieldErrors: Record<string, string>): FormState => ({
  ok: false,
  error: "Revise os campos destacados.",
  fieldErrors,
});

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(firstErrors(parsed));

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: authErrorMessage(error.code) };

  redirect(safeNextPath(formData.get("next")?.toString()));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(firstErrors(parsed));
  const { fullName, email, password, salonName } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, pending_salon_name: salonName },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { ok: false, error: authErrorMessage(error.code) };

  // Com confirmação de e-mail ligada (produção) não há sessão ainda:
  // o salão é criado no onboarding, depois que a pessoa confirmar e entrar.
  if (!data.session) {
    return { ok: true, message: "Enviamos um link de confirmação para o seu e-mail." };
  }

  const { error: salonError } = await supabase.rpc("create_salon", { p_name: salonName });
  if (salonError) redirect("/onboarding");

  redirect("/painel");
}

export async function createSalon(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createSalonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(firstErrors(parsed));

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("create_salon", { p_name: parsed.data.salonName });
  if (error) return { ok: false, error: "Não foi possível criar o salão. Tente novamente." };

  redirect("/painel");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(firstErrors(parsed));

  const supabase = await createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/redefinir-senha`,
  });
  if (error?.code?.startsWith("over_")) return { ok: false, error: authErrorMessage(error.code) };

  // Mesma resposta exista ou não a conta, para não revelar e-mails cadastrados.
  return {
    ok: true,
    message: "Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha.",
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(firstErrors(parsed));

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authErrorMessage(error.code) };

  redirect("/painel");
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
