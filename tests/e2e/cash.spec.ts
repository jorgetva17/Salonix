import { expect, test } from "@playwright/test";
import { dayInSaoPaulo, setupSalonWithAgenda } from "./agenda-helpers";
import { bookAndFinish, closeCash, openCash, startReceiving } from "./cash-helpers";
import { signIn } from "./helpers";

test("abrir e fechar o caixa com diferença", async ({ page }) => {
  await setupSalonWithAgenda(page, "caixa");
  await openCash(page, "100,00");
  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 100,00");

  await page.getByLabel("Dinheiro contado (R$)").fill("95,00");
  await expect(page.getByTestId("closing-difference")).toHaveText("-R$ 5,00");
  await closeCash(page, { Dinheiro: "95,00" });
  await expect(page.getByTestId("closed-sessions")).toContainText("Diferença -R$ 5,00");
});

test("profissional não entra no caixa", async ({ page }) => {
  await signIn(page, "pro@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/caixa");
  await expect(page).not.toHaveURL(/\/caixa$/);
});

test("receber em dinheiro com 2 toques e dividido com Pix a confirmar", async ({ page }) => {
  await setupSalonWithAgenda(page, "receber");
  await bookAndFinish(page, "Eva Teste", "10:00");

  let dialog = await startReceiving(page, "Eva Teste");
  await expect(dialog).toContainText("Abra o caixa antes de receber.");
  await page.keyboard.press("Escape");

  await openCash(page, "100,00");
  dialog = await startReceiving(page, "Eva Teste");
  await dialog.getByRole("button", { name: "Receber R$ 40,00" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 140,00");
  await expect(page.getByText("Nada para receber")).toBeVisible();

  await bookAndFinish(page, "Fabi Teste", "11:00");
  dialog = await startReceiving(page, "Fabi Teste");
  await dialog.getByRole("button", { name: "Dividir pagamento" }).click();
  await dialog.getByLabel("Valor 1 (R$)").fill("20,00");
  await dialog.getByRole("button", { name: "Outra forma" }).click();
  await expect(dialog.getByLabel("Valor 2 (R$)")).toHaveValue("20,00");
  await dialog.getByRole("group", { name: "Forma 2" }).getByRole("button", { name: "Pix" }).click();
  await expect(dialog.getByTestId("payment-remaining")).toHaveText("Valor fechado");
  await dialog.getByRole("button", { name: "Receber R$ 40,00" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 160,00");
  await expect(page.getByTestId("pix-pending")).toHaveText("R$ 20,00");
  await page.getByTestId("pix-to-confirm").getByRole("button", { name: "Confirmar Pix" }).click();
  await expect(page.getByTestId("expected-pix")).toHaveText("R$ 20,00");
  await expect(page.getByTestId("pix-pending")).toHaveText("R$ 0,00");
});

test("admin estorna atendimento pago e o dinheiro sai do caixa", async ({ page }) => {
  await setupSalonWithAgenda(page, "estorno");
  await openCash(page, "100,00");
  await bookAndFinish(page, "Gil Teste", "10:00");
  const dialog = await startReceiving(page, "Gil Teste");
  await dialog.getByRole("button", { name: "Receber R$ 40,00" }).click();
  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 140,00");

  await page.goto(`/agenda?data=${dayInSaoPaulo(1)}`);
  const gil = page.getByTestId("agenda-appointment").filter({ hasText: "Gil Teste" });
  await gil.click();
  let sheet = page.getByRole("dialog");
  await expect(sheet.getByTestId("appointment-payments")).toHaveText("Dinheiro R$ 40,00");
  await sheet.getByRole("button", { name: "Estornar" }).click();
  await expect(sheet.getByRole("button", { name: "Confirmar estorno" })).toBeDisabled();
  await sheet.getByLabel("Motivo", { exact: true }).fill("Cobrado em dobro");
  await sheet.getByRole("button", { name: "Confirmar estorno" }).click();
  await expect(sheet).toBeHidden();

  await gil.click();
  sheet = page.getByRole("dialog");
  await expect(sheet.getByTestId("appointment-status")).toHaveText("Pago · Estornado");
  await expect(sheet.getByTestId("appointment-history")).toContainText("Cobrado em dobro");
  await page.goto("/caixa");
  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 100,00");
});
