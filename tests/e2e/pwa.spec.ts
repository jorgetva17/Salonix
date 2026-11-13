import { expect, test } from "@playwright/test";

test("manifest do PWA permite instalar o app", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    name: "Salonix",
    short_name: "Salonix",
    lang: "pt-BR",
    start_url: "/painel",
    display: "standalone",
    theme_color: "#1B3B4B",
  });
  const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}:${i.purpose ?? "any"}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));

  const icon = await request.get("/icons/icon-512.png");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toBe("image/png");
});

test("página de login aponta para o manifest e ícone da Apple", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
});
