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

  // Foto de celular comum (3 MB): mensagem clara, não tela de erro genérica.
  await dark.getByLabel("Arquivo").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(3 * 1024 * 1024)]),
  });
  await dark.getByRole("button", { name: "Enviar logo" }).click();
  await expect(dark.getByRole("alert")).toHaveText("A imagem deve ter no máximo 2 MB.");

  await dark.getByLabel("Arquivo").setInputFiles("public/icons/icon-192.png");
  await dark.getByRole("button", { name: "Enviar logo" }).click();
  await expect(dark.getByRole("status")).toHaveText("Logo atualizada.");
  await expect(sidebarLogo).toHaveAttribute("src", /salon-logos\/.+\/dark\.png\?v=\d+$/);

  const response = await page.request.get((await sidebarLogo.getAttribute("src"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");

  // SVG é aceito, mas armazenado convertido em PNG.
  const light = page.locator("form").filter({ hasText: "Para fundo claro" });
  await light.getByLabel("Arquivo").setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><rect width="300" height="100" fill="#1B3B4B"/></svg>',
    ),
  });
  await light.getByRole("button", { name: "Enviar logo" }).click();
  await expect(light.getByRole("status")).toHaveText("Logo atualizada.");
  const lightSrc = await light.locator("img").getAttribute("src");
  expect(lightSrc).toMatch(/\/light\.png\?v=\d+$/);
  const lightRes = await page.request.get(lightSrc!);
  expect(lightRes.headers()["content-type"]).toBe("image/png");
});
