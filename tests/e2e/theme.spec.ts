import { expect, test } from "@playwright/test";
import { signInUi, signUpUi, uniqueEmail } from "./helpers";

test("tema escuro é salvo no banco e volta em outro navegador", async ({ page, browser }) => {
  const email = uniqueEmail("tema");
  const password = "senha-segura-123";
  await signUpUi(page, { name: "Eva", salon: "Salão Tema", email, password });
  await page.waitForURL("**/painel");

  await page.getByRole("button", { name: "Tema" }).click();
  await page.getByRole("menuitemradio", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(800); // aguarda a Server Action gravar profiles.theme

  const other = await browser.newContext(); // sem localStorage/cookies
  const page2 = await other.newPage();
  await signInUi(page2, email, password);
  await page2.waitForURL("**/painel");
  await expect(page2.locator("html")).toHaveClass(/dark/);
  await other.close();
});
