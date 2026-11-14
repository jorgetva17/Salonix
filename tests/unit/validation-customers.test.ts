import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/validation/auth";
import { customerSchema } from "@/lib/validation/customers";

describe("customerSchema", () => {
  it("normaliza telefone e limpa observação vazia", () => {
    const result = customerSchema.safeParse({ name: " João ", phone: "(11) 98888-7777", notes: " " });
    expect(result.success && result.data).toEqual({ name: "João", phone: "11988887777", notes: null });
  });
  it("telefone é opcional", () => {
    const result = customerSchema.safeParse({ name: "Bruna", phone: "" });
    expect(result.success && result.data.phone).toBeNull();
  });
  it("telefone sem DDD", () => {
    expect(firstErrors(customerSchema.safeParse({ name: "Bruna", phone: "98888-7777" })).phone).toBe(
      "Informe DDD + número",
    );
  });
  it("nome curto", () => {
    expect(firstErrors(customerSchema.safeParse({ name: "B" })).name).toBe("Informe o nome");
  });
});
