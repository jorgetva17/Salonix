import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Telas públicas (não precisam de login) nos temas claro e escuro, em celular e computador.
const PAGES = ["/entrar", "/cadastro", "/recuperar-senha"];

for (const scheme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`axe: ${path} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
}

test("telas públicas não têm rolagem horizontal no celular", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const page = await ctx.newPage();
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `${path} com rolagem horizontal`).toBe(false);
  }
  await ctx.close();
});
