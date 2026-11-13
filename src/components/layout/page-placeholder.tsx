import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

/** Página de módulo ainda não construído (fases seguintes do MVP). */
export function PagePlaceholder({ title, icon, description }: { title: string; icon: LucideIcon; description: string }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <EmptyState icon={icon} title="Em construção" description={description} />
    </div>
  );
}
