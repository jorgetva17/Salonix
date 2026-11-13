export const LOGO_BUCKET = "salon-logos";
export const DEFAULT_LOGOS = { light: "/brand/logo-light.png", dark: "/brand/logo-dark.png" };

type SalonLogoFields = {
  logo_light_path: string | null;
  logo_dark_path: string | null;
  updated_at: string;
};

export type ResolvedLogos = {
  /** Para fundos claros. */
  light: string;
  /** Para fundos escuros (sidebar, tema dark). */
  dark: string;
  /** A logo de fundo escuro é a clara: exibir sobre uma placa clara para manter contraste. */
  darkNeedsPlate: boolean;
  custom: boolean;
};

export function resolveLogos(salon: SalonLogoFields, supabaseUrl: string): ResolvedLogos {
  if (!salon.logo_light_path && !salon.logo_dark_path) {
    return { ...DEFAULT_LOGOS, darkNeedsPlate: false, custom: false };
  }
  const version = Date.parse(salon.updated_at);
  const url = (path: string) => `${supabaseUrl}/storage/v1/object/public/${LOGO_BUCKET}/${path}?v=${version}`;
  const light = url((salon.logo_light_path ?? salon.logo_dark_path)!);
  const dark = salon.logo_dark_path ? url(salon.logo_dark_path) : light;
  return { light, dark, darkNeedsPlate: !salon.logo_dark_path, custom: true };
}
