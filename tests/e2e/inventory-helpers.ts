import { expect, type Page } from "@playwright/test";

/** Cria um item pelo diálogo "Novo item" de /estoque. */
export async function createStockItem(
  page: Page,
  item: { name: string; unit: "un" | "ml" | "g"; min: string; salePrice?: string },
) {
  await page.goto("/estoque");
  await page.getByRole("button", { name: "Novo item" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill(item.name);
  await dialog.getByLabel("Unidade", { exact: true }).selectOption(item.unit);
  await dialog.getByLabel("Estoque mínimo").fill(item.min);
  if (item.salePrice) await dialog.getByLabel("Preço de venda (R$)").fill(item.salePrice);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();
}

/** Abre o item e registra um movimento pelo formulário. */
export async function recordMovement(page: Page, name: string, type: "Entrada" | "Saída" | "Ajuste por contagem", quantity: string, cost?: string) {
  await page.goto("/estoque");
  await page.getByTestId(`stock-item-${name}`).getByRole("link").click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByLabel("Movimento").selectOption({ label: type });
  await page.getByLabel(/^Quantidade/).fill(quantity);
  if (cost) await page.getByLabel("Custo por unidade (R$)").fill(cost);
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Movimento registrado.")).toBeVisible();
}
