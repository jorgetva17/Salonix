import { expect, test } from "@playwright/test";

test("manifest do PWA é público e válido", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.name).toBe("Salonix");
  expect(manifest.lang).toBe("pt-BR");
  expect(manifest.start_url).toBe("/painel");

  const icon512 = manifest.icons.find((i: { sizes: string; purpose?: string }) => i.sizes === "512x512" && !i.purpose);
  const iconRes = await request.get(icon512.src);
  expect(iconRes.status()).toBe(200);
  expect(iconRes.headers()["content-type"]).toContain("image/png");
});
