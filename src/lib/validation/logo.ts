export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export type LogoExt = "png" | "jpg" | "svg";

type LogoFile = { name: string; type: string; size: number; bytes: Uint8Array };

type Result = { ok: true; ext: LogoExt; contentType: string } | { ok: false; error: string };

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);

// Conteúdo ativo em SVG: scripts, handlers de evento, URLs javascript:, HTML embutido.
const ACTIVE_SVG = /<script|\bon[a-z]+\s*=|javascript:|<foreignObject|<iframe|<embed|<object/i;

/** Valida a logo pelo conteúdo real (não confia em extensão nem em MIME do navegador). */
export function validateLogoFile(file: LogoFile): Result {
  if (file.size === 0 || file.bytes.length === 0) return { ok: false, error: "Escolha uma imagem." };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "A imagem deve ter no máximo 2 MB." };

  if (startsWith(file.bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, ext: "png", contentType: "image/png" };
  }
  if (startsWith(file.bytes, [0xff, 0xd8, 0xff])) {
    return { ok: true, ext: "jpg", contentType: "image/jpeg" };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes).trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(text)) {
    if (ACTIVE_SVG.test(text)) return { ok: false, error: "SVG com conteúdo não permitido." };
    return { ok: true, ext: "svg", contentType: "image/svg+xml" };
  }

  return { ok: false, error: "Formato inválido. Envie PNG, JPG ou SVG." };
}
