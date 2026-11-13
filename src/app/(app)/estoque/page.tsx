import { Package } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { requireRole } from "@/lib/salon/active-salon";

export const metadata = { title: "Estoque · Salonix" };

export default async function Page() {
  await requireRole();
  return (
    <PagePlaceholder
      title="Estoque"
      icon={Package}
      description="Produtos, estoque mínimo e equipamentos chegam em breve."
    />
  );
}
