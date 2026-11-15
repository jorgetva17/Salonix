import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TIMEZONE, isoToZonedLocal } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/navigation";
import { getActiveMembership } from "@/lib/salon/active-salon";
import { maintenanceStatus, stockStatus } from "@/lib/stock";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel · Salonix" };

export default async function PainelPage() {
  const active = await getActiveMembership();
  if (!active) return null;
  const supabase = await createServerClient();
  const today = isoToZonedLocal(new Date().toISOString(), active.salon.timezone || DEFAULT_TIMEZONE).slice(0, 10);

  const isAdmin = active.membership.role === "admin";
  const [{ data: items }, { data: maintenance }, { data: overdue }] = await Promise.all([
    supabase.from("inventory_items").select("id, name, quantity, min_quantity").eq("active", true),
    supabase.from("equipment_maintenance").select("equipment_id, next_due_on").not("next_due_on", "is", null),
    isAdmin
      ? supabase.from("transactions").select("id").eq("type", "expense").eq("status", "pending").lt("due_date", today)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const overdueCount = (overdue ?? []).length;
  const stockAlerts = (items ?? []).filter((i) => stockStatus(i.quantity, i.min_quantity) !== "ok");
  const latestDue = new Map<string, string>();
  for (const m of maintenance ?? []) {
    if (m.next_due_on && (!latestDue.has(m.equipment_id) || m.next_due_on > latestDue.get(m.equipment_id)!)) latestDue.set(m.equipment_id, m.next_due_on);
  }
  const maintenanceAlerts = [...latestDue.values()].filter((d) => maintenanceStatus(d, today) !== "ok").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{active.salon.name}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao Salonix</CardTitle>
          <CardDescription>Você está conectado como {ROLE_LABELS[active.membership.role]}.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Use o menu para acessar a agenda, a fila, o caixa e o estoque.</CardContent>
      </Card>
      {stockAlerts.length > 0 || maintenanceAlerts > 0 || overdueCount > 0 ? (
        <Card role="alert" className="border-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-accent" aria-hidden /> Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {stockAlerts.length > 0 ? <p><Link href="/estoque" className="font-medium text-primary underline">{stockAlerts.length} item(ns) com estoque baixo, zerado ou negativo</Link></p> : null}
            {overdueCount > 0 ? <p><Link href="/financeiro/contas" className="font-medium text-primary underline">{overdueCount} conta(s) a pagar vencida(s)</Link></p> : null}
            {maintenanceAlerts > 0 ? <p><Link href="/estoque/equipamentos" className="font-medium text-primary underline">{maintenanceAlerts} equipamento(s) com manutenção vencida ou próxima</Link></p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
