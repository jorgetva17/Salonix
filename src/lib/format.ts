export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const normalizeSpaces = (value: string) => value.replace(/[  ]/g, " ");

/** Formata um valor em centavos (inteiro) como moeda BRL. */
export function formatBRL(cents: number): string {
  return normalizeSpaces(currency.format(cents / 100));
}

export function formatDateTime(
  iso: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

export function formatTime(
  iso: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return normalizeSpaces(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}
