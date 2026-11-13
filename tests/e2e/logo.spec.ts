import { expect, test } from "@playwright/test";
import { signUpSalon, uniqueEmail } from "./helpers";

test("admin envia logo do salão e ela aparece no menu; arquivo inválido é recusado", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signUpSalon(page, { email: uniqueEmail("logo"), salonName: "Salão Logo" });

  const sidebarLogo = page.locator("aside img").first();
  await expect(sidebarLogo).toHaveAttribute("src", "/brand/logo-dark.png");

  await page.goto("/configuracoes");
  const dark = page.locator("form").filter({ hasText: "Para fundo escuro" });

  await dark.getByLabel("Arquivo").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("%PDF-1.7 não é imagem"),
  });
  await dark.getByRole("button", { name: "Enviar logo" }).click();
  await expect(dark.getByRole("alert")).toHaveText("Formato inválido. Envie PNG, JPG ou SVG.");

  await dark.getByLabel("Arquivo").setInputFiles("public/icons/icon-192.png");
  await dark.getByRole("button", { name: "Enviar logo" }).click();
  await expect(dark.getByRole("status")).toHaveText("Logo atualizada.");
  await expect(sidebarLogo).toHaveAttribute("src", /salon-logos\/.+\/dark\.png\?v=\d+$/);

  const response = await page.request.get((await sidebarLogo.getAttribute("src"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});
