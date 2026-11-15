import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { Database, SalonRole } from "@/lib/supabase/database.types";

import { ACTIVE_SALON_COOKIE } from "./cookie";

export { ACTIVE_SALON_COOKIE };

export type Membership = { salonId: string; role: SalonRole; salonName: string };
export type Salon = Database["public"]["Tables"]["salons"]["Row"];

/** Escolhe o vínculo ativo: o do cookie, se ainda válido; senão o primeiro. */
export function pickActiveMembership(
  memberships: Membership[],
  cookieSalonId?: string,
): Membership | null {
  if (memberships.length === 0) return null;
  return memberships.find((m) => m.salonId === cookieSalonId) ?? memberships[0];
}

export async function listMemberships(): Promise<Membership[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("salon_members")
    .select("salon_id, role, salons(name)")
    .eq("active", true)
    .order("created_at");
  return (data ?? []).map((row) => ({
    salonId: row.salon_id,
    role: row.role,
    salonName: (row.salons as unknown as { name: string } | null)?.name ?? "",
  }));
}

export async function getActiveMembership(): Promise<
  { membership: Membership; salon: Salon; memberships: Membership[] } | null
> {
  const cookieStore = await cookies();
  const memberships = await listMemberships();
  const membership = pickActiveMembership(
    memberships,
    cookieStore.get(ACTIVE_SALON_COOKIE)?.value,
  );
  if (!membership) return null;

  const supabase = await createServerClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("*")
    .eq("id", membership.salonId)
    .single();
  if (!salon) return null;
  return { membership, salon, memberships };
}

/** Garante vínculo ativo e perfil permitido (senão redireciona). */
export async function requireRole(roles: SalonRole[]) {
  const active = await getActiveMembership();
  if (!active) redirect("/onboarding");
  if (!roles.includes(active.membership.role)) redirect("/painel");
  return active;
}
