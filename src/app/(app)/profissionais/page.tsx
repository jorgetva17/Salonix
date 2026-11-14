import Link from "next/link";
import { ChevronRight, UserCog } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { NewProfessionalDialog } from "./professionals-client";

export const metadata = { title: "Profissionais · Salonix" };

export default async function ProfessionalsPage() {
  const { salon } = await requireRole(["admin"]);
  const supabase = await createServerClient();
  const { data: professionals, error } = await supabase
    .from("professionals")
    .select("id, name, color, active, user_id, commission_rates(percent, service_id)")
    .eq("salon_id", salon.id)
    .order("active", { ascending: false })
    .order("name");
  if (error) throw error;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Profissionais</h1>
        <NewProfessionalDialog />
      </div>

      {professionals.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Nenhum profissional cadastrado"
          description="Cadastre quem atende para montar a agenda e calcular comissões."
        />
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {professionals.map((p) => {
                const commission = p.commission_rates.find((r) => r.service_id === null)?.percent;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/profissionais/${p.id}`}
                      className="flex min-h-14 items-center gap-3 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{p.name}</span>
                          {!p.active && <Badge variant="outline">inativo</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Comissão {String(commission ?? 0).replace(".", ",")}% ·{" "}
                          {p.user_id ? "Com acesso ao app" : "Sem login"}
                        </p>
                      </div>
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
