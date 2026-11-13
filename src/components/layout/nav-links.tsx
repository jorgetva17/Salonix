"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavItems, isActivePath } from "@/lib/navigation";
import type { SalonRole } from "@/lib/salon/membership";

/** Lista vertical usada na barra lateral (desktop) e no painel "Mais" (celular). */
export function NavLinks({
  role,
  onlySecondary = false,
  onNavigate,
  tone = "sidebar",
}: {
  role: SalonRole;
  onlySecondary?: boolean;
  onNavigate?: () => void;
  tone?: "sidebar" | "surface";
}) {
  const pathname = usePathname();
  const items = getNavItems(role).filter((i) => !onlySecondary || !i.primary);

  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] font-medium outline-none transition-colors focus-visible:ring-2",
                tone === "sidebar"
                  ? "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring"
                  : "hover:bg-muted focus-visible:ring-ring",
                active && tone === "sidebar" && "bg-sidebar-accent text-sidebar-accent-foreground",
                active && tone === "surface" && "bg-secondary text-secondary-foreground",
              )}
            >
              {active && (
                <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-highlight" />
              )}
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
