/**
 * Gera as logos padrão (PNG transparente) e os ícones do PWA a partir dos JPEGs
 * originais em assets/brand/. Uso: npx tsx scripts/process-logos.ts
 *
 * Atenção: os nomes dos arquivos de origem estão trocados de propósito —
 *   Salonix_Dark2.jpeg  = texto azul sobre fundo branco  -> tema CLARO
 *   Salonix_Normal.jpeg = texto branco sobre fundo azul  -> tema DARK
 */
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..");
const BRAND = path.join(ROOT, "assets/brand");
const PUBLIC = path.join(ROOT, "public");

type Region = { left: number; top: number; width: number; height: number };
type Rgb = [number, number, number];

/** Remove o fundo por distância de cor (alpha suavizado) e recorta o logotipo. */
async function cutout(
  file: string,
  region: Region,
  opts: { recolor?: Rgb; padding?: number; erase?: (x: number, y: number) => boolean } = {},
) {
  const { data, info } = await sharp(file)
    .extract(region)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bg: Rgb = [data[0], data[1], data[2]]; // cor do canto
  const out = Buffer.from(data);
  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const dist = Math.max(
        Math.abs(data[i] - bg[0]),
        Math.abs(data[i + 1] - bg[1]),
        Math.abs(data[i + 2] - bg[2]),
      );
      const alpha = Math.max(0, Math.min(255, Math.round(((dist - 22) / 70) * 255)));
      out[i + 3] = opts.erase?.(x, y) ? 0 : alpha;
      if (opts.recolor) {
        out[i] = opts.recolor[0];
        out[i + 1] = opts.recolor[1];
        out[i + 2] = opts.recolor[2];
      }
      if (out[i + 3] > 60) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  const pad = opts.padding ?? 12;
  const box = {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(info.width, maxX + pad) - Math.max(0, minX - pad),
    height: Math.min(info.height, maxY + pad) - Math.max(0, minY - pad),
  };
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(box)
    .png()
    .toBuffer();
}

async function icon(symbol: Buffer, size: number, innerRatio: number, file: string) {
  const inner = Math.round(size * innerRatio);
  const resized = await sharp(symbol)
    .resize({ width: inner, height: inner, fit: "inside" })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#1B3B4B" } })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(path.join(PUBLIC, "icons", file));
}

async function main() {
  // Tema claro: logo azul/âmbar sobre fundo branco.
  const light = await cutout(path.join(BRAND, "Salonix_Dark2.jpeg"), { left: 200, top: 340, width: 640, height: 330 });
  await sharp(light).resize({ width: 800, withoutEnlargement: true }).png().toFile(path.join(PUBLIC, "brand/logo-light.png"));

  // Tema dark: logo branco sobre fundo azul (exclui o texto "#1B3B44" do rodapé).
  const dark = await cutout(path.join(BRAND, "Salonix_Normal.jpeg"), { left: 100, top: 400, width: 830, height: 200 }, { recolor: [255, 255, 255] });
  await sharp(dark).resize({ width: 800, withoutEnlargement: true }).png().toFile(path.join(PUBLIC, "brand/logo-dark.png"));

  // Símbolo (navalha + tesoura) em branco para os ícones do app.
  const symbol = await cutout(path.join(BRAND, "Salonix_Dark2.jpeg"), { left: 418, top: 375, width: 202, height: 265 }, {
    recolor: [255, 255, 255],
    padding: 4,
    // apaga as letras vizinhas ("l" à esquerda e "n" à direita) na faixa de texto
    erase: (x, y) => y >= 55 && y <= 175 && (x <= 38 || (x >= 138 && y >= 80)),
  });
  await icon(symbol, 192, 0.8, "icon-192.png");
  await icon(symbol, 512, 0.8, "icon-512.png");
  await icon(symbol, 512, 0.6, "maskable-512.png");
  await icon(symbol, 180, 0.8, "apple-touch-icon.png");
  console.log("Logos e ícones gerados.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
