import { describe, expect, it } from "vitest";
import { validateLogoFile } from "@/lib/validation/logo";

const enc = (s: string) => new TextEncoder().encode(s);
const file = (name: string, bytes: Uint8Array, size = bytes.length) => ({ name, type: "", size, bytes });

describe("validateLogoFile", () => {
  it("aceita PNG válido", () => {
    expect(validateLogoFile(file("logo.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])))).toEqual({ ok: true, ext: "png" });
  });
  it("aceita JPG válido", () => {
    expect(validateLogoFile(file("logo.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])))).toEqual({ ok: true, ext: "jpg" });
  });
  it("rejeita PDF renomeado para .png", () => {
    expect(validateLogoFile(file("logo.png", enc("%PDF-1.7 ...")))).toEqual({ ok: false, error: "Formato inválido. Envie PNG, JPG ou SVG." });
  });
  it("rejeita arquivo de 3 MB", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(validateLogoFile(file("grande.png", png, 3 * 1024 * 1024))).toEqual({ ok: false, error: "A imagem deve ter no máximo 2 MB." });
  });
  it("aceita SVG limpo", () => {
    expect(validateLogoFile(file("l.svg", enc('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>')))).toEqual({ ok: true, ext: "svg" });
  });
  it.each([
    ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'],
    ['<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"/></svg>'],
  ])("rejeita SVG com conteúdo ativo", (svg) => {
    expect(validateLogoFile(file("x.svg", enc(svg)))).toEqual({ ok: false, error: "SVG com conteúdo não permitido." });
  });
});
