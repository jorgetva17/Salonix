import { SalonLogo } from "@/components/brand/salon-logo";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeSync, type ThemePreference } from "@/components/theme/theme-provider";
import { getMemberships, requireRole } from "@/lib/salon/active-salon";
import { resolveLogos } from "@/lib/salon/logo";
import { createServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, salon } = await requireRole();
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
      logo={
        <SalonLogo
          logos={resolveLogos(salon, process.env.NEXT_PUBLIC_SUPABASE_URL!)}
          alt={salon.name}
          surface="dark"
          className="max-h-12"
        />
      }
    >
      <ThemeSync preference={theme} />
      {children}
    </AppShell>
  );
}
