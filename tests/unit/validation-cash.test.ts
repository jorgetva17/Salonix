import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/validation/auth";
import { closeCashSchema, openCashSchema, paymentSchema } from "@/lib/validation/cash";

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

describe("paymentSchema", () => {
  it("converte desconto e pagamentos em centavos", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(
      paymentSchema.parse({ appointmentId: id, discount: "10,00", payments: JSON.stringify([{ method: "cash", amount: "60,00" }]) }),
    ).toEqual({ appointmentId: id, discountCents: 1000, payments: [{ method: "cash", amountCents: 6000 }] });
  });

  it("desconto vazio vale 0 e forma desconhecida dá erro", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(paymentSchema.parse({ appointmentId: id, discount: "", payments: "[]" }).discountCents).toBe(0);
    expect(paymentSchema.safeParse({ appointmentId: id, discount: "", payments: JSON.stringify([{ method: "boleto", amount: "1" }]) }).success).toBe(false);
  });
});
