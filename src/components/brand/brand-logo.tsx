/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/** Logo padrão do Salonix: variante clara/escura trocada por CSS (sem flash). */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <img src="/brand/logo-light.png" alt="Salonix" className={cn("dark:hidden", className)} />
      <img src="/brand/logo-dark.png" alt="Salonix" className={cn("hidden dark:block", className)} />
    </>
  );
}
