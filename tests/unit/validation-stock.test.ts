import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/validation/auth";
import { counterSaleSchema, equipmentSchema, inventoryItemSchema, maintenanceSchema, movementSchema } from "@/lib/validation/stock";

const ID = "2b1f6e0e-6c0a-4f6f-8a57-0f0c6f2a9b11";

describe("validação de estoque", () => {
  it("item: converte mínimo e preço de venda opcional", () => {
    expect(inventoryItemSchema.parse({ name: "Pomada", unit: "un", minQuantity: "2", salePrice: "35,00" })).toEqual({ name: "Pomada", unit: "un", minQuantity: 2, salePrice: 3500 });
    expect(inventoryItemSchema.parse({ name: "Shampoo", unit: "ml", minQuantity: "200", salePrice: "" }).salePrice).toBeNull();
  });
  it("item: erros em pt-BR", () => {
    const r = inventoryItemSchema.safeParse({ name: "P", unit: "", minQuantity: "x", salePrice: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrorsOf(r.error);
      expect(e.name).toBe("Informe o nome do item");
      expect(e.salePrice).toBe("Informe um preço de venda válido (ex.: 35,00)");
    }
  });
  it("movimentação: quantidade e custo", () => {
    expect(movementSchema.parse({ itemId: ID, type: "in", quantity: "1,5", unitCost: "12,00" })).toMatchObject({ quantity: 1.5, unitCost: 1200 });
    expect(movementSchema.safeParse({ itemId: ID, type: "troca", quantity: "1" }).success).toBe(false);
  });
  it("equipamento e manutenção", () => {
    expect(equipmentSchema.parse({ name: "Máquina", responsibleId: "" }).responsibleId).toBeUndefined();
    const r = maintenanceSchema.safeParse({ equipmentId: ID, performedOn: "2026-11-20", description: "Troca de lâmina", nextDueOn: "2026-11-10" });
    expect(r.success).toBe(false);
    expect(maintenanceSchema.parse({ equipmentId: ID, performedOn: "2026-11-20", description: "Troca", cost: "80,00" }).cost).toBe(8000);
  });
  it("venda de balcão", () => {
    expect(counterSaleSchema.parse({ inventoryItemId: ID, quantity: "2" }).quantity).toBe(2);
    expect(counterSaleSchema.safeParse({ inventoryItemId: ID, quantity: "0" }).success).toBe(false);
  });
});
