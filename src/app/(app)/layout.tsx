import { AppShell } from "@/components/layout/app-shell";
import { ThemeSync, type ThemePreference } from "@/components/theme/theme-provider";
import { getMemberships, requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, membership } = await requireRole();
  const supabase = await createServerClient();
  const [memberships, { data: profile }, { data: invites }] = await Promise.all([
    getMemberships(),
    supabase.from("profiles").select("full_name, theme").eq("id", user.id).single(),
    supabase.rpc("my_pending_invites"),
  ]);

  const theme = (profile?.theme ?? "system") as ThemePreference;

  return (
    <AppShell
      membership={membership}
      memberships={memberships}
      userName={profile?.full_name ?? ""}
      pendingInvites={invites?.length ?? 0}
      themePreference={theme}
      logo={<span className="font-heading text-2xl font-bold tracking-tight text-white">Salonix</span>}
    >
      <ThemeSync preference={theme} />
      {children}
    </AppShell>
  );
}
