/* eslint-disable @next/next/no-img-element -- logos (inclusive SVG enviado pelo salão) sempre via <img>, nunca inline */
import type { ResolvedLogos } from "@/lib/salon/logo";
import { cn } from "@/lib/utils";

type Props = {
  logos: ResolvedLogos;
  alt: string;
  /** "dark": sempre sobre fundo escuro (sidebar). "auto": acompanha o tema. */
  surface?: "auto" | "dark";
  className?: string;
};

export function SalonLogo({ logos, alt, surface = "auto", className }: Props) {
  const imgClass = cn("h-auto max-h-14 w-auto max-w-full object-contain", className);
  const darkImg = logos.darkNeedsPlate ? (
    <span className="inline-flex rounded-lg bg-white p-2">
      <img src={logos.dark} alt={alt} className={imgClass} />
    </span>
  ) : (
    <img src={logos.dark} alt={alt} className={imgClass} />
  );

  if (surface === "dark") return darkImg;

  return (
    <>
      <img src={logos.light} alt={alt} className={cn(imgClass, "dark:hidden")} />
      <span className="hidden dark:inline-flex">{darkImg}</span>
    </>
  );
}
