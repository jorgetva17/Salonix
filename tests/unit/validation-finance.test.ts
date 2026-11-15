import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/validation/auth";
import { billSchema } from "@/lib/validation/finance";

const base = { category: "aluguel", description: "Aluguel novembro", amount: "1.500,00", dueDate: "2026-11-20", paidMethod: "" };

describe("billSchema", () => {
  it("converte o valor e deixa a forma vazia como nula", () => {
    expect(billSchema.parse(base)).toEqual({
      category: "aluguel",
      description: "Aluguel novembro",
      amountCents: 150000,
      dueDate: "2026-11-20",
      paidMethod: null,
    });
  });

  it("aceita conta já paga", () => {
    expect(billSchema.parse({ ...base, paidMethod: "pix" }).paidMethod).toBe("pix");
  });

  it("recusa valor zero, descrição curta e categoria de sistema", () => {
    expect(firstErrors(billSchema.safeParse({ ...base, amount: "0" })).amount).toBe("Valor inválido");
    expect(firstErrors(billSchema.safeParse({ ...base, description: " a " })).description).toBe("Informe a descrição");
    expect(firstErrors(billSchema.safeParse({ ...base, category: "comissao" })).category).toBe("Escolha a categoria");
    expect(firstErrors(billSchema.safeParse({ ...base, dueDate: "" })).dueDate).toBe("Informe o vencimento");
  });
});
