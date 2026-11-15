import { addDays, addMonths } from "@/lib/agenda/time";

export type Period = { from: string; to: string };

/** Mesmo limite do finance_report: até 366 dias, contando o primeiro e o último. */
const MAX_DAYS = 366;

/** `YYYY-MM-DD` que existe no calendário. */
export function isDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Uma data inexistente (30/02) muda ao passar pelo Date.
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const daysBetween = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

function monthOf(month: string): Period {
  return { from: `${month}-01`, to: addDays(`${addMonths(month, 1)}-01`, -1) };
}

/** Período da URL (`?de=&ate=`); qualquer coisa inválida vira o mês de hoje. */
export function resolvePeriod(params: { de?: string; ate?: string }, today: string): Period {
  const { de, ate } = params;
  if (isDate(de) && isDate(ate) && de <= ate && daysBetween(de, ate) < MAX_DAYS) return { from: de, to: ate };
  return monthOf(today.slice(0, 7));
}

export function PERIOD_PRESETS(today: string): ({ label: string } & Period)[] {
  const month = today.slice(0, 7);
  return [
    { label: "Hoje", from: today, to: today },
    { label: "Este mês", ...monthOf(month) },
    { label: "Mês passado", ...monthOf(addMonths(month, -1)) },
    { label: "Últimos 30 dias", from: addDays(today, -29), to: today },
  ];
}
