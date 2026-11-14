import { describe, expect, it } from "vitest";
import { addDays, addMonths, localDayRange, monthRange, todayIn, toLocalMinutes, weekdayOf } from "@/lib/agenda/time";

const SP = "America/Sao_Paulo";

describe("localDayRange", () => {
  it("dia local de São Paulo em UTC", () => {
    expect(localDayRange("2026-11-20", SP)).toEqual({
      from: "2026-11-20T03:00:00.000Z",
      to: "2026-11-21T03:00:00.000Z",
    });
  });
  it("respeita horário de verão de outro fuso", () => {
    expect(localDayRange("2026-07-01", "America/New_York")).toEqual({
      from: "2026-07-01T04:00:00.000Z",
      to: "2026-07-02T04:00:00.000Z",
    });
  });
});

describe("toLocalMinutes", () => {
  it("22:30 local cai no dia anterior em UTC", () => {
    expect(toLocalMinutes("2026-11-21T01:30:00Z", "2026-11-20", SP)).toBe(1350);
  });
  it("horário de outro dia fica fora de 0–1439", () => {
    expect(toLocalMinutes("2026-11-21T13:00:00Z", "2026-11-20", SP)).toBe(1440 + 600);
  });
});

describe("datas", () => {
  it("weekdayOf: 0 = domingo", () => {
    expect(weekdayOf("2026-11-20")).toBe(5);
    expect(weekdayOf("2026-11-22")).toBe(0);
  });
  it("addDays vira o ano", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("todayIn usa o fuso", () => {
    expect(todayIn(SP, new Date("2026-11-21T02:00:00Z"))).toBe("2026-11-20");
  });
});

describe("monthRange", () => {
  it("mês local de São Paulo em UTC", () => {
    expect(monthRange("2026-11", SP)).toEqual({ from: "2026-11-01T03:00:00.000Z", to: "2026-12-01T03:00:00.000Z" });
  });

  it("dezembro vira o ano", () => {
    expect(monthRange("2026-12", SP).to).toBe("2027-01-01T03:00:00.000Z");
  });

  it("addMonths anda e volta pelo ano", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});
