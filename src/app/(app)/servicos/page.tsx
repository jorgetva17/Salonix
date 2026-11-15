import type { Metadata } from "next";
import { ServiceForm } from "@/components/catalog/service-form";
import { ActionButton } from "@/components/forms/action-button";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { centsToInput, formatBRL } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { setServiceActive } from "./actions";

export const metadata: Metadata = { title: "Serviços · Salonix" };

export default async function ServicosPage() {
  const { membership } = await requireRole(["admin", "reception", "professional"]);
  const isAdmin = membership.role === "admin";
  const supabase = await createServerClient();
  const { data: services } = await supabase.from("services").select("*").order("active", { ascending: false }).order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Serviços</h1>
      {isAdmin ? (
        <Card>
          <CardHeader><CardTitle>Novo serviço</CardTitle></CardHeader>
          <CardContent><ServiceForm /></CardContent>
        </Card>
      ) : null}

      {!services || services.length === 0 ? (
        <EmptyState title="Nenhum serviço cadastrado" description={isAdmin ? "Adicione o primeiro serviço acima (ex.: Corte, Barba)." : "O administrador ainda não cadastrou serviços."} />
      ) : (
        <ul className="grid gap-3">
          {services.map((s) => (
            <li key={s.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.name} {!s.active ? <Badge className="ml-2">Inativo</Badge> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">{s.duration_minutes} min · {formatBRL(s.price_cents)}</p>
                </div>
                {isAdmin ? (
                  <ActionButton variant="outline" run={() => setServiceActive(s.id, !s.active).then((r) => r)} success={s.active ? "Serviço desativado" : "Serviço reativado"}>
                    {s.active ? "Desativar" : "Reativar"}
                  </ActionButton>
                ) : null}
              </div>
              {isAdmin ? (
                <details className="mt-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">Editar</summary>
                  <div className="pt-2">
                    <ServiceForm service={{ id: s.id, name: s.name, durationMinutes: s.duration_minutes, price: centsToInput(s.price_cents) }} />
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
