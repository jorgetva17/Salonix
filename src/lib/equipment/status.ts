import { addDays } from "@/lib/agenda/time";

export type MaintenanceStatus = "overdue" | "soon" | "ok";

export const MAINTENANCE_LABELS: Record<MaintenanceStatus, string> = {
  overdue: "Manutenção atrasada",
  soon: "Manutenção próxima",
  ok: "Em dia",
};

export const EQUIPMENT_STATUSES = ["active", "maintenance", "inactive"] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  active: "Em uso",
  maintenance: "Em manutenção",
  inactive: "Inativo",
};

/** Datas YYYY-MM-DD no fuso do salão: passou = atrasada; até 7 dias = próxima. */
export function maintenanceStatus(nextDue: string | null, today: string): MaintenanceStatus | null {
  if (!nextDue) return null;
  if (nextDue < today) return "overdue";
  if (nextDue <= addDays(today, 7)) return "soon";
  return "ok";
}
