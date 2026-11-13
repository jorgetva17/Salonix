"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, useRef, type ComponentProps } from "react";

export type ThemePreference = "light" | "dark" | "system";

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props} />;
}

/** Aplica a preferência salva na conta (vale em qualquer aparelho em que a pessoa entrar). */
export function ThemeSync({ preference }: { preference: ThemePreference }) {
  const { setTheme } = useTheme();
  const applied = useRef<ThemePreference | null>(null);
  useEffect(() => {
    // Só quando a preferência salva muda; não sobrescreve a escolha feita agora no toggle.
    if (applied.current === preference) return;
    applied.current = preference;
    setTheme(preference);
  }, [preference, setTheme]);
  return null;
}
