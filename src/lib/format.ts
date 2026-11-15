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

/** Converte texto digitado ("35", "35,5", "1.234,56") em centavos; null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const raw = input.replace(/R\$|\s/g, "");
  if (!raw) return null;
  let normalized: string;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(raw)) normalized = raw;
  else normalized = raw.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [reais, cents = ""] = normalized.split(".");
  return Number(reais) * 100 + Number(cents.padEnd(2, "0"));
}

/** Centavos -> texto editável ("35,00"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Link do WhatsApp (assume Brasil quando faltar o 55). */
export function whatsappLink(phone: string, message?: string): string {
  const digits = digitsOnly(phone);
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function formatPhone(phone: string | null): string {
  if (!phone) return "";
  const d = phone.startsWith("55") && phone.length > 11 ? phone.slice(2) : phone;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

/** Interpreta "YYYY-MM-DDTHH:mm" no fuso informado e devolve o instante em ISO (UTC). */
export function zonedLocalToIso(local: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) throw new Error("Data inválida");
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const offsetAt = (t: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  const guess = asUtc - offsetAt(asUtc);
  return new Date(asUtc - offsetAt(guess)).toISOString();
}

/** ISO -> "YYYY-MM-DDTHH:mm" no fuso (para <input type="datetime-local">). */
export function isoToZonedLocal(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
