import { shiftDate } from "@/lib/agenda";

export type Period = { from: string; to: string };
export type PeriodPreset = "today" | "7d" | "month" | "last_month";

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function periodFor(preset: PeriodPreset, today: string): Period {
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: shiftDate(today, -6), to: today };
    case "month":
      return { from: `${y}-${pad(m)}-01`, to: shiftDate(`${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`, -1) };
    case "last_month": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { from: `${py}-${pad(pm)}-01`, to: shiftDate(`${y}-${pad(m)}-01`, -1) };
    }
  }
}

/** Período da URL (?de=&ate=) validado; inválido cai no mês atual. Máximo de 366 dias. */
export function parsePeriod(de: unknown, ate: unknown, today: string): Period {
  if (isDate(de) && isDate(ate) && de <= ate && daysBetween(de, ate) <= 366) return { from: de, to: ate };
  return periodFor("month", today);
}

/** Percentual com 1 casa (ex.: 33,3), 0 quando o total é zero. */
export function percentOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

export const EXPENSE_CATEGORIES = ["aluguel", "energia", "agua", "internet", "produtos", "manutencao", "impostos", "salarios", "marketing", "outros"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  aluguel: "Aluguel", energia: "Energia", agua: "Água", internet: "Internet", produtos: "Produtos", manutencao: "Manutenção",
  impostos: "Impostos", salarios: "Salários", marketing: "Marketing", outros: "Outros", refund: "Estorno", commission: "Comissão", service: "Serviço",
};

const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** CSV para Excel pt-BR: separador ";", vírgula decimal, BOM UTF-8, aspas escapadas. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const text = v === null ? "" : String(v);
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}

export const csvMoney = money;

/**
 * Texto livre (nome de cliente, descrição…) exportado para planilha: se começar com = + - @ (ou TAB/CR),
 * o Excel/Sheets executaria como fórmula. Prefixamos com apóstrofo para tratar como texto.
 */
export function csvText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
