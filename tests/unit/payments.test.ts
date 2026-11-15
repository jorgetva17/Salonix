import { describe, expect, it } from "vitest";
import { cashDifference, commissionAmount, parsePayments, sumPayments } from "@/lib/payments";

describe("parsePayments", () => {
  it("ignora campos vazios e zerados, converte para centavos", () => {
    const r = parsePayments({ cash: "30,00", debit: "", credit: "0", pix: "15" });
    expect(r).toEqual({ ok: true, payments: [{ method: "cash", amount_cents: 3000 }, { method: "pix", amount_cents: 1500 }] });
    if (r.ok) expect(sumPayments(r.payments)).toBe(4500);
  });
  it("rejeita valor inválido e informa o campo", () => {
    expect(parsePayments({ cash: "abc" })).toMatchObject({ ok: false, field: "cash" });
  });
});

describe("commissionAmount (espelho da regra do banco)", () => {
  it.each([
    [4500, 40, 1800],
    [3000, 50, 1500],
    [1999, 33.33, 666],
    [1000, 12.5, 125],
    [333, 50, 167], // 166,5 -> half-up
    [4500, 0, 0],
  ])("%i a %f%% = %i", (base, pct, expected) => expect(commissionAmount(base, pct)).toBe(expected));
});

describe("cashDifference", () => {
  it("contado menos esperado", () => {
    const expected = { cash: 17000, debit: 1500, credit: 1999, pix: 7500 };
    expect(cashDifference(expected, { cash: 16900, debit: 1500, credit: 1999, pix: 7500 })).toBe(-100);
    expect(cashDifference(expected, expected)).toBe(0);
  });
});
