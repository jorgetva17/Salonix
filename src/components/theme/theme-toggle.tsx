"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { setThemePreference } from "@/app/(app)/configuracoes/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = (mounted ? theme : "system") as Theme;
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;

  function choose(value: string) {
    const next = value as Theme;
    setTheme(next);
    void setThemePreference(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tema">
          <Icon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current} onValueChange={choose}>
          <DropdownMenuRadioItem value="light"><Sun /> Claro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon /> Escuro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor /> Sistema</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
