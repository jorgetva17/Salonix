import { describe, expect, it } from "vitest";
import { estimateWaits, type QueueEntry } from "@/lib/agenda/queue";

const now = "2026-11-20T13:00:00Z";
const entry = (id: string, minute: number, durationMinutes: number, professionalId: string | null = null): QueueEntry => ({
  id,
  arrivedAt: new Date(Date.parse("2026-11-20T12:00:00Z") + minute * 60_000).toISOString(),
  durationMinutes,
  professionalId,
});
const plus = (minutes: number) => new Date(Date.parse(now) + minutes * 60_000).toISOString();

describe("estimateWaits", () => {
  it("um profissional livre: soma das durações à frente", () => {
    const waits = estimateWaits([entry("A", 0, 30), entry("B", 1, 20)], [{ professionalId: "P1", busyUntil: null }], now);
    expect(Object.fromEntries(waits)).toEqual({ A: 0, B: 30 });
  });
  it("profissional ocupado soma o restante do atendimento em curso", () => {
    const waits = estimateWaits([entry("A", 0, 30), entry("B", 1, 20)], [{ professionalId: "P1", busyUntil: plus(15) }], now);
    expect(Object.fromEntries(waits)).toEqual({ A: 15, B: 45 });
  });
  it("dois profissionais dividem a fila", () => {
    const servers = [
      { professionalId: "P1", busyUntil: null },
      { professionalId: "P2", busyUntil: null },
    ];
    const waits = estimateWaits([entry("A", 0, 30), entry("B", 1, 30), entry("C", 2, 30)], servers, now);
    expect(Object.fromEntries(waits)).toEqual({ A: 0, B: 0, C: 30 });
  });
  it("preferência por profissional", () => {
    const servers = [
      { professionalId: "P1", busyUntil: null },
      { professionalId: "P2", busyUntil: null },
    ];
    const waits = estimateWaits([entry("A", 0, 30, "P2"), entry("B", 1, 30)], servers, now);
    expect(Object.fromEntries(waits)).toEqual({ A: 0, B: 0 });
  });
  it("ordem é por chegada, não pela ordem da lista", () => {
    const waits = estimateWaits([entry("B", 5, 20), entry("A", 0, 30)], [{ professionalId: "P1", busyUntil: null }], now);
    expect(Object.fromEntries(waits)).toEqual({ A: 0, B: 30 });
  });
  it("preferido fora do expediente e ninguém trabalhando", () => {
    expect(estimateWaits([entry("A", 0, 30, "P9")], [{ professionalId: "P1", busyUntil: null }], now).get("A")).toBeNull();
    expect(estimateWaits([entry("A", 0, 30)], [], now).get("A")).toBeNull();
  });
});
