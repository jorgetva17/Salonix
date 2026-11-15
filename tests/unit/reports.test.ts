import { describe, expect, it } from "vitest";
import { csvMoney, parsePeriod, percentOf, periodFor, toCsv } from "@/lib/reports";

describe("períodos", () => {
  it("presets", () => {
    expect(periodFor("today", "2026-11-16")).toEqual({ from: "2026-11-16", to: "2026-11-16" });
    expect(periodFor("7d", "2026-11-16")).toEqual({ from: "2026-11-10", to: "2026-11-16" });
    expect(periodFor("month", "2026-11-16")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodFor("month", "2026-12-05")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(periodFor("last_month", "2026-11-16")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodFor("last_month", "2026-01-10")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodFor("month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" }); // bissexto
  });
  it("parsePeriod valida a URL", () => {
    expect(parsePeriod("2026-11-01", "2026-11-15", "2026-11-20")).toEqual({ from: "2026-11-01", to: "2026-11-15" });
    expect(parsePeriod("2026-11-15", "2026-11-01", "2026-11-20")).toEqual({ from: "2026-11-01", to: "2026-11-30" }); // invertido
    expect(parsePeriod("lixo", undefined, "2026-11-20")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(parsePeriod("2024-01-01", "2026-11-01", "2026-11-20").from).toBe("2026-11-01"); // > 1 ano
  });
});

describe("percentOf / CSV", () => {
  it("percentual", () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(5, 0)).toBe(0);
  });
  it("dinheiro e escape de CSV", () => {
    expect(csvMoney(123456)).toBe("1234,56");
    const csv = toCsv(["Descrição", "Valor"], [['Corte "premium"; barba', csvMoney(4500)], ["Linha\nquebrada", null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Corte ""premium""; barba";45,00');
    expect(csv).toContain('"Linha\nquebrada";');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
