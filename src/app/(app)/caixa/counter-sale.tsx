"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { selectClass } from "../agenda/new-appointment";
import { createCounterSale } from "./actions";

export type SaleProduct = { id: string; name: string; priceCents: number };

type Line = { productId: string; quantity: string };

function CounterSaleForm({ products, onDone }: { products: SaleProduct[]; onDone: () => void }) {
  const [state, onSubmit, pending] = useActionForm(createCounterSale, null);
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: "1" }]);

  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const price = new Map(products.map((p) => [p.id, p.priceCents]));
  const valid = lines.filter((l) => l.productId && Number.isInteger(Number(l.quantity)) && Number(l.quantity) >= 1);
  const totalCents = valid.reduce((sum, l) => sum + (price.get(l.productId) ?? 0) * Number(l.quantity), 0);
  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(valid.map((l) => ({ inventoryItemId: l.productId, quantity: Number(l.quantity) })))}
      />
      <Field>
        <FieldLabel>Cliente (opcional)</FieldLabel>
        <CustomerPicker name="customerId" />
      </Field>
      <div className="flex flex-col gap-2">
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2">
            <select
              aria-label={`Produto ${i + 1}`}
              value={l.productId}
              onChange={(e) => update(i, { productId: e.target.value })}
              className={cn(selectClass, "min-w-0 flex-1")}
            >
              <option value="">Escolha o produto…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatBRL(p.priceCents)}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Quantidade ${i + 1}`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={l.quantity}
              onChange={(e) => update(i, { quantity: e.target.value })}
              className="h-11 w-16 text-base"
            />
            {lines.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Remover produto ${i + 1}`}
                onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
              >
                <X aria-hidden />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="link"
          className="self-start px-0"
          onClick={() => setLines((ls) => [...ls, { productId: "", quantity: "1" }])}
        >
          <Plus aria-hidden /> Outro produto
        </Button>
      </div>
      <p className="flex justify-between text-lg font-semibold">
        <span>Total</span>
        <span className="tabular-nums" data-testid="sale-total">
          {formatBRL(totalCents)}
        </span>
      </p>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending || valid.length === 0} className="h-12 text-base">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Criar venda
      </Button>
    </form>
  );
}

export function CounterSaleButton({ products }: { products: SaleProduct[] }) {
  const [open, setOpen] = useState(false);
  if (products.length === 0) return null;
  return (
    <>
      <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
        <ShoppingBag aria-hidden /> Venda no balcão
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Venda no balcão</DialogTitle>
          </DialogHeader>
          {open && <CounterSaleForm products={products} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
