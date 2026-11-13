import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      {Icon && <Icon className="size-10 text-muted-foreground" aria-hidden />}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
