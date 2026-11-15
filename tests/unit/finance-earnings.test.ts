import { describe, expect, it } from "vitest";
import { earningsSummary, type EarningRow } from "@/lib/finance/earnings";

const row = (over: Partial<EarningRow>): EarningRow => ({
  appointment_id: "a1",
  base_cents: 4500,
  status: "available",
  reverses_id: null,
  refunded_at: null,
  ...over,
});

describe("earningsSummary", () => {
  it("conta atendimentos distintos e soma a base dos serviços", () => {
    expect(earningsSummary([row({}), row({ base_cents: 3500 }), row({ appointment_id: "a2", status: "paid" })])).toEqual({
      appointments: 2,
      servicesCents: 12500,
    });
  });

  it("deixa de fora o estorno com comissão ainda não paga", () => {
    expect(earningsSummary([row({ status: "reversed", refunded_at: "2026-11-10T12:00:00Z" })])).toEqual({ appointments: 0, servicesCents: 0 });
  });

  it("deixa de fora o atendimento estornado depois da comissão paga", () => {
    // A comissão original continua 'paid'; o abatimento negativo vai para o mês do estorno.
    expect(earningsSummary([row({ status: "paid", refunded_at: "2026-12-03T12:00:00Z" }), row({ appointment_id: "a2" })])).toEqual({
      appointments: 1,
      servicesCents: 4500,
    });
  });
});
