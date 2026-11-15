"use client";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBottomNav } from "@/lib/navigation";
import type { SalonRole } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const itemClass = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground";

export function BottomNav({ role }: { role: SalonRole }) {
  const pathname = usePathname();
  const { main, more } = getBottomNav(role);
  const moreActive = more.some((i) => pathname.startsWith(i.href));
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {main.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn(itemClass, active && "text-primary")}>
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        );
      })}
      {more.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(itemClass, moreActive && "text-primary")} aria-label="Mais opções">
            <MoreHorizontal className="size-5" aria-hidden />
            Mais
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            {more.map(({ href, label, icon: Icon }) => (
              <DropdownMenuItem key={href} asChild>
                <Link href={href}>
                  <Icon className="size-4" aria-hidden /> {label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </nav>
  );
}
