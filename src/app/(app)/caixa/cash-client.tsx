"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/methods";
import { closingDifference } from "@/lib/cash/summary";
import { formatBRL } from "@/lib/format";
import { parseBRLToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { closeCashSession, confirmPix, openCashSession } from "./actions";

export function OpenCashForm() {
  const [state, onSubmit, pending] = useActionForm(openCashSession, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok && "message" in state) toast.success(state.message);
  }, [state]);

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.opening) || undefined}>
          <FieldLabel htmlFor="opening">Valor inicial em dinheiro (R$)</FieldLabel>
          <Input id="opening" name="opening" inputMode="decimal" placeholder="0,00" className="h-11 text-base" />
          {errors.opening && <FieldError>{errors.opening}</FieldError>}
        </Field>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 text-base">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Abrir caixa
        </Button>
      </FieldGroup>
    </form>
  );
}

const signed = (cents: number) => (cents > 0 ? `+${formatBRL(cents)}` : formatBRL(cents));
const tone = (cents: number) => (cents === 0 ? "text-muted-foreground" : cents > 0 ? "text-emerald-600" : "text-destructive");

export function CloseCashForm({ expected }: { expected: Record<PaymentMethod, number> }) {
  const [state, onSubmit, pending] = useActionForm(closeCashSession, null);
  const [counted, setCounted] = useState<Record<PaymentMethod, string>>({ cash: "", debit: "", credit: "", pix: "" });
  const [confirming, setConfirming] = useState(false);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok && "message" in state) toast.success(state.message);
  }, [state]);

  // Diferença ao vivo enquanto digita; o valor gravado é o calculado no banco.
  const countedCents = Object.fromEntries(
    PAYMENT_METHODS.map((m) => [m, counted[m].trim() === "" ? 0 : (parseBRLToCents(counted[m]) ?? 0)]),
  ) as Record<PaymentMethod, number>;
  const diff = closingDifference(expected, countedCents);

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {PAYMENT_METHODS.map((m) => (
          <Field key={m} data-invalid={Boolean(errors[m]) || undefined}>
            <FieldLabel htmlFor={`counted-${m}`}>{PAYMENT_METHOD_LABELS[m]} contado (R$)</FieldLabel>
            <div className="flex items-center gap-3">
              <Input
                id={`counted-${m}`}
                name={m}
                inputMode="decimal"
                placeholder="0,00"
                value={counted[m]}
                onChange={(e) => setCounted({ ...counted, [m]: e.target.value })}
                className="h-11 flex-1 text-base"
              />
              <span className={cn("w-28 text-right text-sm tabular-nums", tone(diff.byMethod[m]))}>{signed(diff.byMethod[m])}</span>
            </div>
            {errors[m] && <FieldError>{errors[m]}</FieldError>}
          </Field>
        ))}
        <p className="flex justify-between font-medium">
          Diferença total
          <span className={cn("tabular-nums", tone(diff.totalCents))} data-testid="closing-difference">
            {signed(diff.totalCents)}
          </span>
        </p>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {confirming ? (
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="h-11 flex-1 text-base">
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Confirmar fechamento
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => setConfirming(false)}>
              Voltar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="h-11 text-base" onClick={() => setConfirming(true)}>
            Fechar caixa
          </Button>
        )}
      </FieldGroup>
    </form>
  );
}

export function ConfirmPixButton({ transactionId }: { transactionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await confirmPix(transactionId);
          if (result.ok) toast.success("Pix confirmado");
          else toast.error(result.error);
        })
      }
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      Confirmar Pix
    </Button>
  );
}
