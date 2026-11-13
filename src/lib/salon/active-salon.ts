import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { ACTIVE_SALON_COOKIE, pickActiveMembership, type Membership, type SalonRole } from "./membership";

export type Salon = Database["public"]["Tables"]["salons"]["Row"];

export const getCurrentUser = cache(async () => {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("salon_members")
    .select("salon_id, role, salons(name)")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).flatMap((m) =>
    m.salons ? [{ salonId: m.salon_id, role: m.role, salonName: m.salons.name }] : [],
  );
});

export const getActiveMembership = cache(
  async (): Promise<{ membership: Membership; salon: Salon } | null> => {
    const memberships = await getMemberships();
    const cookieStore = await cookies();
    const membership = pickActiveMembership(memberships, cookieStore.get(ACTIVE_SALON_COOKIE)?.value);
    if (!membership) return null;
    const supabase = await createServerClient();
    const { data: salon, error } = await supabase
      .from("salons")
      .select("*")
      .eq("id", membership.salonId)
      .single();
    if (error) throw error;
    return { membership, salon };
  },
);

/** Garante login + vínculo com salão e, opcionalmente, um dos perfis indicados. */
export async function requireRole(roles?: SalonRole[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const active = await getActiveMembership();
  if (!active) redirect("/onboarding");
  if (roles && !roles.includes(active.membership.role)) redirect("/painel");
  return { user, ...active };
}
