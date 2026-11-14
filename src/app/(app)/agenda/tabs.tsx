import Link from "next/link";
import { cn } from "@/lib/utils";

export function AgendaTabs({ current }: { current: "agenda" | "fila" }) {
  return (
    <nav aria-label="Agenda e fila" className="flex rounded-lg border p-1">
      {(
        [
          ["agenda", "/agenda", "Agenda"],
          ["fila", "/agenda/fila", "Fila"],
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
