import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/validation/auth";
import { formatDuration, serviceSchema } from "@/lib/validation/services";

describe("formatDuration", () => {
  it.each([
    [30, "30 min"],
    [60, "1h"],
    [90, "1h30"],
    [125, "2h05"],
  ])("%i minutos → %s", (minutes, label) => {
    expect(formatDuration(minutes)).toBe(label);
  });
});

const parse = (overrides: Record<string, string>) =>
  serviceSchema.safeParse({ name: "Corte", durationMinutes: "30", price: "45,00", ...overrides });

describe("serviceSchema", () => {
  it("converte preço e duração", () => {
    const result = parse({});
    expect(result.success && result.data).toEqual({ name: "Corte", durationMinutes: 30, priceCents: 4500 });
  });
  it("duração fora de múltiplos de 5", () => {
    expect(firstErrors(parse({ durationMinutes: "7" })).durationMinutes).toBe("Use múltiplos de 5 minutos");
  });
  it.each(["0", "485"])("duração %s fora da faixa", (value) => {
    expect(firstErrors(parse({ durationMinutes: value })).durationMinutes).toBe("Entre 5 e 480 minutos");
  });
  it("preço inválido", () => {
    expect(firstErrors(parse({ price: "abc" })).price).toBe("Informe um preço válido, ex.: 45,00");
  });
});
