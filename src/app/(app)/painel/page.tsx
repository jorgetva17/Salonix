import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/salon/active-salon";

export const metadata = { title: "Painel · Salonix" };

export default async function DashboardPage() {
  const { salon, membership } = await requireRole();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{salon.name}</h1>
      <EmptyState
        icon={LayoutDashboard}
        title="O resumo do dia aparece aqui"
        description="Atendimentos, fila de espera e caixa do dia vão aparecer neste painel assim que a agenda estiver no ar."
        action={
          membership.role === "admin" ? (
            <Link href="/equipe" className={buttonVariants({ className: "h-11 px-4 text-base" })}>
              Convidar equipe
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
