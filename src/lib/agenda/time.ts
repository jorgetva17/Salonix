// Datas "YYYY-MM-DD" são dias do calendário do salão; instantes são ISO em UTC.

function localParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Diferença (ms) entre o relógio local e UTC naquele instante. */
function offsetMs(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

function dateUTC(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Instante UTC da meia-noite local de `date`. */
function localMidnight(date: string, timeZone: string): number {
  const guess = dateUTC(date);
  const first = guess - offsetMs(guess, timeZone);
  // Segunda passada acerta dias em que o fuso muda (horário de verão).
  return guess - offsetMs(first, timeZone);
}

export function localDayRange(date: string, timeZone: string): { from: string; to: string } {
  return {
    from: new Date(localMidnight(date, timeZone)).toISOString(),
    to: new Date(localMidnight(addDays(date, 1), timeZone)).toISOString(),
  };
}

/** Minutos desde 00:00 local de `date` (negativo ou ≥ 1440 quando cai em outro dia). */
export function toLocalMinutes(iso: string, date: string, timeZone: string): number {
  const p = localParts(new Date(iso).getTime(), timeZone);
  const days = (Date.UTC(p.year, p.month - 1, p.day) - dateUTC(date)) / 86_400_000;
  return days * 1440 + p.hour * 60 + p.minute;
}

/** 0 = domingo. */
export function weekdayOf(date: string): number {
  return new Date(dateUTC(date)).getUTCDay();
}

export function addDays(date: string, n: number): string {
  return new Date(dateUTC(date) + n * 86_400_000).toISOString().slice(0, 10);
}

export function todayIn(timeZone: string, now: Date = new Date()): string {
  const p = localParts(now.getTime(), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "HH:MM" → minutos. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** minutos → "HH:MM". */
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "YYYY-MM" + n meses. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Início do mês local (`YYYY-MM`) e do seguinte, em ISO UTC. */
export function monthRange(month: string, timeZone: string): { from: string; to: string } {
  return {
    from: new Date(localMidnight(`${month}-01`, timeZone)).toISOString(),
    to: new Date(localMidnight(`${addMonths(month, 1)}-01`, timeZone)).toISOString(),
  };
}
