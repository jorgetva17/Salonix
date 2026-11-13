"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMemberships } from "@/lib/salon/active-salon";
import { ACTIVE_SALON_COOKIE } from "@/lib/salon/membership";

export async function switchSalon(salonId: string) {
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.salonId === salonId)) return;
  (await cookies()).set(ACTIVE_SALON_COOKIE, salonId, { path: "/", sameSite: "lax", httpOnly: true });
  redirect("/painel");
}
