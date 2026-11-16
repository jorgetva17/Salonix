"use client";

import { useState, useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { setThemePreference } from "@/app/(app)/configuracoes/actions";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "./theme-provider";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export function ThemeToggle({ initial, tone = "surface" }: { initial: ThemePreference; tone?: "sidebar" | "surface" }) {
  const { setTheme } = useTheme();
  const [selected, setSelected] = useState<ThemePreference>(initial);
  const [, startTransition] = useTransition();

  const choose = (value: ThemePreference) => {
    const previous = selected;
    setSelected(value);
    setTheme(value);
    startTransition(async () => {
      const result = await setThemePreference(value);
      if (!result.ok) {
        setSelected(previous);
        setTheme(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`Tema definido como "${OPTIONS.find((o) => o.value === value)?.label}".`);
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn(
        "grid grid-cols-3 gap-1 rounded-lg p-1",
        tone === "sidebar" ? "bg-sidebar-accent/60" : "bg-muted",
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const checked = selected === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => choose(value)}
            className={cn(
              "flex h-10 flex-col items-center justify-center rounded-md text-xs font-medium outline-none focus-visible:ring-2",
              tone === "sidebar"
                ? "text-sidebar-foreground focus-visible:ring-sidebar-ring"
                : "text-muted-foreground focus-visible:ring-ring",
              checked &&
                (tone === "sidebar"
                  ? "bg-sidebar text-sidebar-accent-foreground shadow-sm"
                  : "bg-card text-foreground shadow-sm"),
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
