import { describe, expect, it } from "vitest";
import { formatBRL, formatDateTime, formatTime } from "@/lib/format";

describe("format", () => {
  it("formata BRL a partir de centavos", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(-500)).toBe("-R$ 5,00");
  });

  it("formata data e hora no fuso de São Paulo", () => {
    expect(formatDateTime("2026-11-13T13:30:00Z")).toBe("13/11/2026 10:30");
    expect(formatTime("2026-11-14T02:15:00Z")).toBe("23:15");
  });
});
