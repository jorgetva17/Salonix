import type { Database } from "@/lib/supabase/database.types";

export type SalonRole = Database["public"]["Enums"]["salon_role"];

export type Membership = {
  salonId: string;
  role: SalonRole;
  salonName: string;
};

export const ACTIVE_SALON_COOKIE = "salonix_salon";

export function pickActiveMembership(
  memberships: Membership[],
  cookieSalonId?: string,
): Membership | null {
  if (memberships.length === 0) return null;
  return memberships.find((m) => m.salonId === cookieSalonId) ?? memberships[0];
}
