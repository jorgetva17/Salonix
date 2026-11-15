export type StockStatus = "negative" | "low" | "ok";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  negative: "Estoque negativo",
  low: "Abaixo do mínimo",
  ok: "OK",
};

export function stockStatus(quantity: number, min: number): StockStatus {
  if (quantity < 0) return "negative";
  if (quantity < min) return "low";
  return "ok";
}

export const MOVEMENT_LABELS: Record<string, string> = {
  in: "Entrada",
  out: "Saída",
  adjust: "Ajuste",
  consumption: "Consumo",
};
