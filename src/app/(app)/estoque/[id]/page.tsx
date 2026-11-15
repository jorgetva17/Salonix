import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayIn } from "@/lib/agenda/time";
import { formatBRL, formatDateTime } from "@/lib/format";
import { formatQuantity, type StockUnit } from "@/lib/inventory/quantity";
import { MOVEMENT_LABELS, stockStatus } from "@/lib/inventory/status";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { ItemActiveButton, ItemDialog, StockStatusBadge } from "../inventory-client";
import { ConsumablesEditor } from "./consumables-client";
import { MovementForm } from "./movement-form";

export const metadata = { title: "Item de estoque · Salonix" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StockItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { salon, membership } = await requireRole();
  const isAdmin = membership.role === "admin";
  const tz = salon.timezone;
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerClient();
  const { data: item, error } = await supabase
    .from("inventory_items")
    .select("id, name, unit, quantity, min_quantity, unit_cost_cents, sale_price_cents, active")
    .eq("id", id)
    .eq("salon_id", salon.id)
    .maybeSingle();
  if (error) throw error;
  if (!item) notFound();

  // O atendimento ligado ao movimento passa pela RLS: o profissional só vê os dele.
  const { data: movements, error: e2 } = await supabase
    .from("stock_movements")
    .select("id, type, quantity, reason, created_at, reverses_id, appointments(kind, starts_at, arrived_at, customers(name))")
    .eq("inventory_item_id", item.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const [{ data: consumables, error: e3 }, { data: services, error: e4 }] = await Promise.all([
    supabase
      .from("service_consumables")
      .select("id, quantity, services(name)")
      .eq("inventory_item_id", item.id)
      .order("created_at"),
    supabase.from("services").select("id, name").eq("salon_id", salon.id).eq("active", true).order("name"),
  ]);
  if (e2 || e3 || e4) throw e2 ?? e3 ?? e4;

  const unit = item.unit as StockUnit;
  const status = stockStatus(item.quantity, item.min_quantity);
  const signed = (q: number) => (q > 0 ? `+${formatQuantity(q, unit)}` : formatQuantity(q, unit));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-20 md:pb-0">
      <Link href="/estoque" className="flex min-h-11 w-fit items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Estoque
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{item.name}</h1>
          {!item.active && <Badge variant="outline">inativo</Badge>}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <ItemDialog item={{ ...item, unit }} />
            <ItemActiveButton id={item.id} active={item.active} />
          </div>
        )}
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Saldo</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold tabular-nums" data-testid="item-quantity">
                  {formatQuantity(item.quantity, unit)}
                </span>
                <StockStatusBadge status={status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mínimo</dt>
              <dd className="text-lg tabular-nums">{formatQuantity(item.min_quantity, unit)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Custo por {unit}</dt>
              <dd className="text-lg tabular-nums">{formatBRL(item.unit_cost_cents)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Preço de venda</dt>
              <dd className="text-lg tabular-nums">{item.sale_price_cents === null ? "—" : formatBRL(item.sale_price_cents)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {isAdmin && item.active && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar movimento</CardTitle>
          </CardHeader>
          <CardContent>
            <MovementForm itemId={item.id} unit={unit} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Usado nos serviços</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsumablesEditor
            itemId={item.id}
            unit={unit}
            rows={consumables.map((c) => ({ id: c.id, serviceName: c.services?.name ?? "", quantity: c.quantity }))}
            services={services}
            canEdit={isAdmin && item.active}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum movimento ainda.</p>
          ) : (
            <ul className="divide-y text-sm" data-testid="movements">
              {movements.map((m) => {
                const a = m.appointments;
                const when = a?.starts_at ?? a?.arrived_at;
                const customer = a?.customers?.name;
                const origin = a
                  ? a.kind === "sale"
                    ? `Venda no balcão${customer ? ` · ${customer}` : ""}`
                    : `Atendimento${customer ? ` · ${customer}` : ""}`
                  : null;
                return (
                  <li key={m.id} className="py-2" data-testid="movement">
                    <span className="font-medium">
                      {m.reverses_id ? "Devolução" : MOVEMENT_LABELS[m.type]} {signed(m.quantity)}
                    </span>
                    <span className="block text-muted-foreground">
                      {formatDateTime(m.created_at, tz)}
                      {m.reason && ` · ${m.reason}`}
                      {origin && " · "}
                      {origin &&
                        (a?.kind !== "sale" && when ? (
                          <Link href={`/agenda?data=${todayIn(tz, new Date(when))}`} className="underline">
                            {origin}
                          </Link>
                        ) : (
                          origin
                        ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
