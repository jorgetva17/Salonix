import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/validation/auth";
import { PROFESSIONAL_COLORS, professionalSchema } from "@/lib/validation/professionals";

const parse = (overrides: Record<string, string>) =>
  professionalSchema.safeParse({ name: "Paulo", color: PROFESSIONAL_COLORS[0], commissionPercent: "40", ...overrides });

describe("professionalSchema", () => {
  it("aceita vírgula decimal na comissão", () => {
    const result = parse({ commissionPercent: "37,5" });
    expect(result.success && result.data.commissionPercent).toBe(37.5);
  });
  it("comissão acima de 100", () => {
    expect(firstErrors(parse({ commissionPercent: "101" })).commissionPercent).toBe("Entre 0 e 100%");
  });
  it("comissão não numérica", () => {
    expect(firstErrors(parse({ commissionPercent: "abc" })).commissionPercent).toBe("Entre 0 e 100%");
  });
  it("cor fora da paleta", () => {
    expect(firstErrors(parse({ color: "#000000" })).color).toBe("Escolha uma cor");
  });
});
