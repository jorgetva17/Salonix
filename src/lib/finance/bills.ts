import { addDays } from "@/lib/agenda/time";

export const BILL_CATEGORIES = ["aluguel", "fornecedor", "manutencao", "salarios", "impostos", "outros"] as const;

export type BillCategory = (typeof BILL_CATEGORIES)[number];

export const BILL_CATEGORY_LABELS: Record<BillCategory, string> = {
  aluguel: "Aluguel",
  fornecedor: "Fornecedor",
  manutencao: "Manutenção",
  salarios: "Salários",
  impostos: "Impostos",
  outros: "Outros",
};

/** Rótulo de qualquer categoria de transação, inclusive as de sistema. */
export const TRANSACTION_CATEGORY_LABELS: Record<string, string> = {
  atendimento: "Atendimento",
  estorno: "Estorno",
  comissao: "Comissão",
  ...BILL_CATEGORY_LABELS,
};

export type BillStatus = "paid" | "cancelled" | "overdue" | "due_soon" | "pending";

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  paid: "Paga",
  cancelled: "Cancelada",
  overdue: "Vencida",
  due_soon: "Vence em breve",
  pending: "Em aberto",
};

/** "Vence em breve" = de hoje até daqui a 7 dias, no dia do salão. */
export function billStatus(bill: { status: string; due_date: string | null }, today: string): BillStatus {
  if (bill.status === "paid") return "paid";
  if (bill.status === "reversed") return "cancelled";
  if (!bill.due_date) return "pending";
  if (bill.due_date < today) return "overdue";
  if (bill.due_date <= addDays(today, 7)) return "due_soon";
  return "pending";
}
