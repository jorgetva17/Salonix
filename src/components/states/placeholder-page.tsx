import { redirect } from "next/navigation";
import { EmptyState } from "@/components/states/empty-state";
import { getNavItems } from "@/lib/navigation";
import { getActiveMembership } from "@/lib/salon/active-salon";

/** Tela provisória: respeita o perfil (sem acesso → volta ao painel). */
export async function PlaceholderPage({ href }: { href: string }) {
  const active = await getActiveMembership();
  if (!active) redirect("/onboarding");
  const item = getNavItems(active.membership.role).find((i) => i.href === href);
  if (!item) redirect("/painel");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{item.label}</h1>
      <EmptyState title="Em breve nesta fase" description="Esta área será liberada nas próximas fases do Salonix." />
    </div>
  );
}
