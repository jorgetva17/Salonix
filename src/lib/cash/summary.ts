import { PAYMENT_METHODS, type PaymentMethod } from "./methods";

export type CashTx = {
  type: "income" | "expense";
  method: PaymentMethod | null;
  status: "pending" | "paid" | "reversed";
  amountCents: number;
  /** Quando o dinheiro entrou/saiu; nulo = nunca recebido (ex.: Pix pendente). */
  paidAt?: string | null;
};

const zero = (): Record<PaymentMethod, number> => ({ cash: 0, debit: 0, credit: 0, pix: 0 });

/**
 * Esperado no caixa por forma: entradas recebidas − saídas pagas, com a abertura no
 * dinheiro. Entrada estornada depois de recebida continua contando (o dinheiro
 * entrou; a saída do estorno é que o tira). O Pix pendente fica à parte, fora do total conferido (mesma regra do
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
    const received = tx.status === "paid" || (tx.type === "income" && tx.status === "reversed" && Boolean(tx.paidAt));
    if (received) expected[tx.method] += tx.type === "income" ? tx.amountCents : -tx.amountCents;
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
