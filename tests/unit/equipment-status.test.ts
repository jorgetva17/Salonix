import { describe, expect, it } from "vitest";
import { maintenanceStatus } from "@/lib/equipment/status";
import { maintenanceSchema } from "@/lib/validation/equipment";

describe("maintenanceStatus", () => {
  const today = "2026-11-20";
  it.each([
    [null, null],
    ["2026-11-19", "overdue"],
    ["2026-11-20", "soon"],
    ["2026-11-27", "soon"],
    ["2026-11-28", "ok"],
  ] as const)("%s → %s", (nextDue, status) => {
    expect(maintenanceStatus(nextDue, today)).toBe(status);
  });
});

describe("maintenanceSchema", () => {
  const base = { equipmentId: crypto.randomUUID(), performedOn: "2026-11-20", description: "Troca de lâmina", cost: "80,00" };

  it("custo em centavos e próxima opcional", () => {
    expect(maintenanceSchema.parse({ ...base, nextDue: "" })).toMatchObject({ costCents: 8000, nextDue: null });
    expect(maintenanceSchema.parse({ ...base, cost: "", nextDue: "2026-12-01" })).toMatchObject({ costCents: 0, nextDue: "2026-12-01" });
  });

  it("próxima antes da realizada", () => {
    const r = maintenanceSchema.safeParse({ ...base, nextDue: "2026-11-19" });
    expect(r.error?.issues[0].message).toBe("A próxima manutenção deve ser depois desta");
  });
});
