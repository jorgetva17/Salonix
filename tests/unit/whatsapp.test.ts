import { describe, expect, it } from "vitest";
import { whatsappReminderUrl } from "@/lib/agenda/whatsapp";

describe("whatsappReminderUrl", () => {
  const url = whatsappReminderUrl({
    phone: "11988887777",
    customerName: "Carlos Cliente",
    salonName: "Barbearia Demo",
    startsAt: "2026-11-20T13:00:00Z",
    timeZone: "America/Sao_Paulo",
    professionalName: "Paulo",
    serviceNames: ["Corte", "Barba"],
  });

  it("aponta para o número com DDI 55", () => {
    expect(url.startsWith("https://wa.me/5511988887777?text=")).toBe(true);
  });
  it("mensagem pronta no horário do salão", () => {
    expect(new URL(url).searchParams.get("text")).toBe(
      "Olá, Carlos! Lembrete do seu horário na Barbearia Demo: 20/11 às 10:00 com Paulo (Corte + Barba).",
    );
  });
});
