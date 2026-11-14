import { Scissors } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { ServiceDialog, ServiceRow } from "./services-client";

export const metadata = { title: "Serviços · Salonix" };

export default async function ServicesPage() {
  const { salon } = await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { data: services, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents, active")
    .eq("salon_id", salon.id)
    .order("active", { ascending: false })
    .order("name");
  if (error) throw error;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Serviços</h1>
        <ServiceDialog />
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Nenhum serviço cadastrado"
          description="Cadastre os serviços com duração e preço para usar na agenda e no caixa."
        />
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {services.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
