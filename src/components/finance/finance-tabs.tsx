import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/financeiro", label: "Resumo", key: "resumo" },
  { href: "/financeiro/contas", label: "Contas a pagar", key: "contas" },
  { href: "/financeiro/comissoes", label: "Comissões", key: "comissoes" },
] as const;

export function FinanceTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Seções do financeiro" className="flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined}
          className={cn("inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium", active === t.key ? "bg-primary text-primary-foreground" : "border bg-card")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
