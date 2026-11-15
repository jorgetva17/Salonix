import Link from "next/link";
import { cn } from "@/lib/utils";

export function StockTabs({ current }: { current: "estoque" | "equipamentos" }) {
  return (
    <nav aria-label="Estoque e equipamentos" className="flex w-fit rounded-lg border p-1">
      {(
        [
          ["estoque", "/estoque", "Estoque"],
          ["equipamentos", "/estoque/equipamentos", "Equipamentos"],
        ] as const
      ).map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? "page" : undefined}
          className={cn("flex h-9 items-center rounded-md px-4 text-sm", current === key && "bg-primary text-primary-foreground")}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
