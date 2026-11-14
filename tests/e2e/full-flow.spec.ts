import { expect, test } from "@playwright/test";
import { setupSalonWithAgenda } from "./agenda-helpers";
import { closeCash, openCash, startReceiving } from "./cash-helpers";

// Fluxo completo do spec (§10): salão → serviço → walk-in → atender → pagar → fechar caixa.
test("do cliente na porta ao fechamento do caixa", async ({ page }) => {
  // Salão novo com serviço "Corte" R$ 40,00 e a profissional Rafa (40%) com jornada.
  await setupSalonWithAgenda(page, "fluxo");
  await openCash(page, "50,00");

  await page.goto("/agenda/fila");
  await page.getByRole("button", { name: "Cliente na porta" }).click();
  const walkIn = page.getByRole("dialog");
  await walkIn.getByLabel("Cliente", { exact: true }).fill("Juca Fluxo");
  await walkIn.getByRole("checkbox", { name: /Corte/ }).check();
  await walkIn.getByRole("button", { name: "Entrar na fila" }).click();
  await expect(walkIn).toBeHidden();
  await expect(page.getByTestId("queue-item").filter({ hasText: "Juca Fluxo" })).toBeVisible();

  await page.getByRole("button", { name: "Chamar próximo para Rafa" }).click();
  await expect(page.getByText(/Em atendimento: Juca Fluxo/)).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByText(/Em atendimento: Juca Fluxo/)).toHaveCount(0);

  const pay = await startReceiving(page, "Juca Fluxo");
  await pay.getByRole("button", { name: "Receber R$ 40,00" }).click();
  await expect(pay).toBeHidden();
  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 90,00");

  await page.getByLabel("Dinheiro contado (R$)").fill("90,00");
  await expect(page.getByTestId("closing-difference")).toHaveText("R$ 0,00");
  await closeCash(page, { Dinheiro: "90,00" });
  await expect(page.getByTestId("closed-sessions")).toContainText("Diferença R$ 0,00");

  await page.goto("/financeiro");
  await expect(page.getByTestId("commissions-Rafa").getByTestId("commission-available")).toHaveText("R$ 16,00");
});
