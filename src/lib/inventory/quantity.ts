export type StockUnit = "un" | "ml" | "g";

export const UNIT_LABELS: Record<StockUnit, string> = { un: "unidade (un)", ml: "mililitro (ml)", g: "grama (g)" };

/**
 * Converte a quantidade digitada ("2,5", "1.000", "1.000,25", "3") em número,
 * com até 3 casas. Sem vírgula, ponto em grupos de 3 é milhar ("1.000") e
 * outro ponto é decimal ("2.5"). Negativo ou inválido → null.
 */
export function parseQuantity(input: string): number | null {
  const value = input.trim();
  let match: RegExpMatchArray | null;
  if (value.includes(",")) {
    match = value.match(/^(\d{1,3}(?:\.\d{3})*|\d+),(\d{1,3})$/);
  } else {
    match = value.match(/^(\d{1,3}(?:\.\d{3})+|\d+)$/) ?? value.match(/^(\d+)\.(\d{1,3})$/);
  }
  if (!match) return null;
  const whole = Number(match[1].replaceAll(".", ""));
  const thousandths = Number((match[2] ?? "").padEnd(3, "0"));
  const total = whole * 1000 + thousandths;
  return Number.isSafeInteger(total) ? total / 1000 : null;
}

const quantityFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

/** "2,5 ml", "1.000 un", "-5 ml". */
export function formatQuantity(quantity: number, unit: StockUnit): string {
  return `${quantityFormat.format(quantity)} ${unit}`;
}
