import { describe, expect, it } from "vitest";
import { formatBRL, formatDateTime, formatTime } from "@/lib/format";

describe("formatBRL", () => {
  it("formata centavos como reais", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });
  it("formata zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
  it("formata valores negativos", () => {
    expect(formatBRL(-500)).toBe("-R$ 5,00");
  });
});

describe("datas no fuso do salão", () => {
  it("exibe data e hora em America/Sao_Paulo", () => {
    expect(formatDateTime("2026-11-13T13:30:00Z")).toBe("13/11/2026 10:30");
  });
  it("vira o dia corretamente ao converter de UTC", () => {
    expect(formatTime("2026-11-14T02:15:00Z")).toBe("23:15");
  });
  it("aceita outro fuso", () => {
    expect(formatTime("2026-11-13T13:30:00Z", "America/Manaus")).toBe("09:30");
  });
});
