import { expect, test } from "@playwright/test";
import { PASSWORD, signIn, signUpSalon, uniqueEmail } from "./helpers";

test("tema escolhido fica salvo na conta e vale em outro navegador", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const email = uniqueEmail("tema");
  await signUpSalon(page, { email, salonName: "Salão Tema" });

  await page.locator("aside").getByRole("radio", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  const other = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await signIn(other, email, PASSWORD);
  await expect(other).toHaveURL(/\/painel$/);
  await expect(other.locator("html")).toHaveClass(/\bdark\b/);
  await expect(other.locator("aside").getByRole("radio", { name: "Escuro" })).toBeChecked();
  if (process.env.SHOTS_DIR) await other.goto("/equipe");
  if (process.env.SHOTS_DIR) await other.screenshot({ path: `${process.env.SHOTS_DIR}/desktop-dark-equipe.png` });
});
