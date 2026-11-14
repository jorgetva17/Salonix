/**
 * Converte um valor digitado em reais ("45", "45,50", "1.234,56", "R$ 30") em
 * centavos, sem passar por float. Retorna null se não for um valor válido.
 */
export function parseBRLToCents(input: string): number | null {
  const value = input.replace(/^\s*R\$\s*/i, "").trim();
  let match: RegExpMatchArray | null;
  if (value.includes(",")) {
    // Vírgula decimal; pontos só como separador de milhar.
    match = value.match(/^(\d{1,3}(?:\.\d{3})*|\d+),(\d{1,2})$/);
  } else {
    // Sem vírgula: ponto com 1–2 casas é decimal ("45.50").
    match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  }
  if (!match) return null;
  const reais = Number(match[1].replaceAll(".", ""));
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = reais * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}
