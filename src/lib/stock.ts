export type StockStatus = "negative" | "out" | "low" | "ok";

/** Alerta de estoque: negativo, zerado, abaixo/igual ao mínimo ou normal. */
export function stockStatus(quantity: number, min: number): StockStatus {
  if (quantity < 0) return "negative";
  if (quantity === 0) return "out";
  if (min > 0 && quantity <= min) return "low";
  return "ok";
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  negative: "Negativo",
  out: "Zerado",
  low: "Estoque baixo",
  ok: "OK",
};

/** "1,5" / "1.5" / "20" -> número com até 3 casas; null se inválido ou negativo. */
export function parseQuantity(input: string): number | null {
  const raw = input.trim().replace(/\s/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return null;
  return Number(normalized);
}

export function formatQuantity(quantity: number, unit = ""): string {
  const text = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(quantity);
  return unit ? `${text} ${unit}` : text;
}

export type MaintenanceStatus = "overdue" | "soon" | "ok";

/** Próxima manutenção: vencida, em até 7 dias ou em dia (datas "YYYY-MM-DD"). */
export function maintenanceStatus(nextDue: string | null, today: string, soonDays = 7): MaintenanceStatus | null {
  if (!nextDue) return null;
  const days = Math.round((Date.parse(nextDue) - Date.parse(today)) / 86400000);
  if (days < 0) return "overdue";
  return days <= soonDays ? "soon" : "ok";
}

export const MAINTENANCE_LABELS: Record<MaintenanceStatus, string> = {
  overdue: "Manutenção vencida",
  soon: "Manutenção próxima",
  ok: "Em dia",
};

export const EQUIPMENT_STATUS_LABELS = { active: "Ativo", maintenance: "Em manutenção", inactive: "Inativo" } as const;
export const MOVEMENT_LABELS: Record<string, string> = { in: "Entrada", out: "Saída", adjust: "Contagem", consumption: "Consumo" };
