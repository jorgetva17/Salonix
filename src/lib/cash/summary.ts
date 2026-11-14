import { PAYMENT_METHODS, type PaymentMethod } from "./methods";

/** Contado − esperado, por forma e no total; forma não informada conta como 0. */
export function closingDifference(
  expected: Record<PaymentMethod, number>,
  counted: Partial<Record<PaymentMethod, number>>,
): { byMethod: Record<PaymentMethod, number>; totalCents: number } {
  const byMethod: Record<PaymentMethod, number> = { cash: 0, debit: 0, credit: 0, pix: 0 };
  for (const m of PAYMENT_METHODS) byMethod[m] = (counted[m] ?? 0) - expected[m];
  return { byMethod, totalCents: PAYMENT_METHODS.reduce((sum, m) => sum + byMethod[m], 0) };
}
