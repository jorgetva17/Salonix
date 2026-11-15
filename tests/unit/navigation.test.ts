import { describe, expect, it } from "vitest";
import { getBottomNav, getNavItems } from "@/lib/navigation";

const labels = (role: Parameters<typeof getNavItems>[0]) => getNavItems(role).map((i) => i.label);

describe("navegação por perfil", () => {
  it("recepção não vê Equipe, Financeiro nem Configurações", () => {
    const l = labels("reception");
    expect(l).not.toContain("Equipe");
    expect(l).not.toContain("Financeiro");
    expect(l).not.toContain("Configurações");
    expect(l).toContain("Caixa");
  });

  it("profissional vê 'Meus ganhos' e não vê Caixa", () => {
    const l = labels("professional");
    expect(l).toContain("Meus ganhos");
    expect(l).not.toContain("Caixa");
    expect(l).not.toContain("Equipe");
  });

  it("admin vê os 7 itens", () => {
    expect(getNavItems("admin")).toHaveLength(7);
  });

  it("rodapé mobile mostra até 4 itens e o resto vai para 'Mais'", () => {
    const admin = getBottomNav("admin");
    expect(admin.main).toHaveLength(4);
    expect(admin.more.map((i) => i.label)).toEqual(["Financeiro", "Equipe", "Configurações"]);
    const pro = getBottomNav("professional");
    expect(pro.main).toHaveLength(4);
    expect(pro.more).toHaveLength(0);
  });
});
