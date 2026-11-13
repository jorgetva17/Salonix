import { TrendingUp } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { requireRole } from "@/lib/salon/active-salon";

export const metadata = { title: "Financeiro · Salonix" };

export default async function Page() {
  await requireRole(["admin", "professional"]);
  return (
    <PagePlaceholder
      title="Financeiro"
      icon={TrendingUp}
      description="Relatórios de faturamento, contas a pagar e comissões chegam em breve."
    />
  );
}
