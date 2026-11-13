export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Intl usa espaço não separável entre "R$" e o valor; normalizamos para espaço comum.
const normalizeSpaces = (value: string) => value.replace(/[  ]/g, " ");

export function formatBRL(cents: number): string {
  return normalizeSpaces(brl.format(cents / 100));
}

function partsFor(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

export function formatDateTime(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = partsFor(iso, timeZone);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function formatTime(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = partsFor(iso, timeZone);
  return `${p.hour}:${p.minute}`;
}
