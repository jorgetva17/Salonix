import { describe, expect, it } from "vitest";
import { formatQuantity, maintenanceStatus, parseQuantity, stockStatus } from "@/lib/stock";

describe("stockStatus", () => {
  it.each([
    [-1, 5, "negative"],
    [0, 5, "out"],
    [5, 5, "low"],
    [3, 5, "low"],
    [6, 5, "ok"],
    [1, 0, "ok"], // sem mínimo definido, não alerta
  ])("quantidade %f com mínimo %f = %s", (q, min, expected) => expect(stockStatus(q, min)).toBe(expected));
});

describe("parseQuantity / formatQuantity", () => {
  it.each([["20", 20], ["1,5", 1.5], ["1.250,75", 1250.75], ["0", 0], ["0,125", 0.125]])("%s -> %f", (s, n) => expect(parseQuantity(s)).toBe(n));
  it.each(["", "abc", "-1", "1,2345"])("rejeita %j", (s) => expect(parseQuantity(s)).toBeNull());
  it("formata em pt-BR com unidade", () => {
    expect(formatQuantity(1250.5, "ml")).toBe("1.250,5 ml");
    expect(formatQuantity(3)).toBe("3");
  });
});

describe("maintenanceStatus", () => {
  const today = "2026-11-16";
  it("calcula vencida, próxima e em dia", () => {
    expect(maintenanceStatus("2026-11-15", today)).toBe("overdue");
    expect(maintenanceStatus("2026-11-16", today)).toBe("soon");
    expect(maintenanceStatus("2026-11-23", today)).toBe("soon");
    expect(maintenanceStatus("2026-11-24", today)).toBe("ok");
    expect(maintenanceStatus(null, today)).toBeNull();
  });
});
