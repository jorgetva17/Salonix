import { expect, type Page } from "@playwright/test";

type MethodLabel = "Dinheiro" | "Débito" | "Crédito" | "Pix";

export async function openCash(page: Page, reais: string) {
  await page.goto("/caixa");
  await page.getByLabel("Valor inicial em dinheiro (R$)").fill(reais);
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await expect(page.getByText("Caixa aberto", { exact: true })).toBeVisible();
}

export async function closeCash(page: Page, counted: Partial<Record<MethodLabel, string>>) {
  await page.goto("/caixa");
  for (const [label, value] of Object.entries(counted)) {
    await page.getByLabel(`${label} contado (R$)`).fill(value);
  }
  await page.getByRole("button", { name: "Fechar caixa" }).click();
  await page.getByRole("button", { name: "Confirmar fechamento" }).click();
  await expect(page.getByText("Caixa fechado", { exact: true })).toBeVisible();
}
