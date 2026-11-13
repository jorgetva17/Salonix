import { describe, expect, it } from "vitest";
import { resolveLogos } from "@/lib/salon/logo";

const base = "http://sb.local";
const salon = (light: string | null, dark: string | null) => ({
  logo_light_path: light,
  logo_dark_path: dark,
  updated_at: "2026-11-13T10:00:00Z",
});

describe("resolveLogos", () => {
  it("usa as logos padrão do Salonix quando o salão não enviou nenhuma", () => {
    expect(resolveLogos(salon(null, null), base)).toEqual({
      light: "/brand/logo-light.png",
      dark: "/brand/logo-dark.png",
      darkNeedsPlate: false,
      custom: false,
    });
  });
  it("monta a URL pública com versão para evitar cache antigo", () => {
    const r = resolveLogos(salon("abc/light.png", "abc/dark.png"), base);
    expect(r.light).toBe("http://sb.local/storage/v1/object/public/salon-logos/abc/light.png?v=1794564000000");
    expect(r.dark).toBe("http://sb.local/storage/v1/object/public/salon-logos/abc/dark.png?v=1794564000000");
    expect(r.darkNeedsPlate).toBe(false);
  });
  it("sem versão dark, usa a clara sobre uma placa clara em fundos escuros", () => {
    const r = resolveLogos(salon("abc/light.png", null), base);
    expect(r.dark).toBe(r.light);
    expect(r.darkNeedsPlate).toBe(true);
    expect(r.custom).toBe(true);
  });
});
