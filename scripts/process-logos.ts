/**
 * Gera as logos padrão com fundo transparente e os ícones do PWA a partir das
 * artes originais (JPEG com fundo sólido) em assets/brand/.
 *
 *   npx tsx scripts/process-logos.ts
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const BRAND = "#1B3B4B";

type Source = {
  file: string;
  out: string;
  /** Faixa vertical onde está o logotipo (descarta o rótulo "#1B3B44" no rodapé da arte dark). */
  rows: [number, number];
};

const SOURCES: Source[] = [
  // Texto azul sobre branco: para o tema claro.
  { file: "assets/brand/Salonix_Dark2.jpeg", out: "public/brand/logo-light.png", rows: [300, 700] },
  // Texto branco sobre azul: para o tema dark e fundos escuros.
  { file: "assets/brand/Salonix_Normal.jpeg", out: "public/brand/logo-dark.png", rows: [300, 700] },
];

/** Distância de cor abaixo da qual o pixel é fundo; acima de FULL, é totalmente opaco. */
const NOISE = 40;
const FULL = 110;

async function removeBackground({ file, out, rows }: Source) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Cor de fundo amostrada no centro da faixa superior (os cantos têm vinheta).
  const sample = (rows[0] * width + Math.floor(width / 2)) * 3;
  const bg = [data[sample], data[sample + 1], data[sample + 2]];
  const rgba = Buffer.alloc(width * height * 4);
  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const o = (y * width + x) * 4;
      const c = [data[i], data[i + 1], data[i + 2]];
      const dist = Math.hypot(c[0] - bg[0], c[1] - bg[1], c[2] - bg[2]);
      let a = y < rows[0] || y > rows[1] || x < 40 || x > width - 40 ? 0 : Math.min(1, Math.max(0, (dist - NOISE) / (FULL - NOISE)));
      if (a > 0) {
        // Remove a mistura com o fundo nas bordas (anti-aliasing), preservando a cor real.
        for (let k = 0; k < 3; k++) {
          rgba[o + k] = Math.round(Math.min(255, Math.max(0, (c[k] - (1 - a) * bg[k]) / a)));
        }
        if (a > 0.5) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      } else {
        a = 0;
      }
      rgba[o + 3] = Math.round(a * 255);
    }
  }

  const pad = 8;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const crop = {
    left,
    top,
    width: Math.min(width, maxX + pad) - left,
    height: Math.min(height, maxY + pad) - top,
  };
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).extract(crop).png().toBuffer();
  await sharp(png).toFile(out);
  console.log(`${out}: ${crop.width}x${crop.height}`);
  return png;
}

async function icon(logo: Buffer, size: number, margin: number, out: string) {
  const inner = Math.round(size * (1 - margin * 2));
  const resized = await sharp(logo).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND } })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(out);
  console.log(`${out}: ${size}x${size}`);
}

async function main() {
  mkdirSync("public/brand", { recursive: true });
  mkdirSync("public/icons", { recursive: true });
  await removeBackground(SOURCES[0]);
  const dark = await removeBackground(SOURCES[1]);

  // Ícones: logotipo branco sobre o azul-petróleo. "maskable" com margem maior (zona segura).
  await icon(dark, 192, 0.06, "public/icons/icon-192.png");
  await icon(dark, 512, 0.06, "public/icons/icon-512.png");
  await icon(dark, 512, 0.12, "public/icons/maskable-512.png");
  await icon(dark, 180, 0.06, "public/icons/apple-touch-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
