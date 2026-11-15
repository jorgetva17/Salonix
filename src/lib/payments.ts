import { parseBRLToCents } from "@/lib/format";
import type { PaymentMethod } from "@/lib/supabase/database.types";

export const METHODS: PaymentMethod[] = ["cash", "debit", "credit", "pix"];

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  debit: "Débito",
  credit: "Crédito",
  pix: "Pix",
};

export type Payment = { method: PaymentMethod; amount_cents: number };

/**
 * Lê os campos "pay_<forma>" do formulário. Campo vazio = não usada.
 * Retorna erro se algum valor for inválido.
 */
export function parsePayments(values: Partial<Record<PaymentMethod, string>>): { ok: true; payments: Payment[] } | { ok: false; error: string; field: PaymentMethod } {
  const payments: Payment[] = [];
  for (const method of METHODS) {
    const raw = (values[method] ?? "").trim();
    if (raw === "") continue;
    const cents = parseBRLToCents(raw);
    if (cents === null) return { ok: false, error: "Informe um valor válido (ex.: 45,00)", field: method };
    if (cents > 0) payments.push({ method, amount_cents: cents });
  }
  return { ok: true, payments };
}

export const sumPayments = (payments: Payment[]) => payments.reduce((n, p) => n + p.amount_cents, 0);

/** Mesma regra do banco: percentual com 2 casas, arredondamento half-up em centavos. */
export function commissionAmount(baseCents: number, percent: number): number {
  const bps = Math.round(percent * 100); // 33,33% -> 3333
  return Math.round((baseCents * bps) / 10000);
}

/** Diferença do fechamento: contado − esperado (negativo = faltou dinheiro). */
export function cashDifference(expected: { cash: number; debit: number; credit: number; pix: number }, counted: { cash: number; debit: number; credit: number; pix: number }): number {
  const total = (v: typeof expected) => v.cash + v.debit + v.credit + v.pix;
  return total(counted) - total(expected);
}
