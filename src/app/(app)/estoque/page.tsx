import Link from "next/link";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { formatQuantity, type StockUnit } from "@/lib/inventory/quantity";
import { stockStatus } from "@/lib/inventory/status";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ItemDialog, StockStatusBadge } from "./inventory-client";
import { StockTabs } from "./tabs";

export const metadata = { title: "Estoque · Salonix" };

type SearchParams = { alertas?: string; inativos?: string };

export default async function StockPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { salon, membership } = await requireRole();
  const isAdmin = membership.role === "admin";
  const params = await searchParams;
  const onlyAlerts = params.alertas === "1";
  const showInactive = params.inativos === "1";

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, unit, quantity, min_quantity, sale_price_cents, active")
    .eq("salon_id", salon.id)
    .order("name");
  if (error) throw error;

  const items = data.map((i) => ({ ...i, unit: i.unit as StockUnit, status: stockStatus(i.quantity, i.min_quantity) }));
  const active = items.filter((i) => i.active);
  const low = active.filter((i) => i.status === "low").length;
  const negative = active.filter((i) => i.status === "negative").length;
  const visible = items.filter((i) => (showInactive || i.active) && (!onlyAlerts || i.status !== "ok"));

  const href = (next: SearchParams) => {
    const q = new URLSearchParams();
    if (next.alertas === "1") q.set("alertas", "1");
    if (next.inativos === "1") q.set("inativos", "1");
    const s = q.toString();
    return s ? `/estoque?${s}` : "/estoque";
  };
  const toggleClass = (on: boolean) => cn(buttonVariants({ variant: on ? "secondary" : "outline" }), "h-11");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Estoque</h1>
        {isAdmin && <ItemDialog />}
      </div>
      <StockTabs current="estoque" />

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum item no estoque"
          description="Cadastre produtos e materiais para acompanhar saldo, consumo e vendas."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm text-muted-foreground" data-testid="stock-summary">
              {low} abaixo do mínimo · {negative} negativos
            </p>
            <Link href={href({ ...params, alertas: onlyAlerts ? undefined : "1" })} className={toggleClass(onlyAlerts)}>
              Só alertas
            </Link>
            <Link href={href({ ...params, inativos: showInactive ? undefined : "1" })} className={toggleClass(showInactive)}>
              Mostrar inativos
            </Link>
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={Package} title="Nenhum item com alerta" description="Todos os itens estão acima do mínimo." />
          ) : (
            <Card>
              <CardContent>
                <ul className="divide-y">
                  {visible.map((i) => (
                    <li key={i.id} data-testid={`stock-item-${i.name}`}>
                      <Link href={`/estoque/${i.id}`} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium">{i.name}</span>
                            {!i.active && <Badge variant="outline">inativo</Badge>}
                            {i.active && <StockStatusBadge status={i.status} />}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Mínimo {formatQuantity(i.min_quantity, i.unit)} · Venda{" "}
                            {i.sale_price_cents === null ? "—" : formatBRL(i.sale_price_cents)}
                          </span>
                        </span>
                        <span className="text-lg font-semibold tabular-nums" data-testid="stock-quantity">
                          {formatQuantity(i.quantity, i.unit)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
