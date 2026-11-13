import "server-only";
import sharp from "sharp";

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 600;

/**
 * Re-renderiza qualquer logo aceita (PNG, JPG ou SVG) como PNG. O SVG é
 * rasterizado (scripts nunca executam) e o arquivo original é descartado.
 */
export async function normalizeLogo(input: Uint8Array): Promise<Buffer> {
  return sharp(input, { density: 300, limitInputPixels: 40_000_000 })
    .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}
