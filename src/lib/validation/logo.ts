export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export type LogoFile = { name: string; type: string; size: number; bytes: Uint8Array };
export type LogoValidation = { ok: true; ext: "png" | "jpg" | "svg" } | { ok: false; error: string };

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

const FORBIDDEN_SVG = [/<script/i, /\son[a-z]+\s*=/i, /javascript:/i, /<foreignObject/i, /<iframe/i, /<embed/i, /<object/i];

/** Valida pelo conteúdo (magic bytes), não pelo nome ou MIME informado. */
export function validateLogoFile(file: LogoFile): LogoValidation {
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "A imagem deve ter no máximo 2 MB." };

  if (startsWith(file.bytes, [0x89, 0x50, 0x4e, 0x47])) return { ok: true, ext: "png" };
  if (startsWith(file.bytes, [0xff, 0xd8, 0xff])) return { ok: true, ext: "jpg" };

  const head = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes.slice(0, 4096));
  if (/<svg[\s>]/i.test(head)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes);
    if (FORBIDDEN_SVG.some((re) => re.test(text))) {
      return { ok: false, error: "SVG com conteúdo não permitido." };
    }
    return { ok: true, ext: "svg" };
  }
  return { ok: false, error: "Formato inválido. Envie PNG, JPG ou SVG." };
}

export const LOGO_CONTENT_TYPES = { png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml" } as const;
