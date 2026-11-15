import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveMembership } from "@/lib/salon/active-salon";
import { ROLE_LABELS } from "@/lib/navigation";

export const metadata: Metadata = { title: "Painel · Salonix" };

export default async function PainelPage() {
  const active = await getActiveMembership();
  if (!active) return null;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{active.salon.name}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao Salonix</CardTitle>
          <CardDescription>Você está conectado como {ROLE_LABELS[active.membership.role]}.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          A agenda, o caixa, o estoque e o financeiro chegam nas próximas fases.
        </CardContent>
      </Card>
    </div>
  );
}
