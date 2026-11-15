import { expect, test } from "@playwright/test";
import { setupSalonWithAgenda } from "./agenda-helpers";
import { bookAndFinish, openCash, startReceiving } from "./cash-helpers";
import { signIn } from "./helpers";

test("relatório do período com o atendimento recebido", async ({ page }) => {
  test.slow();
  await setupSalonWithAgenda(page, "relatorio");
  await openCash(page, "0");
  await bookAndFinish(page, "Lucas Teste", "10:00");
  const dialog = await startReceiving(page, "Lucas Teste");
  await dialog.getByRole("button", { name: "Receber R$ 40,00" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/financeiro/relatorios");
  await expect(page.getByTestId("report-revenue")).toHaveText("R$ 40,00");
  await expect(page.getByTestId("report-by-method")).toContainText("Dinheiro");
  await expect(page.getByTestId("report-by-method")).toContainText("R$ 40,00");
  await expect(page.getByTestId("report-by-item")).toContainText("Corte");
  await expect(page.getByTestId("report-by-professional")).toContainText("Rafa");

  await page.goto("/financeiro/relatorios?de=2020-01-01&ate=2020-01-31");
  await expect(page.getByText("Nada recebido neste período")).toBeVisible();
});

test("recepção não vê relatório; profissional vê o próprio resumo", async ({ page }) => {
  await signIn(page, "recepcao@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/financeiro/relatorios");
  await expect(page).toHaveURL(/\/painel$/);

  await page.context().clearCookies();
  await signIn(page, "pro@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/financeiro");
  await expect(page.getByTestId("my-summary")).toContainText(/\d+ atendimentos?/);
  await page.goto("/financeiro/relatorios");
  await expect(page).toHaveURL(/\/painel$/);
});
