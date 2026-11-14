import { describe, expect, it } from "vitest";
import { closingDifference } from "@/lib/cash/summary";

// O esperado vem do banco (cash_session_summary, testado no pgTAP); aqui, só a
// diferença ao vivo da tela de fechamento.
describe("closingDifference", () => {
  it("diferença por forma e no total, forma não informada conta como 0", () => {
    const expected = { cash: 13500, debit: 7000, credit: 0, pix: 0 };
    expect(closingDifference(expected, { cash: 13000, debit: 7000 })).toEqual({
      byMethod: { cash: -500, debit: 0, credit: 0, pix: 0 },
      totalCents: -500,
    });
  });

  it("sobra aparece positiva", () => {
    expect(closingDifference({ cash: 5000, debit: 0, credit: 0, pix: 0 }, { cash: 5200 }).totalCents).toBe(200);
  });
});
