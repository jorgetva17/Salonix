"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavItems } from "@/lib/navigation";
import type { SalonRole } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export function Sidebar({ role, brand }: { role: SalonRole; brand: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-24 items-center px-5">{brand}</div>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 px-3 py-2">
        {getNavItems(role).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-muted",
                active && "bg-secondary text-secondary-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
