import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { ActionButton } from "@/components/forms/action-button";
import { InventoryItemForm, ConsumableForm, MovementForm } from "@/components/stock/inventory-forms";
import { StockTabs } from "@/components/stock/stock-tabs";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TIMEZONE, centsToInput, formatBRL, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { MOVEMENT_LABELS, STOCK_STATUS_LABELS, formatQuantity, stockStatus } from "@/lib/stock";
import { createServerClient } from "@/lib/supabase/server";
import { removeConsumable, setInventoryItemActive } from "./actions";

export const metadata: Metadata = { title: "Estoque · Salonix" };

export default async function EstoquePage() {
  const { membership, salon } = await requireRole(["admin", "reception", "professional"]);
  const isAdmin = membership.role === "admin";
  const tz = salon.timezone || DEFAULT_TIMEZONE;
  const supabase = await createServerClient();

  const [{ data: items }, { data: services }, { data: consumables }, { data: movements }] = await Promise.all([
    supabase.from("inventory_items").select("*").order("active", { ascending: false }).order("name"),
    supabase.from("services").select("id, name").eq("active", true).order("name"),
    supabase.from("service_consumables").select("*"),
    isAdmin ? supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(15) : Promise.resolve({ data: [] }),
  ]);
  const nameOf = new Map((items ?? []).map((i) => [i.id, i]));
  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));
  const alerts = (items ?? []).filter((i) => i.active && stockStatus(i.quantity, i.min_quantity) !== "ok");
  const activeItems = (items ?? []).filter((i) => i.active);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Estoque</h1>
      <StockTabs active="estoque" />

      {alerts.length > 0 ? (
        <div role="alert" className="rounded-lg border border-accent bg-accent/10 p-4">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5 text-accent" aria-hidden /> Atenção ao estoque</p>
          <ul className="mt-2 text-sm">
            {alerts.map((i) => (
              <li key={i.id}>{i.name}: {formatQuantity(i.quantity, i.unit)} — {STOCK_STATUS_LABELS[stockStatus(i.quantity, i.min_quantity)]} (mínimo {formatQuantity(i.min_quantity, i.unit)})</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isAdmin ? (
        <Card>
          <CardHeader><CardTitle>Novo item</CardTitle><CardDescription>Cadastre o item e depois registre a primeira entrada de estoque.</CardDescription></CardHeader>
          <CardContent><InventoryItemForm /></CardContent>
        </Card>
      ) : null}

      {!items || items.length === 0 ? (
        <EmptyState title="Nenhum item no estoque" description={isAdmin ? "Cadastre shampoo, lâminas, talco, pomadas para revenda…" : "O administrador ainda não cadastrou itens."} />
      ) : (
        <ul className="grid gap-3">
          {items.map((i) => {
            const st = stockStatus(i.quantity, i.min_quantity);
            return (
              <li key={i.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {i.name} {!i.active ? <Badge className="ml-2">Inativo</Badge> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Em estoque: <strong className={st === "negative" ? "text-destructive" : ""}>{formatQuantity(i.quantity, i.unit)}</strong> · mínimo {formatQuantity(i.min_quantity, i.unit)}
                      {i.sale_price_cents !== null ? ` · venda ${formatBRL(i.sale_price_cents)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {st !== "ok" ? <Badge className="bg-accent/20 text-foreground">{STOCK_STATUS_LABELS[st]}</Badge> : null}
                    {isAdmin ? (
                      <ActionButton variant="outline" size="sm" run={() => setInventoryItemActive(i.id, !i.active)} success={i.active ? "Item desativado" : "Item reativado"}>
                        {i.active ? "Desativar" : "Reativar"}
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
                {isAdmin ? (
                  <>
                    <details className="mt-3">
                      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">Registrar entrada, saída ou contagem</summary>
                      <div className="pt-2"><MovementForm itemId={i.id} unit={i.unit} /></div>
                    </details>
                    <details>
                      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">Editar item</summary>
                      <div className="pt-2">
                        <InventoryItemForm item={{ id: i.id, name: i.name, unit: i.unit, minQuantity: String(i.min_quantity).replace(".", ","), salePrice: i.sale_price_cents !== null ? centsToInput(i.sale_price_cents) : "" }} />
                      </div>
                    </details>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Materiais por serviço</CardTitle>
              <CardDescription>O estoque é baixado automaticamente quando o atendimento é pago (e devolvido no estorno).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(consumables ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum consumo configurado.</p>
              ) : (
                <ul className="divide-y">
                  {(consumables ?? []).map((c) => {
                    const item = nameOf.get(c.item_id);
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span><strong>{serviceName.get(c.service_id) ?? "Serviço"}</strong> usa {formatQuantity(c.quantity, item?.unit)} de {item?.name ?? "item"}</span>
                        <ActionButton variant="ghost" size="sm" run={() => removeConsumable(c.id)} success="Consumo removido">Remover</ActionButton>
                      </li>
                    );
                  })}
                </ul>
              )}
              {(services ?? []).length > 0 && activeItems.length > 0 ? <ConsumableForm services={services ?? []} items={activeItems.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Últimas movimentações</CardTitle></CardHeader>
            <CardContent>
              {(movements ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem movimentações.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {(movements ?? []).map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <Badge>{MOVEMENT_LABELS[m.type] ?? m.type}</Badge> {nameOf.get(m.item_id)?.name ?? "Item"}
                        {m.reason ? <span className="text-muted-foreground"> · {m.reason}</span> : null}
                      </span>
                      <span className="text-muted-foreground">
                        <strong className={m.delta < 0 ? "text-destructive" : ""}>{m.delta > 0 ? "+" : ""}{formatQuantity(m.delta, nameOf.get(m.item_id)?.unit)}</strong> · {formatDateTime(m.created_at, tz)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
