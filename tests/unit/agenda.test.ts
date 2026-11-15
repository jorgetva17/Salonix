import { describe, expect, it } from "vitest";
import { estimateWaits, findFreeSlots, freeAtFor, weekdayOf } from "@/lib/agenda";

const now = new Date("2026-11-16T13:00:00Z");
const min = (n: number) => new Date(now.getTime() + n * 60000);

describe("estimateWaits", () => {
  const idle = [{ id: "p1", freeAt: now }, { id: "p2", freeAt: now }];

  it("fila vazia", () => expect(estimateWaits([], idle, now).size).toBe(0));

  it("primeiro cliente com profissional livre não espera", () => {
    const r = estimateWaits([{ id: "w1", professionalId: null, durationMinutes: 30 }], idle, now);
    expect(r.get("w1")).toEqual({ position: 1, waitMinutes: 0, professionalId: "p1" });
  });

  it("distribui por ordem de chegada entre profissionais", () => {
    const q = [
      { id: "w1", professionalId: null, durationMinutes: 30 },
      { id: "w2", professionalId: null, durationMinutes: 20 },
      { id: "w3", professionalId: null, durationMinutes: 30 },
    ];
    const r = estimateWaits(q, idle, now);
    expect(r.get("w1")?.waitMinutes).toBe(0); // p1 livre
    expect(r.get("w2")?.waitMinutes).toBe(0); // p2 livre
    expect(r.get("w3")).toMatchObject({ waitMinutes: 20, professionalId: "p2" }); // p2 termina antes (20 < 30)
  });

  it("soma o que falta do atendimento em curso", () => {
    const busy = [{ id: "p1", freeAt: min(15) }, { id: "p2", freeAt: min(40) }];
    const r = estimateWaits([{ id: "w1", professionalId: null, durationMinutes: 30 }], busy, now);
    expect(r.get("w1")).toMatchObject({ waitMinutes: 15, professionalId: "p1" });
  });

  it("respeita a preferência de profissional", () => {
    const busy = [{ id: "p1", freeAt: now }, { id: "p2", freeAt: min(25) }];
    const r = estimateWaits([{ id: "w1", professionalId: "p2", durationMinutes: 30 }], busy, now);
    expect(r.get("w1")).toMatchObject({ waitMinutes: 25, professionalId: "p2" });
  });

  it("sem profissional elegível, espera é desconhecida", () => {
    const r = estimateWaits([{ id: "w1", professionalId: "fora", durationMinutes: 30 }], idle, now);
    expect(r.get("w1")).toEqual({ position: 1, waitMinutes: null, professionalId: null });
  });

  it("freeAtFor", () => {
    expect(freeAtFor(null, now)).toEqual(now);
    expect(freeAtFor({ startedAt: min(-10).toISOString(), durationMinutes: 30 }, now)).toEqual(min(20));
    expect(freeAtFor({ startedAt: min(-90).toISOString(), durationMinutes: 30 }, now)).toEqual(now);
  });
});

describe("findFreeSlots", () => {
  const base = { date: "2026-11-20", durationMinutes: 30, now: new Date("2026-11-19T00:00:00Z") };

  it("calcula o dia da semana", () => expect(weekdayOf("2026-11-20")).toBe(5)); // sexta

  it("gera horários dentro da jornada em fuso de São Paulo", () => {
    const slots = findFreeSlots({ ...base, intervals: [{ start: "09:00", end: "10:00" }], busy: [] });
    expect(slots).toEqual(["2026-11-20T12:00:00.000Z", "2026-11-20T12:15:00.000Z", "2026-11-20T12:30:00.000Z"]);
  });

  it("não cabe atendimento que passa do fim da jornada", () => {
    const slots = findFreeSlots({ ...base, durationMinutes: 50, intervals: [{ start: "09:00", end: "10:00" }], busy: [] });
    expect(slots).toEqual(["2026-11-20T12:00:00.000Z"]);
  });

  it("remove horários que conflitam com atendimentos e bloqueios", () => {
    const slots = findFreeSlots({
      ...base,
      intervals: [{ start: "09:00", end: "11:00" }],
      busy: [{ start: "2026-11-20T12:30:00Z", end: "2026-11-20T13:00:00Z" }], // 09:30–10:00
    });
    expect(slots).not.toContain("2026-11-20T12:15:00.000Z"); // 09:15–09:45 bate
    expect(slots).not.toContain("2026-11-20T12:30:00.000Z");
    expect(slots).toContain("2026-11-20T12:00:00.000Z"); // 09:00–09:30 encosta, não bate
    expect(slots).toContain("2026-11-20T13:00:00.000Z"); // 10:00
  });

  it("não sugere horários no passado", () => {
    const slots = findFreeSlots({ ...base, now: new Date("2026-11-20T12:20:00Z"), intervals: [{ start: "09:00", end: "10:00" }], busy: [] });
    expect(slots).toEqual(["2026-11-20T12:30:00.000Z"]);
  });

  it("respeita dois turnos (almoço)", () => {
    const slots = findFreeSlots({ ...base, intervals: [{ start: "09:00", end: "09:30" }, { start: "13:00", end: "13:30" }], busy: [] });
    expect(slots).toEqual(["2026-11-20T12:00:00.000Z", "2026-11-20T16:00:00.000Z"]);
  });
});
