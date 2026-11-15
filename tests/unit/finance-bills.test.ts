import { describe, expect, it } from "vitest";
import { billStatus } from "@/lib/finance/bills";

describe("billStatus", () => {
  const today = "2026-11-15";
  const pending = (due_date: string) => billStatus({ status: "pending", due_date }, today);

  it("pendente vencida antes de hoje", () => {
    expect(pending("2026-11-14")).toBe("overdue");
  });

  it("vence de hoje até daqui a 7 dias", () => {
    expect(pending("2026-11-15")).toBe("due_soon");
    expect(pending("2026-11-22")).toBe("due_soon");
    expect(pending("2026-11-23")).toBe("pending");
  });

  it("paga e cancelada", () => {
    expect(billStatus({ status: "paid", due_date: "2026-11-01" }, today)).toBe("paid");
    expect(billStatus({ status: "reversed", due_date: "2026-11-01" }, today)).toBe("cancelled");
  });
});
