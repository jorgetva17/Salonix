"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UNIT_LABELS, type StockUnit } from "@/lib/inventory/quantity";
import { STOCK_STATUS_LABELS, type StockStatus } from "@/lib/inventory/status";
import { saveInventoryItem, setInventoryItemActive } from "./actions";

export const selectClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export type InventoryItemData = {
  id: string;
  name: string;
  unit: StockUnit;
  min_quantity: number;
  unit_cost_cents: number;
  sale_price_cents: number | null;
  active: boolean;
};

const centsToInput = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","));
const quantityToInput = (q: number) => String(q).replace(".", ",");

export function StockStatusBadge({ status }: { status: StockStatus }) {
  if (status === "ok") return null;
  return (
    <Badge variant={status === "negative" ? "destructive" : "secondary"} data-testid="stock-status">
      {STOCK_STATUS_LABELS[status]}
    </Badge>
  );
}

function ItemForm({ item, onDone }: { item?: InventoryItemData; onDone: () => void }) {
  const [state, onSubmit, pending] = useActionForm(saveInventoryItem, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const prefix = item ? `item-${item.id}` : "item-new";
  return (
    <form onSubmit={onSubmit} noValidate>
      {item && <input type="hidden" name="id" value={item.id} />}
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor={`${prefix}-name`}>Nome</FieldLabel>
          <Input id={`${prefix}-name`} name="name" defaultValue={item?.name} className="h-11 text-base" />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={Boolean(errors.unit) || undefined}>
            <FieldLabel htmlFor={`${prefix}-unit`}>Unidade</FieldLabel>
            <select id={`${prefix}-unit`} name="unit" defaultValue={item?.unit ?? "un"} className={selectClass}>
              {(Object.keys(UNIT_LABELS) as StockUnit[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
            {errors.unit && <FieldError>{errors.unit}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.minQuantity) || undefined}>
            <FieldLabel htmlFor={`${prefix}-min`}>Estoque mínimo</FieldLabel>
            <Input
              id={`${prefix}-min`}
              name="minQuantity"
              inputMode="decimal"
              defaultValue={item ? quantityToInput(item.min_quantity) : "0"}
              className="h-11 text-base"
            />
            {errors.minQuantity && <FieldError>{errors.minQuantity}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.unitCost) || undefined}>
            <FieldLabel htmlFor={`${prefix}-cost`}>Custo por unidade (R$)</FieldLabel>
            <Input
              id={`${prefix}-cost`}
              name="unitCost"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={item ? centsToInput(item.unit_cost_cents) : ""}
              className="h-11 text-base"
            />
            {errors.unitCost && <FieldError>{errors.unitCost}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.salePrice) || undefined}>
            <FieldLabel htmlFor={`${prefix}-sale`}>Preço de venda (R$)</FieldLabel>
            <Input
              id={`${prefix}-sale`}
              name="salePrice"
              inputMode="decimal"
              placeholder="Não vende"
              defaultValue={item ? centsToInput(item.sale_price_cents) : ""}
              className="h-11 text-base"
            />
            {errors.salePrice && <FieldError>{errors.salePrice}</FieldError>}
          </Field>
        </div>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 text-base">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Salvar
        </Button>
      </FieldGroup>
    </form>
  );
}

export function ItemDialog({ item }: { item?: InventoryItemData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={item ? "outline" : "default"} className="h-11" onClick={() => setOpen(true)}>
        {item ? "Editar" : "Novo item"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle>
          </DialogHeader>
          {open && <ItemForm item={item} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ItemActiveButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const toggle = () =>
    startTransition(async () => {
      const result = await setInventoryItemActive(id, !active);
      if (result.ok) toast.success(active ? "Item desativado" : "Item reativado");
      else toast.error(result.error);
    });
  return (
    <Button variant={active ? "ghost" : "secondary"} className="h-11" disabled={pending} onClick={toggle}>
      {active ? "Desativar" : "Ativar"}
    </Button>
  );
}
