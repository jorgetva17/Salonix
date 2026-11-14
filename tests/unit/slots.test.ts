import { describe, expect, it } from "vitest";
import { availableSlots } from "@/lib/agenda/slots";

const workday = [
  { start: 540, end: 720 },
  { start: 780, end: 1080 },
];

describe("availableSlots", () => {
  it("cabe inteiro dentro de um trecho da jornada", () => {
    const slots = availableSlots({ intervals: workday, busy: [], durationMinutes: 30 });
    expect(slots[0]).toBe("09:00");
    expect(slots).toContain("11:30");
    expect(slots).toContain("17:30");
    expect(slots).not.toContain("11:45");
    expect(slots).not.toContain("17:45");
    expect(slots).not.toContain("12:00");
  });
  it("evita horários ocupados", () => {
    const slots = availableSlots({ intervals: workday, busy: [{ start: 600, end: 630 }], durationMinutes: 30 });
    expect(slots).not.toContain("09:45");
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:15");
    expect(slots).toContain("09:30");
    expect(slots).toContain("10:30");
  });
  it("corta horários que já passaram", () => {
    expect(availableSlots({ intervals: workday, busy: [], durationMinutes: 30, notBefore: 615 })[0]).toBe("10:15");
  });
  it("serviço de 1 hora", () => {
    const slots = availableSlots({ intervals: workday, busy: [], durationMinutes: 60 });
    expect(slots.at(-1)).toBe("17:00");
  });
  it("sem jornada no dia", () => {
    expect(availableSlots({ intervals: [], busy: [], durationMinutes: 30 })).toEqual([]);
  });
});
