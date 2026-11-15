import { describe, expect, it } from "vitest";
import { PERIOD_PRESETS, resolvePeriod } from "@/lib/finance/period";

const today = "2026-11-15";
const month = { from: "2026-11-01", to: "2026-11-30" };

describe("resolvePeriod", () => {
  it("sem parâmetros usa o mês atual", () => {
    expect(resolvePeriod({}, today)).toEqual(month);
  });

  it("mantém um período válido", () => {
    expect(resolvePeriod({ de: "2026-10-01", ate: "2026-10-31" }, today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("data inválida, invertida ou longa demais volta ao mês atual", () => {
    expect(resolvePeriod({ de: "2026-13-45", ate: "2026-11-30" }, today)).toEqual(month);
    expect(resolvePeriod({ de: "2026-02-30", ate: "2026-03-01" }, today)).toEqual(month);
    expect(resolvePeriod({ de: "2026-11-20", ate: "2026-11-10" }, today)).toEqual(month);
    expect(resolvePeriod({ de: "2025-01-01", ate: "2026-11-15" }, today)).toEqual(month);
  });

  it("aceita até 366 dias", () => {
    expect(resolvePeriod({ de: "2025-11-15", ate: "2026-11-15" }, today)).toEqual({ from: "2025-11-15", to: "2026-11-15" });
  });

  it("fevereiro bissexto termina no dia 29", () => {
    expect(resolvePeriod({}, "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});

describe("PERIOD_PRESETS", () => {
  it("atalhos a partir de hoje", () => {
    expect(PERIOD_PRESETS(today)).toEqual([
      { label: "Hoje", from: "2026-11-15", to: "2026-11-15" },
      { label: "Este mês", from: "2026-11-01", to: "2026-11-30" },
      { label: "Mês passado", from: "2026-10-01", to: "2026-10-31" },
      { label: "Últimos 30 dias", from: "2026-10-17", to: "2026-11-15" },
    ]);
  });
});
