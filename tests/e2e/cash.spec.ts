import { expect, test } from "@playwright/test";
import { setupSalonWithAgenda } from "./agenda-helpers";
import { closeCash, openCash } from "./cash-helpers";
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
