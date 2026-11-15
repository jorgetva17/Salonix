"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { ACTIVE_SALON_COOKIE } from "@/lib/salon/active-salon";
import { getSiteUrl, safeNext } from "@/lib/site/url";
import { createServerClient } from "@/lib/supabase/server";
import {
  createSalonSchema,
  fieldErrorsOf,
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  translateAuthError,
} from "@/lib/validation/auth";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "");

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({ email: str(formData, "email"), password: str(formData, "password") });
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: translateAuthError(error.message) };
  redirect(safeNext(str(formData, "next")));
}

export async function signUp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    fullName: str(formData, "fullName"),
    email: str(formData, "email"),
    password: str(formData, "password"),
    salonName: str(formData, "salonName"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await getSiteUrl()}/auth/callback`,
    },
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  if (!data.session) {
    // Projeto exige confirmação de e-mail: o salão é criado depois, no /onboarding.
    redirect("/entrar?confirmar=1");
  }
  const { error: salonError } = await supabase.rpc("create_salon", { p_name: parsed.data.salonName });
  // Se a criação do salão falhar, o usuário continua logado e cai no /onboarding.
  redirect(salonError ? "/onboarding" : "/painel");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function requestPasswordReset(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse({ email: str(formData, "email") });
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const supabase = await createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await getSiteUrl()}/auth/callback?next=/redefinir-senha`,
  });
  if (error && error.message.toLowerCase().includes("rate")) {
    return { ok: false, error: translateAuthError(error.message) };
  }
  // Resposta igual exista ou não a conta (não revela cadastros).
  return { ok: true };
}

export async function updatePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse({
    password: str(formData, "password"),
    confirmPassword: str(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  redirect("/painel");
}

export async function createSalon(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = createSalonSchema.safeParse({ salonName: str(formData, "salonName"), phone: str(formData, "phone") });
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("create_salon", {
    p_name: parsed.data.salonName,
    p_phone: parsed.data.phone || null,
  });
  if (error || !data) return { ok: false, error: "Não foi possível criar o salão. Tente novamente" };
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SALON_COOKIE, data.id, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/painel");
}
