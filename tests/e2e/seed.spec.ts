import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Requer `npm run db:reset` antes (carrega supabase/seed.sql).
test.describe("usuários de demonstração do seed", () => {
  for (const [email, extraLink] of [
    ["admin@salonix.dev", "Equipe"],
    ["recepcao@salonix.dev", "Caixa"],
    ["pro@salonix.dev", "Meus ganhos"],
  ] as const) {
    test(`${email} entra na Barbearia Demo`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await signIn(page, email, "salonix123");
      await expect(page).toHaveURL(/\/painel$/);
      await expect(page.getByRole("heading", { name: "Barbearia Demo" })).toBeVisible();
      await expect(page.locator("aside").getByRole("link", { name: extraLink })).toBeVisible();
    });
  }
});
