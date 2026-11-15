import type { Metadata } from "next";
import { ActionButton } from "@/components/forms/action-button";
import { EquipmentForm, MaintenanceForm } from "@/components/stock/equipment-forms";
import { StockTabs } from "@/components/stock/stock-tabs";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TIMEZONE, formatBRL, isoToZonedLocal } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { EQUIPMENT_STATUS_LABELS, MAINTENANCE_LABELS, maintenanceStatus } from "@/lib/stock";
import { createServerClient } from "@/lib/supabase/server";
import { setEquipmentStatus } from "./actions";

export const metadata: Metadata = { title: "Equipamentos · Salonix" };

const br = (iso: string) => iso.split("-").reverse().join("/");

export default async function EquipamentosPage() {
  const { membership, salon } = await requireRole(["admin", "reception", "professional"]);
  const isAdmin = membership.role === "admin";
  const today = isoToZonedLocal(new Date().toISOString(), salon.timezone || DEFAULT_TIMEZONE).slice(0, 10);
  const supabase = await createServerClient();

  const [{ data: equipment }, { data: maintenance }, { data: costs }, { data: pros }] = await Promise.all([
    supabase.from("equipment").select("*").order("name"),
    supabase.from("equipment_maintenance").select("*").order("performed_on", { ascending: false }),
    isAdmin ? supabase.from("equipment_maintenance_costs").select("*") : Promise.resolve({ data: [] }),
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
  ]);
  const costOf = new Map((costs ?? []).map((c) => [c.maintenance_id, c.cost_cents]));
  const proName = new Map((pros ?? []).map((p) => [p.id, p.name]));
  const professionals = pros ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Equipamentos</h1>
      <StockTabs active="equipamentos" />

      {isAdmin ? (
        <Card><CardHeader><CardTitle>Novo equipamento</CardTitle></CardHeader><CardContent><EquipmentForm professionals={professionals} /></CardContent></Card>
      ) : null}

      {!equipment || equipment.length === 0 ? (
        <EmptyState title="Nenhum equipamento cadastrado" description={isAdmin ? "Cadastre máquinas, secadores, cadeiras…" : undefined} />
      ) : (
        <ul className="grid gap-3">
          {equipment.map((e) => {
            const history = (maintenance ?? []).filter((m) => m.equipment_id === e.id);
            const nextDue = history.map((m) => m.next_due_on).filter((d): d is string => !!d).sort().at(-1) ?? null;
            const ms = maintenanceStatus(nextDue, today);
            return (
              <li key={e.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{e.name} <Badge className="ml-2">{EQUIPMENT_STATUS_LABELS[e.status]}</Badge></p>
                    <p className="text-sm text-muted-foreground">
                      {e.responsible_id ? `Responsável: ${proName.get(e.responsible_id) ?? "—"}` : "Sem responsável"}
                      {nextDue ? ` · próxima manutenção ${br(nextDue)}` : ""}
                    </p>
                    {e.notes ? <p className="text-sm">{e.notes}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ms && ms !== "ok" ? <Badge className={ms === "overdue" ? "bg-destructive/15 text-destructive" : "bg-accent/20 text-foreground"}>{MAINTENANCE_LABELS[ms]}</Badge> : null}
                    {isAdmin ? (["active", "maintenance", "inactive"] as const).filter((s) => s !== e.status).map((s) => (
                      <ActionButton key={s} variant="outline" size="sm" run={() => setEquipmentStatus(e.id, s)} success={`Status: ${EQUIPMENT_STATUS_LABELS[s]}`}>
                        {EQUIPMENT_STATUS_LABELS[s]}
                      </ActionButton>
                    )) : null}
                  </div>
                </div>
                {history.length > 0 ? (
                  <ul className="mt-3 divide-y border-t text-sm">
                    {history.map((m) => (
                      <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                        <span>{br(m.performed_on)} · {m.description}</span>
                        {isAdmin && costOf.has(m.id) ? <span className="text-muted-foreground">{formatBRL(costOf.get(m.id)!)}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {isAdmin ? (
                  <>
                    <details className="mt-2">
                      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">Registrar manutenção</summary>
                      <div className="pt-2"><MaintenanceForm equipmentId={e.id} today={today} /></div>
                    </details>
                    <details>
                      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">Editar equipamento</summary>
                      <div className="pt-2"><EquipmentForm professionals={professionals} equipment={{ id: e.id, name: e.name, responsibleId: e.responsible_id ?? "", notes: e.notes }} /></div>
                    </details>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
