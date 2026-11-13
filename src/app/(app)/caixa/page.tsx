import { Wallet } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { requireRole } from "@/lib/salon/active-salon";

export const metadata = { title: "Caixa · Salonix" };

export default async function Page() {
  await requireRole(["admin", "reception"]);
  return (
    <PagePlaceholder
      title="Caixa"
      icon={Wallet}
      description="Abertura, recebimentos e fechamento do caixa do dia chegam em breve."
    />
  );
}
