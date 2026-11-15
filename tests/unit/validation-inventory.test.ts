import { describe, expect, it } from "vitest";
import { counterSaleSchema, inventoryItemSchema, movementSchema } from "@/lib/validation/inventory";

const item = { name: "Pomada", unit: "un", minQuantity: "5", unitCost: "12,00", salePrice: "35,00" };

describe("inventoryItemSchema", () => {
  it("converte valores em centavos e quantidade", () => {
    expect(inventoryItemSchema.parse(item)).toMatchObject({
      name: "Pomada",
      unit: "un",
      minQuantity: 5,
      unitCostCents: 1200,
      salePriceCents: 3500,
    });
  });

  it("nome vazio", () => {
    const r = inventoryItemSchema.safeParse({ ...item, name: " " });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Informe o nome do item");
  });

  it("preço de venda e custo vazios", () => {
    expect(inventoryItemSchema.parse({ ...item, salePrice: "", unitCost: "" })).toMatchObject({
      salePriceCents: null,
      unitCostCents: 0,
    });
  });

  it("mínimo inválido", () => {
    const r = inventoryItemSchema.safeParse({ ...item, minQuantity: "-1" });
    expect(r.error?.issues[0].message).toBe("Quantidade inválida");
  });
});

describe("movementSchema", () => {
  it("entrada com zero é recusada", () => {
    const r = movementSchema.safeParse({ itemId: crypto.randomUUID(), type: "in", quantity: "0" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Quantidade inválida");
  });

  it("ajuste por contagem aceita zero", () => {
    const r = movementSchema.safeParse({ itemId: crypto.randomUUID(), type: "adjust", quantity: "0" });
    expect(r.success).toBe(true);
    expect(r.data?.quantity).toBe(0);
  });

  it("entrada com custo e motivo", () => {
    const r = movementSchema.parse({ itemId: crypto.randomUUID(), type: "in", quantity: "2,5", unitCost: "3,00", reason: " compra " });
    expect(r).toMatchObject({ quantity: 2.5, unitCostCents: 300, reason: "compra" });
  });
});

describe("counterSaleSchema", () => {
  const id = crypto.randomUUID();
  it("cliente opcional e linhas com quantidade inteira", () => {
    expect(counterSaleSchema.parse({ customerId: "", items: JSON.stringify([{ inventoryItemId: id, quantity: 2 }]) })).toEqual({
      customerId: null,
      items: [{ inventoryItemId: id, quantity: 2 }],
    });
  });

  it("sem linhas", () => {
    const r = counterSaleSchema.safeParse({ customerId: "", items: "[]" });
    expect(r.error?.issues[0].message).toBe("Adicione pelo menos um produto");
  });

  it("quantidade fracionada", () => {
    const r = counterSaleSchema.safeParse({ items: JSON.stringify([{ inventoryItemId: id, quantity: 1.5 }]) });
    expect(r.success).toBe(false);
  });
});
