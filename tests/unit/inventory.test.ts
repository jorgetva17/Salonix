import { describe, expect, it } from "vitest";
import { formatQuantity, parseQuantity } from "@/lib/inventory/quantity";
import { stockStatus } from "@/lib/inventory/status";

describe("parseQuantity", () => {
  it("aceita vírgula decimal e ponto de milhar", () => {
    expect(parseQuantity("2,5")).toBe(2.5);
    expect(parseQuantity("1.000")).toBe(1000);
    expect(parseQuantity("1.000,25")).toBe(1000.25);
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity(" 0 ")).toBe(0);
  });

  it("recusa mais de 3 casas, negativo e texto", () => {
    expect(parseQuantity("0,0001")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
    expect(parseQuantity("")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("formata em pt-BR com a unidade, sem casas inúteis", () => {
    expect(formatQuantity(2.5, "ml")).toBe("2,5 ml");
    expect(formatQuantity(1000, "un")).toBe("1.000 un");
    expect(formatQuantity(-5, "ml")).toBe("-5 ml");
  });
});

describe("stockStatus", () => {
  it("negativo, abaixo do mínimo ou ok", () => {
    expect(stockStatus(-5, 500)).toBe("negative");
    expect(stockStatus(400, 500)).toBe("low");
    expect(stockStatus(500, 500)).toBe("ok");
    expect(stockStatus(0, 0)).toBe("ok");
  });
});
