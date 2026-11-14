import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["(11) 98888-7777", "11988887777"],
    ["11988887777", "11988887777"],
    ["+55 11 98888-7777", "11988887777"],
    ["(11) 3333-4444", "1133334444"],
  ])("%j → %s", (input, digits) => {
    expect(normalizePhone(input)).toBe(digits);
  });
  it.each(["98888-7777", "", "abc", "119888877771234"])("recusa %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("celular", () => expect(formatPhone("11988887777")).toBe("(11) 98888-7777"));
  it("fixo", () => expect(formatPhone("1133334444")).toBe("(11) 3333-4444"));
});
