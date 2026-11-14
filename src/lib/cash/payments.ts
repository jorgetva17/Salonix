import type { PaymentMethod } from "./methods";

export type PaymentLine = { method: PaymentMethod; amountCents: number };

/**
 * A mesma conferência do `receive_payment` no banco, para avisar antes de enviar:
 * desconto entre 0 e o total, cada linha com valor positivo e a soma fechando
 * total − desconto. Devolve a mensagem de erro ou null.
 */
export function paymentProblem(totalCents: number, discountCents: number, lines: PaymentLine[]): string | null {
  if (discountCents < 0 || discountCents > totalCents) return "Desconto maior que o total.";
  if (lines.some((l) => !Number.isSafeInteger(l.amountCents) || l.amountCents <= 0)) return "Valor pago não confere com o total.";
  return remainingCents(totalCents, discountCents, lines) === 0 ? null : "Valor pago não confere com o total.";
}

/** Quanto falta (positivo) ou sobra (negativo) para fechar o total com desconto. */
export function remainingCents(totalCents: number, discountCents: number, lines: PaymentLine[]): number {
  return totalCents - discountCents - lines.reduce((sum, l) => sum + l.amountCents, 0);
}
