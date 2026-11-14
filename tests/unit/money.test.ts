import { describe, expect, it } from "vitest";
import { parseBRLToCents } from "@/lib/money";

describe("parseBRLToCents", () => {
  it.each([
    ["45", 4500],
    ["45,5", 4550],
    ["45,50", 4550],
    ["1.234,56", 123456],
    ["R$ 30,00", 3000],
    [" 0 ", 0],
    ["45.50", 4550],
  ])("%j vira %i centavos", (input, cents) => {
    expect(parseBRLToCents(input)).toBe(cents);
  });

  it.each(["abc", "", "-5", "1,234", "45,555"])("recusa %j", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});
