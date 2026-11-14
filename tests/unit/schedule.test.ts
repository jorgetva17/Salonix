import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/validation/auth";
import { blockSchema, findScheduleOverlap, formatBlockPeriod, scheduleSchema } from "@/lib/professionals/schedule";

describe("findScheduleOverlap", () => {
  it("intervalos sobrepostos na terça", () => {
    expect(
      findScheduleOverlap([
        { weekday: 2, startsAt: "09:00", endsAt: "12:00" },
        { weekday: 2, startsAt: "11:00", endsAt: "14:00" },
      ]),
    ).toBe(2);
  });
  it("intervalos encostados não se sobrepõem", () => {
    expect(
      findScheduleOverlap([
        { weekday: 2, startsAt: "09:00", endsAt: "12:00" },
        { weekday: 2, startsAt: "12:00", endsAt: "18:00" },
      ]),
    ).toBeNull();
  });
  it("mesmo horário em dias diferentes", () => {
    expect(
      findScheduleOverlap([
        { weekday: 2, startsAt: "09:00", endsAt: "12:00" },
        { weekday: 3, startsAt: "09:00", endsAt: "12:00" },
      ]),
    ).toBeNull();
  });
});

describe("scheduleSchema", () => {
  it("fim antes do início", () => {
    const result = scheduleSchema.safeParse([{ weekday: 1, startsAt: "12:00", endsAt: "09:00" }]);
    expect(Object.values(firstErrors(result))).toContain("O fim deve ser depois do início");
  });
  it("sobreposição cita o dia", () => {
    const result = scheduleSchema.safeParse([
      { weekday: 2, startsAt: "09:00", endsAt: "12:00" },
      { weekday: 2, startsAt: "11:00", endsAt: "14:00" },
    ]);
    expect(Object.values(firstErrors(result))).toContain("Horários se sobrepõem em Terça");
  });
});

describe("blockSchema", () => {
  const base = { kind: "day_off", startDate: "2026-11-20", endDate: "2026-11-22", allDay: "on" };

  it("dia inteiro vai até a meia-noite do dia seguinte ao final", () => {
    const result = blockSchema.safeParse(base);
    expect(result.success && result.data).toMatchObject({
      startsLocal: "2026-11-20 00:00",
      endsLocal: "2026-11-23 00:00",
    });
  });
  it("31/12 dia inteiro termina em 01/01", () => {
    const result = blockSchema.safeParse({ ...base, startDate: "2026-12-31", endDate: "2026-12-31" });
    expect(result.success && result.data.endsLocal).toBe("2027-01-01 00:00");
  });
  it("com horário usa as horas informadas", () => {
    const result = blockSchema.safeParse({
      kind: "break",
      startDate: "2026-11-20",
      endDate: "2026-11-20",
      startTime: "12:00",
      endTime: "13:00",
    });
    expect(result.success && result.data).toMatchObject({
      startsLocal: "2026-11-20 12:00",
      endsLocal: "2026-11-20 13:00",
    });
  });
  it("data final antes da inicial", () => {
    const result = blockSchema.safeParse({ ...base, endDate: "2026-11-19" });
    expect(firstErrors(result).endDate).toBe("A data final deve ser igual ou depois da inicial");
  });
  it("horário final antes do inicial no mesmo dia", () => {
    const result = blockSchema.safeParse({
      kind: "break",
      startDate: "2026-11-20",
      endDate: "2026-11-20",
      startTime: "13:00",
      endTime: "12:00",
    });
    expect(firstErrors(result).endTime).toBe("O fim deve ser depois do início");
  });
});

describe("formatBlockPeriod", () => {
  const tz = "America/Sao_Paulo";
  it("dias inteiros mostram só as datas", () => {
    expect(formatBlockPeriod("2026-11-20T03:00:00Z", "2026-11-23T03:00:00Z", tz)).toBe("20/11/2026 a 22/11/2026");
  });
  it("um dia inteiro mostra uma data", () => {
    expect(formatBlockPeriod("2026-11-20T03:00:00Z", "2026-11-21T03:00:00Z", tz)).toBe("20/11/2026 (dia inteiro)");
  });
  it("mesmo dia com horário", () => {
    expect(formatBlockPeriod("2026-11-20T15:00:00Z", "2026-11-20T16:00:00Z", tz)).toBe("20/11/2026 12:00–13:00");
  });
  it("dias diferentes com horário", () => {
    expect(formatBlockPeriod("2026-11-20T21:00:00Z", "2026-11-21T12:00:00Z", tz)).toBe(
      "20/11/2026 18:00 a 21/11/2026 09:00",
    );
  });
});
