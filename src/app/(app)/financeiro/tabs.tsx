import Link from "next/link";
import { cn } from "@/lib/utils";

export type FinanceTab = "comissoes" | "relatorios" | "contas" | "caixas";

export function FinanceTabs({ current }: { current: FinanceTab }) {
  return (
    <nav aria-label="Financeiro" className="flex w-full max-w-full overflow-x-auto rounded-lg border p-1 sm:w-fit">
      {(
        [
          ["relatorios", "/financeiro/relatorios", "Relatórios"],
          ["contas", "/financeiro/contas", "Contas"],
          ["caixas", "/financeiro/caixas", "Caixas"],
          ["comissoes", "/financeiro", "Comissões"],
        ] as const
      ).map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? "page" : undefined}
          className={cn(
            "flex h-9 shrink-0 items-center rounded-md px-4 text-sm",
            current === key && "bg-primary text-primary-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
