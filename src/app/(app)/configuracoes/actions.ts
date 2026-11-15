"use server";

import type { ActionResult } from "@/lib/action-result";
import { createServerClient } from "@/lib/supabase/server";

export async function setThemePreference(theme: "light" | "dark" | "system"): Promise<ActionResult> {
  if (!["light", "dark", "system"].includes(theme)) return { ok: false, error: "Tema inválido" };
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada" };
  const { error } = await supabase.from("profiles").update({ theme }).eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar o tema" };
  return { ok: true };
}
