"use client";

import { useTransition } from "react";
import { switchSalon } from "@/app/(app)/actions";
import type { Membership } from "@/lib/salon/membership";
import { cn } from "@/lib/utils";

/** Só aparece para quem trabalha em mais de um salão. */
export function SalonSwitcher({
  memberships,
  activeSalonId,
  className,
}: {
  memberships: Membership[];
  activeSalonId: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  if (memberships.length < 2) return null;

  return (
    <label className={cn("flex flex-col gap-1 text-sm", className)}>
      <span className="opacity-80">Salão</span>
      <select
        value={activeSalonId}
        disabled={pending}
        onChange={(e) => startTransition(() => switchSalon(e.target.value))}
        className="h-11 rounded-lg border border-current/20 bg-transparent px-3 text-base [&>option]:text-foreground"
      >
        {memberships.map((m) => (
          <option key={m.salonId} value={m.salonId}>
            {m.salonName}
          </option>
        ))}
      </select>
    </label>
  );
}
