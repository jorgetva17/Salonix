import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getActiveMembership } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const active = await getActiveMembership();
  if (!active) redirect("/onboarding");

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <AppShell
      role={active.membership.role}
      salon={active.salon}
      salonId={active.membership.salonId}
      memberships={active.memberships}
      userName={profile?.full_name ?? ""}
    >
      {children}
    </AppShell>
  );
}
