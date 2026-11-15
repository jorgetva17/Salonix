import { expect, test } from "@playwright/test";
import { signIn, signUpSalon, uniqueEmail } from "./helpers";
import { createStockItem, recordMovement } from "./inventory-helpers";

test("cadastrar item, dar entrada e ajustar por contagem", async ({ page }) => {
  await signUpSalon(page, { email: uniqueEmail("estoque"), salonName: "Salão Estoque" });
  await createStockItem(page, { name: "Pomada", unit: "un", min: "5", salePrice: "35,00" });
  const row = page.getByTestId("stock-item-Pomada");
  await expect(row.getByTestId("stock-quantity")).toHaveText("0 un");
  await expect(row.getByTestId("stock-status")).toHaveText("Abaixo do mínimo");
  await expect(row).toContainText("R$ 35,00");

  await recordMovement(page, "Pomada", "Entrada", "10", "12,00");
  await expect(page.getByTestId("item-quantity")).toHaveText("10 un");
  await expect(page.getByTestId("stock-status")).toHaveCount(0);

  await recordMovement(page, "Pomada", "Ajuste por contagem", "8");
  await expect(page.getByTestId("item-quantity")).toHaveText("8 un");
  await expect(page.getByTestId("movement").first()).toContainText("Ajuste -2 un");
});

test("recepção consulta o estoque sem cadastrar", async ({ page }) => {
  await signIn(page, "recepcao@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/estoque");
  await expect(page.getByRole("heading", { name: "Estoque", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo item" })).toHaveCount(0);
});
