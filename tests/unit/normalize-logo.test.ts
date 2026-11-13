// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeLogo } from "@/lib/salon/normalize-logo";

const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

describe("normalizeLogo", () => {
  it("converte SVG em PNG (nenhum SVG é armazenado)", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="#1B3B4B"/></svg>',
    );
    const out = await normalizeLogo(svg);
    expect(isPng(out)).toBe(true);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBeGreaterThanOrEqual(200);
  });

  it("converte JPG em PNG e limita o tamanho", async () => {
    const jpg = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#ffffff" } })
      .jpeg()
      .toBuffer();
    const out = await normalizeLogo(jpg);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBeLessThanOrEqual(1200);
  });

  it("rejeita conteúdo que não é imagem", async () => {
    await expect(normalizeLogo(Buffer.from("%PDF-1.7"))).rejects.toThrow();
  });
});
