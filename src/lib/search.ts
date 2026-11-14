/** Mesma normalização de public.search_normalize: sem acento, minúsculas. */
export function normalizeSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Escapa curingas para usar o texto literalmente em LIKE/ILIKE. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
