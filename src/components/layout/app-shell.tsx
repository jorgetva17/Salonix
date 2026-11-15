import { SalonLogo } from "@/components/brand/salon-logo";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SalonSwitcher } from "@/components/layout/salon-switcher";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ROLE_LABELS } from "@/lib/navigation";
import type { SalonRole } from "@/lib/supabase/database.types";

export function AppShell({
  role,
  salon,
  salonId,
  memberships,
  userName,
  children,
}: {
  role: SalonRole;
  salon: { name: string; logo_light_path: string | null; logo_dark_path: string | null };
  salonId: string;
  memberships: { salonId: string; salonName: string }[];
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar role={role} brand={<SalonLogo salon={salon} className="h-16 w-auto max-w-full object-contain" />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-card/95 px-4 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{salon.name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
          </div>
          <div className="flex items-center gap-1">
            <SalonSwitcher memberships={memberships} activeId={salonId} />
            <ThemeToggle />
            <UserMenu name={userName} roleLabel={ROLE_LABELS[role]} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">{children}</main>
      </div>
      <BottomNav role={role} />
    </div>
  );
}
