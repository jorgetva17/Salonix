"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQuantity, type StockUnit } from "@/lib/inventory/quantity";
import { cn } from "@/lib/utils";
import { removeServiceConsumable, saveServiceConsumable } from "../actions";
import { selectClass } from "../inventory-client";

export type ConsumableRow = { id: string; serviceName: string; quantity: number };

export function ConsumablesEditor({
  itemId,
  unit,
  rows,
  services,
  canEdit,
}: {
  itemId: string;
  unit: StockUnit;
  rows: ConsumableRow[];
  services: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) done?.();
      else toast.error(result.error);
    });

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum serviço consome este item.</p>
      ) : (
        <ul className="divide-y text-sm" data-testid="consumables">
          {rows.map((r) => (
            <li key={r.id} className="flex min-h-11 items-center justify-between gap-2">
              <span>
                {r.serviceName} · {formatQuantity(r.quantity, unit)} por atendimento
              </span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Remover ${r.serviceName}`}
                  disabled={pending}
                  onClick={() => act(() => removeServiceConsumable(r.id))}
                >
                  <X aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Serviço que usa o item"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={cn(selectClass, "min-w-40 flex-1")}
          >
            <option value="">Escolha o serviço…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Input
            aria-label={`Quantidade por atendimento (${unit})`}
            placeholder={`Qtd. (${unit})`}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-11 w-28 text-base"
          />
          <Button
            variant="outline"
            className="h-11"
            disabled={!serviceId || !quantity || pending}
            onClick={() =>
              act(
                () => saveServiceConsumable(itemId, serviceId, quantity),
                () => {
                  setServiceId("");
                  setQuantity("");
                },
              )
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
