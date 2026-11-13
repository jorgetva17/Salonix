import { expect, test } from "@playwright/test";
import { signUpSalon, uniqueEmail } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;

test("celular: rodapé de navegação, sem rolagem horizontal, itens extras em 'Mais'", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signUpSalon(page, { email: uniqueEmail("mobile"), salonName: "Barbearia Mobile" });

  const bottomNav = page.locator("nav[aria-label='Principal']").last();
  await expect(bottomNav).toBeVisible();
  await expect(page.locator("aside")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-painel.png` });

  await bottomNav.getByRole("button", { name: "Mais" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Equipe" })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-mais.png` });
  await page.getByRole("dialog").getByRole("link", { name: "Equipe" }).click();
  await expect(page).toHaveURL(/\/equipe$/);
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("desktop: barra lateral com item ativo marcado", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signUpSalon(page, { email: uniqueEmail("desk"), salonName: "Barbearia Desktop" });

  const sidebar = page.locator("aside");
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Painel", exact: true })).toHaveAttribute("aria-current", "page");
  await sidebar.getByRole("link", { name: "Agenda" }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(sidebar.getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-agenda.png` });
});
