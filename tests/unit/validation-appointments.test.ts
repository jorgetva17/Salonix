import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/validation/auth";
import { appointmentSchema } from "@/lib/validation/appointments";

const base = {
  customerId: "11111111-1111-4111-8111-111111111111",
  professionalId: "22222222-2222-4222-8222-222222222222",
  serviceIds: ["33333333-3333-4333-8333-333333333333"],
  date: "2026-11-20",
  time: "10:00",
};

describe("appointmentSchema", () => {
  it("aceita um agendamento válido", () => {
    expect(appointmentSchema.safeParse(base).success).toBe(true);
  });
  it("exige serviço", () => {
    expect(firstErrors(appointmentSchema.safeParse({ ...base, serviceIds: [] })).serviceIds).toBe(
      "Escolha pelo menos um serviço",
    );
  });
  it("horário inválido", () => {
    expect(firstErrors(appointmentSchema.safeParse({ ...base, time: "25:00" })).time).toBe("Escolha um horário");
  });
  it("cliente obrigatório", () => {
    expect(firstErrors(appointmentSchema.safeParse({ ...base, customerId: "" })).customerId).toBe("Escolha o cliente");
  });
});
