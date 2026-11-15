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

test("configurar o consumo de um item por serviço", async ({ page }) => {
  await signUpSalon(page, { email: uniqueEmail("consumo"), salonName: "Salão Consumo" });
  await page.goto("/servicos");
  await page.getByRole("button", { name: "Novo serviço" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Corte");
  await dialog.getByLabel("Preço (R$)").fill("40");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();

  await createStockItem(page, { name: "Shampoo", unit: "ml", min: "500" });
  await page.getByTestId("stock-item-Shampoo").getByRole("link").click();
  await page.getByLabel("Serviço que usa o item").selectOption({ label: "Corte" });
  await page.getByLabel("Quantidade por atendimento (ml)").fill("15");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByTestId("consumables")).toContainText("Corte · 15 ml por atendimento");

  await page.getByRole("button", { name: "Remover Corte" }).click();
  await expect(page.getByTestId("consumables")).toHaveCount(0);
  await expect(page.getByText("Nenhum serviço consome este item.")).toBeVisible();
});
