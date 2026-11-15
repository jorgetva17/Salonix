import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { appointmentSchema, serviceIdsSchema, walkInSchema } from "@/lib/validation/agenda";

const PRO = "2b1f6e0e-6c0a-4f6f-8a57-0f0c6f2a9b11";

describe("validação da agenda", () => {
  it("agendamento exige cliente cadastrado ou nome", () => {
    const r = appointmentSchema.safeParse({ professionalId: PRO, startsAt: "2026-11-20T10:00" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrorsOf(r.error).guestName).toBe("Escolha um cliente ou informe o nome");
    expect(appointmentSchema.safeParse({ professionalId: PRO, startsAt: "2026-11-20T10:00", guestName: "Zé" }).success).toBe(true);
  });
  it("aceita cliente cadastrado e trata campo vazio como ausente", () => {
    const r = appointmentSchema.parse({ customerId: PRO, guestName: "", professionalId: PRO, startsAt: "2026-11-20T10:00" });
    expect(r.customerId).toBe(PRO);
  });
  it("walk-in: profissional é opcional", () => {
    expect(walkInSchema.parse({ guestName: "Carlos", professionalId: "" }).professionalId).toBeUndefined();
  });
  it("exige pelo menos um serviço", () => {
    expect(serviceIdsSchema.safeParse([]).success).toBe(false);
    expect(serviceIdsSchema.safeParse([PRO]).success).toBe(true);
  });
});
