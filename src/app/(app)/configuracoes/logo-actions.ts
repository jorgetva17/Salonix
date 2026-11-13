"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, FormState } from "@/lib/action-result";
import { requireRole } from "@/lib/salon/active-salon";
import { LOGO_BUCKET } from "@/lib/salon/logo";
import { createServerClient } from "@/lib/supabase/server";
import { validateLogoFile } from "@/lib/validation/logo";

const variantSchema = z.enum(["light", "dark"]);
const column = { light: "logo_light_path", dark: "logo_dark_path" } as const;

const logoUpdate = (variant: "light" | "dark", path: string | null) =>
  variant === "light" ? { logo_light_path: path } : { logo_dark_path: path };

export async function uploadSalonLogo(_prev: FormState, formData: FormData): Promise<FormState> {
  const { salon } = await requireRole(["admin"]);
  const variant = variantSchema.safeParse(formData.get("variant"));
  const file = formData.get("file");
  if (!variant.success || !(file instanceof File)) return { ok: false, error: "Escolha uma imagem." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateLogoFile({ name: file.name, type: file.type, size: file.size, bytes });
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createServerClient();
  const path = `${salon.id}/${variant.data}.${check.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, bytes, { contentType: check.contentType, upsert: true });
  if (uploadError) return { ok: false, error: "Não foi possível enviar a imagem. Tente novamente." };

  // Remove a versão anterior se a extensão mudou (ex.: trocou PNG por SVG).
  const previous = salon[column[variant.data]];
  if (previous && previous !== path) await supabase.storage.from(LOGO_BUCKET).remove([previous]);

  const { error } = await supabase
    .from("salons")
    .update(logoUpdate(variant.data, path))
    .eq("id", salon.id);
  if (error) return { ok: false, error: "A imagem foi enviada, mas não foi possível salvá-la no salão." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Logo atualizada." };
}

export async function removeSalonLogo(variant: string): Promise<ActionResult> {
  const { salon } = await requireRole(["admin"]);
  const parsed = variantSchema.safeParse(variant);
  if (!parsed.success) return { ok: false, error: "Opção inválida." };

  const path = salon[column[parsed.data]];
  if (!path) return { ok: true };
  const supabase = await createServerClient();
  await supabase.storage.from(LOGO_BUCKET).remove([path]);
  const { error } = await supabase
    .from("salons")
    .update(logoUpdate(parsed.data, null))
    .eq("id", salon.id);
  if (error) return { ok: false, error: "Não foi possível remover a logo." };
  revalidatePath("/", "layout");
  return { ok: true };
}
