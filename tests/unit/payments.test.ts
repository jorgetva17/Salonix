import { describe, expect, it } from "vitest";
import { paymentProblem, remainingCents } from "@/lib/cash/payments";

describe("paymentProblem", () => {
  it("aceita o valor exato com desconto", () => {
    expect(paymentProblem(7000, 1000, [{ method: "cash", amountCents: 6000 }])).toBeNull();
  });

  it("valor menor que o total", () => {
    const lines = [{ method: "cash" as const, amountCents: 5000 }];
    expect(paymentProblem(7000, 1000, lines)).toBe("Valor pago não confere com o total.");
    expect(remainingCents(7000, 1000, lines)).toBe(1000);
  });

  it("desconto maior que o total", () => {
    expect(paymentProblem(7000, 8000, [])).toBe("Desconto maior que o total.");
  });

  it("dividido em dinheiro e Pix", () => {
    expect(
      paymentProblem(7000, 0, [
        { method: "cash", amountCents: 4000 },
        { method: "pix", amountCents: 3000 },
      ]),
    ).toBeNull();
  });

  it("linha com valor zero não conta como pagamento", () => {
    expect(paymentProblem(7000, 0, [{ method: "cash", amountCents: 0 }, { method: "pix", amountCents: 7000 }])).toBe(
      "Valor pago não confere com o total.",
    );
  });
});
