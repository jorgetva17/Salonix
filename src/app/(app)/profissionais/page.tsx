import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProfessionalForm } from "@/components/catalog/professional-forms";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profissionais · Salonix" };

export default async function ProfissionaisPage() {
  const { membership } = await requireRole(["admin", "reception", "professional"]);
  const isAdmin = membership.role === "admin";
  const supabase = await createServerClient();
  const [{ data: professionals }, { data: rates }] = await Promise.all([
    supabase.from("professionals").select("id, name, color, active, user_id").order("active", { ascending: false }).order("name"),
    supabase.from("professional_default_commissions").select("professional_id, commission_percent"),
  ]);
  const rateOf = new Map((rates ?? []).map((r) => [r.professional_id, r.commission_percent]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Profissionais</h1>
      {isAdmin ? (
        <Card>
          <CardHeader><CardTitle>Novo profissional</CardTitle></CardHeader>
          <CardContent><ProfessionalForm /></CardContent>
        </Card>
      ) : null}

      {!professionals || professionals.length === 0 ? (
        <EmptyState title="Nenhum profissional cadastrado" description={isAdmin ? "Adicione o primeiro profissional acima." : "O administrador ainda não cadastrou profissionais."} />
      ) : (
        <ul className="grid gap-3">
          {professionals.map((p) => (
            <li key={p.id}>
              <Link href={`/profissionais/${p.id}`} className="flex min-h-14 items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted">
                <span className="size-4 shrink-0 rounded-full border" style={{ background: p.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {p.name} {!p.active ? <Badge className="ml-2">Inativo</Badge> : null}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {p.user_id ? "Com acesso ao app" : "Sem login"}
                    {rateOf.has(p.id) ? ` · Comissão ${rateOf.get(p.id)}%` : ""}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
