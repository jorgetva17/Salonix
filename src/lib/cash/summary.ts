import { PAYMENT_METHODS, type PaymentMethod } from "./methods";

export type CashTx = {
  type: "income" | "expense";
  method: PaymentMethod | null;
  status: "pending" | "paid" | "reversed";
  amountCents: number;
};

const zero = (): Record<PaymentMethod, number> => ({ cash: 0, debit: 0, credit: 0, pix: 0 });

/**
 * Esperado no caixa por forma: entradas pagas − saídas pagas, com a abertura no
 * dinheiro. O Pix pendente fica à parte, fora do total conferido (mesma regra do
 * `cash_session_expected` no banco, que é o que vale no fechamento).
 */
export function cashSummary(
  openingCents: number,
  txs: CashTx[],
): { expected: Record<PaymentMethod, number>; pixPendingCents: number; totalExpectedCents: number } {
  const expected = zero();
  expected.cash = openingCents;
  let pixPendingCents = 0;
  for (const tx of txs) {
    if (!tx.method) continue;
    if (tx.status === "paid") expected[tx.method] += tx.type === "income" ? tx.amountCents : -tx.amountCents;
    else if (tx.status === "pending" && tx.method === "pix" && tx.type === "income") pixPendingCents += tx.amountCents;
  }
  const totalExpectedCents = PAYMENT_METHODS.reduce((sum, m) => sum + expected[m], 0);
  return { expected, pixPendingCents, totalExpectedCents };
}

/** Contado − esperado, por forma e no total; forma não informada conta como 0. */
export function closingDifference(
  expected: Record<PaymentMethod, number>,
  counted: Partial<Record<PaymentMethod, number>>,
): { byMethod: Record<PaymentMethod, number>; totalCents: number } {
  const byMethod = zero();
  for (const m of PAYMENT_METHODS) byMethod[m] = (counted[m] ?? 0) - expected[m];
  return { byMethod, totalCents: PAYMENT_METHODS.reduce((sum, m) => sum + byMethod[m], 0) };
}
