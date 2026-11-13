import { describe, expect, it } from "vitest";
import { MAX_LOGO_BYTES, validateLogoFile } from "@/lib/validation/logo";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(32).fill(0)]);
const text = (s: string) => new TextEncoder().encode(s);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PDF = text("%PDF-1.7 ...");
const SVG = text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');

describe("validateLogoFile", () => {
  it("aceita PNG pelo conteúdo", () => {
    expect(validateLogoFile({ name: "logo.png", type: "image/png", size: 1000, bytes: PNG })).toEqual({
      ok: true,
      ext: "png",
      contentType: "image/png",
    });
  });
  it("aceita JPG", () => {
    expect(validateLogoFile({ name: "logo.jpeg", type: "image/jpeg", size: 1000, bytes: JPG })).toMatchObject({
      ok: true,
      ext: "jpg",
    });
  });
  it("aceita SVG sem scripts", () => {
    expect(validateLogoFile({ name: "logo.svg", type: "image/svg+xml", size: 500, bytes: SVG })).toMatchObject({
      ok: true,
      ext: "svg",
    });
  });
  it("rejeita PDF renomeado para .png", () => {
    expect(validateLogoFile({ name: "logo.png", type: "image/png", size: 1000, bytes: PDF })).toEqual({
      ok: false,
      error: "Formato inválido. Envie PNG, JPG ou SVG.",
    });
  });
  it("rejeita arquivo maior que 2 MB", () => {
    expect(validateLogoFile({ name: "logo.png", type: "image/png", size: MAX_LOGO_BYTES + 1, bytes: PNG })).toEqual({
      ok: false,
      error: "A imagem deve ter no máximo 2 MB.",
    });
  });
  it("rejeita arquivo vazio", () => {
    expect(validateLogoFile({ name: "logo.png", type: "image/png", size: 0, bytes: new Uint8Array() })).toEqual({
      ok: false,
      error: "Escolha uma imagem.",
    });
  });
  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe/></foreignObject></svg>',
  ])("rejeita SVG com conteúdo ativo: %s", (svg) => {
    expect(validateLogoFile({ name: "logo.svg", type: "image/svg+xml", size: svg.length, bytes: text(svg) })).toEqual({
      ok: false,
      error: "SVG com conteúdo não permitido.",
    });
  });
});
