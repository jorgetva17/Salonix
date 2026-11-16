"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut, Menu } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getNavItems, isActivePath } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/invites";
import type { Membership } from "@/lib/salon/membership";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { ThemePreference } from "@/components/theme/theme-provider";
import { NavLinks } from "./nav-links";
import { SalonSwitcher } from "./salon-switcher";

type Props = {
  membership: Membership;
  memberships: Membership[];
  userName: string;
  /** Logo do salão (ou padrão) para fundo escuro. */
  logo: ReactNode;
  themePreference: ThemePreference;
  pendingInvites: number;
  children: ReactNode;
};

export function AppShell({ membership, memberships, userName, logo, themePreference, pendingInvites, children }: Props) {
  return (
    <div className="flex min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground md:flex">
        <Link href="/painel" className="mb-8 block px-2" aria-label="Ir para o painel">
          {logo}
        </Link>
        <SalonSwitcher
          memberships={memberships}
          activeSalonId={membership.salonId}
          className="mb-6 px-2"
        />
        <nav aria-label="Principal" className="min-h-0 flex-1 overflow-y-auto">
          <NavLinks role={membership.role} />
        </nav>
        <AccountBlock userName={userName} membership={membership} theme={themePreference} tone="sidebar" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <span className="truncate font-heading text-lg font-semibold">{membership.salonName}</span>
        </header>
        {pendingInvites > 0 && (
          <Link
            href="/convite/aceitar"
            className="border-b bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground underline-offset-4 hover:underline"
          >
            Você tem {pendingInvites === 1 ? "1 convite pendente" : `${pendingInvites} convites pendentes`} de
            outro salão.
          </Link>
        )}
        <main className="flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">{children}</main>
      </div>

      <BottomNav membership={membership} memberships={memberships} userName={userName} theme={themePreference} />
    </div>
  );
}

function AccountBlock({
  userName,
  membership,
  theme,
  tone,
}: {
  userName: string;
  membership: Membership;
  theme: ThemePreference;
  tone: "sidebar" | "surface";
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-t pt-4", tone === "sidebar" ? "border-sidebar-border" : "")}>
      <div className="px-2">
        <p className="truncate font-medium">{userName || "Minha conta"}</p>
        <p className="text-sm opacity-75">{ROLE_LABELS[membership.role]}</p>
      </div>
      <ThemeToggle initial={theme} tone={tone} />
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          className={cn(
            "h-11 w-full justify-start gap-3 px-3 text-[0.95rem]",
            tone === "sidebar" && "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <LogOut className="size-5" aria-hidden />
          Sair
        </Button>
      </form>
    </div>
  );
}

function BottomNav({
  membership,
  memberships,
  userName,
  theme,
}: {
  membership: Membership;
  memberships: Membership[];
  userName: string;
  theme: ThemePreference;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = getNavItems(membership.role);
  const primary = items.filter((i) => i.primary).slice(0, 4);
  const moreActive = items.some((i) => !i.primary && isActivePath(pathname, i.href));

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active && <span aria-hidden className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-highlight" />}
                <Icon className="size-6" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              className={cn(
                "relative flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium",
                moreActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              {moreActive && (
                <span aria-hidden className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-highlight" />
              )}
              <Menu className="size-6" aria-hidden />
              Mais
            </DialogTrigger>
            <DialogContent className="top-auto bottom-0 max-h-[85dvh] translate-y-0 overflow-y-auto rounded-b-none sm:max-w-full">
              <DialogHeader>
                <DialogTitle>{membership.salonName}</DialogTitle>
              </DialogHeader>
              <SalonSwitcher memberships={memberships} activeSalonId={membership.salonId} />
              <NavLinks role={membership.role} onlySecondary tone="surface" onNavigate={() => setOpen(false)} />
              <AccountBlock userName={userName} membership={membership} theme={theme} tone="surface" />
            </DialogContent>
          </Dialog>
        </li>
      </ul>
    </nav>
  );
}
