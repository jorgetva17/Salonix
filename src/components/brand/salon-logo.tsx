/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

type SalonLogoData = { name: string; logo_light_path: string | null; logo_dark_path: string | null };

function publicLogoUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/salon-logos/${path}`;
}

/**
 * Logo do salão. Sempre <img> (SVG nunca inline). Escolhe a variante pelo tema via CSS;
 * sem logo própria, cai para a logo padrão do Salonix.
 */
export function SalonLogo({ salon, className }: { salon: SalonLogoData; className?: string }) {
  const light = publicLogoUrl(salon.logo_light_path);
  const dark = publicLogoUrl(salon.logo_dark_path) ?? light;
  const lightSrc = light ?? "/brand/logo-light.png";
  const darkSrc = dark ?? "/brand/logo-dark.png";
  return (
    <>
      <img src={lightSrc} alt={salon.name} className={cn("dark:hidden", className)} />
      <img src={darkSrc} alt={salon.name} className={cn("hidden dark:block", className)} />
    </>
  );
}
