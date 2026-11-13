import { describe, expect, it } from "vitest";
import { getNavItems } from "@/lib/navigation";

const hrefs = (role: Parameters<typeof getNavItems>[0]) => getNavItems(role).map((i) => i.href);

describe("getNavItems", () => {
  it("admin vê os 7 itens", () => {
    expect(hrefs("admin")).toEqual([
      "/painel",
      "/agenda",
      "/caixa",
      "/estoque",
      "/financeiro",
      "/equipe",
      "/configuracoes",
    ]);
  });
  it("recepção não vê equipe, financeiro nem configurações", () => {
    expect(hrefs("reception")).toEqual(["/painel", "/agenda", "/caixa", "/estoque"]);
  });
  it("profissional vê 'Meus ganhos' e não vê caixa", () => {
    const items = getNavItems("professional");
    expect(items.map((i) => i.href)).not.toContain("/caixa");
    expect(items.find((i) => i.href === "/financeiro")?.label).toBe("Meus ganhos");
  });
  it("no máximo 4 itens primários por perfil (rodapé do celular)", () => {
    for (const role of ["admin", "reception", "professional"] as const) {
      expect(getNavItems(role).filter((i) => i.primary).length).toBeLessThanOrEqual(4);
    }
  });
});
