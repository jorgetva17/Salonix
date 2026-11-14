"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/methods";
import { remainingCents } from "@/lib/cash/payments";
import { formatBRL } from "@/lib/format";
import { parseBRLToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { receivePayment } from "./actions";

export type PayableAppointment = { id: string; customerName: string; totalCents: number };

type Line = { method: PaymentMethod; amount: string };

const toReais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const NO_CASH = "Abra o caixa antes de receber.";

function MethodPicker({ value, onChange, label }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-4 gap-2">
      {PAYMENT_METHODS.map((m) => (
        <Button
          key={m}
          type="button"
          variant={value === m ? "default" : "outline"}
          aria-pressed={value === m}
          className="h-11"
          onClick={() => onChange(m)}
        >
          {PAYMENT_METHOD_LABELS[m]}
        </Button>
      ))}
    </div>
  );
}

/**
 * Recebimento: Dinheiro vem marcado e o valor é o total com desconto, então são
 * dois toques ("Receber" → "Receber R$ X"). "Dividir pagamento" abre mais linhas.
 */
export function PaymentForm({ appointment, onDone }: { appointment: PayableAppointment; onDone: () => void }) {
  const [state, onSubmit, pending] = useActionForm(receivePayment, null);
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [split, setSplit] = useState<Line[] | null>(null);

  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const discountCents = discount.trim() === "" ? 0 : (parseBRLToCents(discount) ?? 0);
  const dueCents = Math.max(appointment.totalCents - discountCents, 0);
  const lines = split
    ? split.map((l) => ({ method: l.method, amount: l.amount }))
    : dueCents > 0
      ? [{ method, amount: toReais(dueCents) }]
      : [];
  const remaining = remainingCents(
    appointment.totalCents,
    discountCents,
    lines.map((l) => ({ method: l.method, amountCents: parseBRLToCents(l.amount) ?? 0 })),
  );
  const error = state && !state.ok ? state.error : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="appointmentId" value={appointment.id} />
      <input type="hidden" name="payments" value={JSON.stringify(lines)} />
      <p className="flex justify-between text-sm">
        Total dos serviços <span className="tabular-nums">{formatBRL(appointment.totalCents)}</span>
      </p>
      <Field>
        <FieldLabel htmlFor={`discount-${appointment.id}`}>Desconto (R$)</FieldLabel>
        <Input
          id={`discount-${appointment.id}`}
          name="discount"
          inputMode="decimal"
          placeholder="0,00"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          className="h-11 text-base"
        />
      </Field>

      {split ? (
        <div className="flex flex-col gap-3">
          {split.map((line, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
              <MethodPicker
                label={`Forma ${i + 1}`}
                value={line.method}
                onChange={(m) => setSplit(split.map((l, j) => (j === i ? { ...l, method: m } : l)))}
              />
              <div className="flex gap-2">
                <Input
                  aria-label={`Valor ${i + 1} (R$)`}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={line.amount}
                  onChange={(e) => setSplit(split.map((l, j) => (j === i ? { ...l, amount: e.target.value } : l)))}
                  className="h-11 flex-1 text-base"
                />
                {split.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Remover forma ${i + 1}`}
                    onClick={() => setSplit(split.filter((_, j) => j !== i))}
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setSplit([...split, { method: "pix", amount: remaining > 0 ? toReais(remaining) : "" }])}
            >
              <Plus aria-hidden />
              Outra forma
            </Button>
            <span className={cn("text-sm tabular-nums", remaining === 0 ? "text-muted-foreground" : "text-destructive")} data-testid="payment-remaining">
              {remaining === 0 ? "Valor fechado" : remaining > 0 ? `Falta ${formatBRL(remaining)}` : `Sobra ${formatBRL(-remaining)}`}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <MethodPicker label="Forma de pagamento" value={method} onChange={setMethod} />
          <Button
            type="button"
            variant="link"
            className="self-start px-0"
            onClick={() => setSplit([{ method, amount: dueCents > 0 ? toReais(dueCents) : "" }])}
          >
            Dividir pagamento
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          {error === NO_CASH && (
            <Link href="/caixa" className="underline">
              Ir para o caixa
            </Link>
          )}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 text-base">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Receber {formatBRL(dueCents)}
      </Button>
    </form>
  );
}

export function PaymentDialog({ appointment, cashOpen }: { appointment: PayableAppointment; cashOpen: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="h-11" onClick={() => setOpen(true)}>
        Receber
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receber de {appointment.customerName}</DialogTitle>
            {!cashOpen && <DialogDescription className="text-destructive">{NO_CASH}</DialogDescription>}
          </DialogHeader>
          {open && <PaymentForm appointment={appointment} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
