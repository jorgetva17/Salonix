import { expect, test } from "@playwright/test";
import { bookTomorrow, setupSalonWithAgenda } from "./agenda-helpers";
import { openCash, startReceiving } from "./cash-helpers";
import { createStockItem, recordMovement } from "./inventory-helpers";

test("venda no balcão e produto no atendimento", async ({ page }) => {
  test.slow();
  await setupSalonWithAgenda(page, "balcao");
  await createStockItem(page, { name: "Pomada", unit: "un", min: "2", salePrice: "35,00" });
  await recordMovement(page, "Pomada", "Entrada", "10");
  await openCash(page, "100,00");

  await page.getByRole("button", { name: "Venda no balcão" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Produto 1").selectOption({ label: "Pomada · R$ 35,00" });
  await dialog.getByLabel("Quantidade 1").fill("2");
  await expect(dialog.getByTestId("sale-total")).toHaveText("R$ 70,00");
  await dialog.getByRole("button", { name: "Criar venda" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("awaiting-payment")).toContainText("Venda no balcão");

  dialog = await startReceiving(page, "Venda no balcão");
  await dialog.getByRole("button", { name: "Receber R$ 70,00" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 170,00");

  // A venda recebida baixou o estoque.
  await page.goto("/estoque");
  await expect(page.getByTestId("stock-item-Pomada").getByTestId("stock-quantity")).toHaveText("8 un");
  await page.getByTestId("stock-item-Pomada").getByRole("link").click();
  await expect(page.getByTestId("movement").first()).toContainText("Saída -2 un");
  await expect(page.getByTestId("movement").first()).toContainText("Venda no balcão");

  // Produto num atendimento em curso.
  await bookTomorrow(page, "Gabi Teste", "10:00");
  const gabi = page.getByTestId("agenda-appointment").filter({ hasText: "Gabi Teste" });
  await gabi.click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Iniciar" }).click();
  await expect(dialog).toBeHidden();
  await gabi.click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Produto para adicionar").selectOption({ label: "Pomada · R$ 35,00" });
  await dialog.getByRole("button", { name: "Adicionar produto" }).click();
  await expect(dialog.getByTestId("appointment-total")).toHaveText("R$ 75,00");
  await expect(dialog.getByTestId("appointment-items")).toContainText("Pomada × 1");
});
