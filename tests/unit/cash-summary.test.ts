import { describe, expect, it } from "vitest";
import { cashSummary, closingDifference, type CashTx } from "@/lib/cash/summary";

const txs: CashTx[] = [
  { type: "income", method: "cash", status: "paid", amountCents: 4500 },
  { type: "income", method: "debit", status: "paid", amountCents: 7000 },
  { type: "income", method: "pix", status: "pending", amountCents: 3500 },
  { type: "expense", method: "cash", status: "paid", amountCents: 1000 },
  { type: "income", method: "credit", status: "reversed", amountCents: 2000 },
];

describe("cashSummary", () => {
  it("soma o esperado por forma, com o Pix pendente à parte", () => {
    expect(cashSummary(10000, txs)).toEqual({
      expected: { cash: 13500, debit: 7000, credit: 0, pix: 0 },
      pixPendingCents: 3500,
      totalExpectedCents: 20500,
    });
  });

  it("caixa sem movimento espera só a abertura em dinheiro", () => {
    expect(cashSummary(5000, []).expected).toEqual({ cash: 5000, debit: 0, credit: 0, pix: 0 });
  });
});

describe("closingDifference", () => {
  it("diferença por forma e no total, forma não informada conta como 0", () => {
    const { expected } = cashSummary(10000, txs);
    expect(closingDifference(expected, { cash: 13000, debit: 7000 })).toEqual({
      byMethod: { cash: -500, debit: 0, credit: 0, pix: 0 },
      totalCents: -500,
    });
  });
});
