import { expect, test } from "@playwright/test";
import { setupSalonWithAgenda } from "./agenda-helpers";
import { bookAndFinish, openCash, startReceiving } from "./cash-helpers";
import { signIn } from "./helpers";

// O salão demo é só lido aqui, para não mudar o que `seed.spec.ts` confere.
test("profissional vê só os próprios ganhos", async ({ page }) => {
  await signIn(page, "pro@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/financeiro");
  await expect(page.getByRole("heading", { name: "Meus ganhos" })).toBeVisible();
  await expect(page.getByTestId("commissions-Paulo Profissional").getByTestId("commission-available")).toHaveText("R$ 18,00");
  await expect(page.getByText("Marcos")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Pagar/ })).toHaveCount(0);
});

test("recepção não entra no financeiro", async ({ page }) => {
  await signIn(page, "recepcao@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/financeiro");
  await expect(page).not.toHaveURL(/\/financeiro/);
});

test("admin paga a comissão do mês e lança a despesa no caixa", async ({ page }) => {
  await setupSalonWithAgenda(page, "comissao");
  await openCash(page, "100,00");
  await bookAndFinish(page, "Hugo Teste", "10:00");
  const dialog = await startReceiving(page, "Hugo Teste");
  await dialog.getByRole("button", { name: "Receber R$ 40,00" }).click();
  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 140,00");

  await page.goto("/financeiro");
  const rafa = page.getByTestId("commissions-Rafa");
  await expect(rafa.getByTestId("commission-available")).toHaveText("R$ 16,00");
  await rafa.getByRole("button", { name: "Pagar R$ 16,00" }).click();
  await expect(rafa.getByLabel("Lançar como despesa")).toBeChecked();
  await rafa.getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(rafa.getByTestId("commission-paid")).toHaveText("R$ 16,00");
  await expect(rafa.getByTestId("commission-available")).toHaveText("R$ 0,00");

  await page.goto("/caixa");
  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 124,00");
});
