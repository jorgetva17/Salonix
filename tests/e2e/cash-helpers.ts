import { expect, type Page } from "@playwright/test";
import { bookTomorrow } from "./agenda-helpers";

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

/** Agenda para amanhã (helpers da agenda), inicia e conclui: fica aguardando pagamento. */
export async function bookAndFinish(page: Page, customer: string, time: string) {
  await bookTomorrow(page, customer, time);
  const block = page.getByTestId("agenda-appointment").filter({ hasText: customer });
  await block.click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Iniciar" }).click();
  await expect(dialog).toBeHidden();
  await block.click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Concluir" }).click();
  await expect(dialog).toBeHidden();
}

/** Em /caixa, abre "Receber" do cliente e devolve o diálogo. */
export async function startReceiving(page: Page, customer: string) {
  await page.goto("/caixa");
  await page.getByTestId("awaiting-payment").getByRole("listitem").filter({ hasText: customer }).getByRole("button", { name: "Receber" }).click();
  return page.getByRole("dialog");
}
