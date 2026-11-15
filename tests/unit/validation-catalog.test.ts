import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { blockSchema, customerSchema, professionalSchema, scheduleSchema, serviceSchema } from "@/lib/validation/catalog";

describe("catálogo", () => {
  it("serviço: converte preço em centavos", () => {
    const r = serviceSchema.parse({ name: "Corte", durationMinutes: "30", price: "45,90" });
    expect(r).toEqual({ name: "Corte", durationMinutes: 30, price: 4590 });
  });
  it("serviço: rejeita preço e duração inválidos", () => {
    const r = serviceSchema.safeParse({ name: "Corte", durationMinutes: "2", price: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrorsOf(r.error);
      expect(e.price).toBe("Informe um preço válido (ex.: 45,00)");
      expect(e.durationMinutes).toBe("A duração mínima é 5 minutos");
    }
  });
  it("profissional: percentual entre 0 e 100", () => {
    expect(professionalSchema.parse({ name: "Paulo", color: "#1B3B4B", commissionPercent: "40,5" }).commissionPercent).toBe(40.5);
    const r = professionalSchema.safeParse({ name: "Paulo", color: "#1B3B4B", commissionPercent: "101" });
    expect(r.success).toBe(false);
  });
  it("jornada: fim depois do início", () => {
    const r = scheduleSchema.safeParse({ weekday: "1", startTime: "18:00", endTime: "09:00" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrorsOf(r.error).endTime).toBe("O fim deve ser depois do início");
    expect(scheduleSchema.safeParse({ weekday: "1", startTime: "09:00", endTime: "18:00" }).success).toBe(true);
  });
  it("bloqueio: fim depois do início", () => {
    expect(blockSchema.safeParse({ startsAt: "2026-11-20T09:00", endsAt: "2026-11-20T08:00" }).success).toBe(false);
  });
  it("cliente: telefone vira só dígitos e é opcional", () => {
    expect(customerSchema.parse({ name: "Maria", phone: "(85) 99999-0000" }).phone).toBe("85999990000");
    expect(customerSchema.parse({ name: "Maria", phone: "" }).phone).toBe("");
    expect(customerSchema.safeParse({ name: "Maria", phone: "123" }).success).toBe(false);
  });
});
