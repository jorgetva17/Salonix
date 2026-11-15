"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { LOGO_CONTENT_TYPES, validateLogoFile } from "@/lib/validation/logo";

type Variant = "light" | "dark";
const patch = (variant: Variant, value: string | null) =>
  variant === "light" ? { logo_light_path: value } : { logo_dark_path: value };

export async function uploadSalonLogo(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  const variant = formData.get("variant");
  const file = formData.get("file");
  if (variant !== "light" && variant !== "dark") return { ok: false, error: "Variante inválida" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha uma imagem" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateLogoFile({ name: file.name, type: file.type, size: file.size, bytes });
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createServerClient();
  const path = `${membership.salonId}/${variant}.${check.ext}`;

  // Remove versões antigas em outra extensão antes de gravar.
  const old = (["png", "jpg", "svg"] as const).filter((e) => e !== check.ext).map((e) => `${membership.salonId}/${variant}.${e}`);
  await supabase.storage.from("salon-logos").remove(old);

  const { error } = await supabase.storage
    .from("salon-logos")
    .upload(path, bytes, { upsert: true, contentType: LOGO_CONTENT_TYPES[check.ext], cacheControl: "3600" });
  if (error) return { ok: false, error: "Não foi possível enviar a imagem. Tente novamente" };

  const { error: updateError } = await supabase
    .from("salons")
    .update(patch(variant, `${path}?v=${Date.now()}`))
    .eq("id", membership.salonId);
  if (updateError) return { ok: false, error: "Imagem enviada, mas não foi possível salvar. Tente novamente" };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeSalonLogo(variant: Variant): Promise<ActionResult> {
  const { membership } = await requireRole(["admin"]);
  if (variant !== "light" && variant !== "dark") return { ok: false, error: "Variante inválida" };
  const supabase = await createServerClient();
  await supabase.storage.from("salon-logos").remove((["png", "jpg", "svg"] as const).map((e) => `${membership.salonId}/${variant}.${e}`));
  const { error } = await supabase.from("salons").update(patch(variant, null)).eq("id", membership.salonId);
  if (error) return { ok: false, error: "Não foi possível remover a logo" };
  revalidatePath("/", "layout");
  return { ok: true };
}
