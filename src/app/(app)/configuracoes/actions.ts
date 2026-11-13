"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

const themeSchema = z.enum(["light", "dark", "system"]);

export async function setThemePreference(theme: string): Promise<ActionResult> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return { ok: false, error: "Tema inválido." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  const supabase = await createServerClient();
  const { error } = await supabase.from("profiles").update({ theme: parsed.data }).eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar o tema." };
  return { ok: true };
}
