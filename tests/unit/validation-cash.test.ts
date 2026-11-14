import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/validation/auth";
import { closeCashSchema, openCashSchema } from "@/lib/validation/cash";

describe("openCashSchema", () => {
  it("valor inicial vazio pede o valor", () => {
    expect(firstErrors(openCashSchema.safeParse({ opening: "" })).opening).toBe("Informe o valor inicial");
  });

  it("converte reais em centavos", () => {
    expect(openCashSchema.parse({ opening: "100,50" })).toEqual({ openingCents: 10050 });
  });
});

describe("closeCashSchema", () => {
  it("vazio conta como 0 e inválido dá erro", () => {
    expect(closeCashSchema.parse({ cash: "95,00", debit: "", credit: "", pix: "" })).toEqual({
      cash: 9500,
      debit: 0,
      credit: 0,
      pix: 0,
    });
    expect(firstErrors(closeCashSchema.safeParse({ cash: "abc", debit: "", credit: "", pix: "" })).cash).toBe("Valor inválido");
  });
});
