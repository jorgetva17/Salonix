import Link from "next/link";
import { cn } from "@/lib/utils";

export function StockTabs({ active }: { active: "estoque" | "equipamentos" }) {
  const tab = "inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium";
  return (
    <nav aria-label="Seções" className="flex gap-2">
      <Link href="/estoque" aria-current={active === "estoque" ? "page" : undefined} className={cn(tab, active === "estoque" ? "bg-primary text-primary-foreground" : "border bg-card")}>Estoque</Link>
      <Link href="/estoque/equipamentos" aria-current={active === "equipamentos" ? "page" : undefined} className={cn(tab, active === "equipamentos" ? "bg-primary text-primary-foreground" : "border bg-card")}>Equipamentos</Link>
    </nav>
  );
}
