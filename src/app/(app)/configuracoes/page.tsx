import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { requireRole } from "@/lib/salon/active-salon";

export const metadata = { title: "Configurações · Salonix" };

export default async function Page() {
  await requireRole(["admin"]);
  return (
    <PagePlaceholder
      title="Configurações"
      icon={Settings}
      description="Dados do salão e personalização chegam em breve."
    />
  );
}
