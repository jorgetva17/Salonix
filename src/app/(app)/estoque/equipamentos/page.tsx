import { Wrench } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayIn } from "@/lib/agenda/time";
import { EQUIPMENT_STATUS_LABELS, MAINTENANCE_LABELS, maintenanceStatus, type EquipmentStatus } from "@/lib/equipment/status";
import { formatBRL } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { StockTabs } from "../tabs";
import { DeleteMaintenanceButton, EquipmentDialog, EquipmentStatusSelect, MaintenanceForm } from "./equipment-client";

export const metadata = { title: "Equipamentos · Salonix" };

/** "2026-11-20" → "20/11/2026". */
const formatDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

export default async function EquipmentPage() {
  const { salon, membership } = await requireRole();
  const isAdmin = membership.role === "admin";
  const today = todayIn(salon.timezone);
  const supabase = await createServerClient();

  const [{ data, error }, { data: professionals, error: e2 }] = await Promise.all([
    supabase
      .from("equipment")
      .select("id, name, status, professional_id, notes, professionals(name), equipment_maintenance(id, performed_on, description, cost_cents, next_due, created_at)")
      .eq("salon_id", salon.id)
      .order("name"),
    supabase.from("professionals").select("id, name").eq("salon_id", salon.id).eq("active", true).order("name"),
  ]);
  if (error || e2) throw error ?? e2;

  const list = data.map((e) => {
    const history = [...e.equipment_maintenance].sort(
      (a, b) => b.performed_on.localeCompare(a.performed_on) || b.created_at.localeCompare(a.created_at),
    );
    // O aviso vem da próxima data da manutenção mais recente; inativo não avisa.
    const last = history[0];
    const alert = e.status === "inactive" ? null : maintenanceStatus(last?.next_due ?? null, today);
    return { ...e, status: e.status as EquipmentStatus, history, last, alert };
  });
  const attention = list.filter((e) => e.alert === "overdue" || e.alert === "soon").length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Equipamentos</h1>
        {isAdmin && <EquipmentDialog professionals={professionals} />}
      </div>
      <StockTabs current="equipamentos" />

      {list.length === 0 ? (
        <EmptyState icon={Wrench} title="Nenhum equipamento" description="Cadastre máquinas e cadeiras para acompanhar as manutenções." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-testid="equipment-summary">
            {attention} com manutenção atrasada ou próxima
          </p>
          {list.map((e) => (
            <Card key={e.id} data-testid={`equipment-${e.name}`}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {e.name}
                  {e.alert && e.alert !== "ok" && (
                    <Badge variant={e.alert === "overdue" ? "destructive" : "secondary"} data-testid="maintenance-status">
                      {MAINTENANCE_LABELS[e.alert]}
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  <span data-testid="equipment-status">{EQUIPMENT_STATUS_LABELS[e.status]}</span>
                  {e.professionals?.name && ` · Responsável: ${e.professionals.name}`}
                  {e.last && ` · Última manutenção ${formatDay(e.last.performed_on)}`}
                  {e.last?.next_due && ` · Próxima ${formatDay(e.last.next_due)}`}
                </p>
                {e.notes && <p className="text-sm">{e.notes}</p>}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <div className="min-w-40 flex-1">
                      <EquipmentStatusSelect id={e.id} name={e.name} status={e.status} />
                    </div>
                    <EquipmentDialog
                      equipment={{ id: e.id, name: e.name, status: e.status, professional_id: e.professional_id, notes: e.notes }}
                      professionals={professionals}
                    />
                  </div>
                )}
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Manutenções ({e.history.length})</summary>
                  <div className="flex flex-col gap-4">
                    {e.history.length > 0 && (
                      <ul className="divide-y text-sm" data-testid="maintenance-history">
                        {e.history.map((m) => (
                          <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                            <span className="min-w-0">
                              {formatDay(m.performed_on)} · {m.description} · {formatBRL(m.cost_cents)}
                              {m.next_due && <span className="text-muted-foreground"> · próxima {formatDay(m.next_due)}</span>}
                            </span>
                            {isAdmin && <DeleteMaintenanceButton id={m.id} label={`${formatDay(m.performed_on)} ${m.description}`} />}
                          </li>
                        ))}
                      </ul>
                    )}
                    {isAdmin && <MaintenanceForm equipmentId={e.id} today={today} />}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
