"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_SALON_COOKIE } from "@/lib/salon/cookie";
import { createServerClient } from "@/lib/supabase/server";

export async function acceptInvite(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("accept_invite", { p_invite_id: id });
  if (error || !data) redirect("/convite/aceitar?erro=1");
  (await cookies()).set(ACTIVE_SALON_COOKIE, data.salon_id, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/painel");
}

export async function declineInvite(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createServerClient();
  await supabase.rpc("decline_invite", { p_invite_id: id });
  redirect("/convite/aceitar");
}
