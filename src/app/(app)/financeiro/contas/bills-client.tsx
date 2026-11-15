"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/methods";
import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from "@/lib/finance/bills";
import { ConfirmBox } from "../../agenda/appointment-sheet";
import { selectClass } from "../../estoque/inventory-client";
import { cancelBill, payBill, saveBill } from "./actions";

function BillForm({ today, onDone }: { today: string; onDone: () => void }) {
  const [state, onSubmit, pending] = useActionForm(saveBill, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.category) || undefined}>
          <FieldLabel htmlFor="bill-category">Categoria</FieldLabel>
          <select id="bill-category" name="category" defaultValue="aluguel" className={selectClass}>
            {BILL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BILL_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          {errors.category && <FieldError>{errors.category}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.description) || undefined}>
          <FieldLabel htmlFor="bill-description">Descrição</FieldLabel>
          <Input id="bill-description" name="description" maxLength={200} className="h-11 text-base" />
          {errors.description && <FieldError>{errors.description}</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={Boolean(errors.amount) || undefined}>
            <FieldLabel htmlFor="bill-amount">Valor (R$)</FieldLabel>
            <Input id="bill-amount" name="amount" inputMode="decimal" placeholder="0,00" className="h-11 text-base" />
            {errors.amount && <FieldError>{errors.amount}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.dueDate) || undefined}>
            <FieldLabel htmlFor="bill-due">Vencimento</FieldLabel>
            <Input id="bill-due" name="dueDate" type="date" defaultValue={today} className="h-11 text-base" />
            {errors.dueDate && <FieldError>{errors.dueDate}</FieldError>}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="bill-paid">Já paga em</FieldLabel>
          <select id="bill-paid" name="paidMethod" defaultValue="" className={selectClass}>
            <option value="">Ainda não paga</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">Em dinheiro, o valor sai do caixa aberto.</p>
        </Field>
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

export function BillDialog({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="h-11" onClick={() => setOpen(true)}>
        Nova conta
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova conta</DialogTitle>
          </DialogHeader>
          {open && <BillForm today={today} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Pagar (escolhendo a forma) ou cancelar uma conta em aberto. */
export function BillActions({ id }: { id: string }) {
  const [mode, setMode] = useState<"idle" | "pay" | "cancel">("idle");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [pending, startTransition] = useTransition();

  if (mode === "idle") {
    return (
      <div className="flex gap-2">
        <Button variant="outline" className="h-11" onClick={() => setMode("pay")}>
          Pagar
        </Button>
        <Button variant="ghost" className="h-11" onClick={() => setMode("cancel")}>
          Cancelar
        </Button>
      </div>
    );
  }
  if (mode === "cancel") {
    return (
      <div className="w-full">
        <ConfirmBox
          message="Cancelar esta conta? Ela continua no histórico como cancelada."
          withReason={false}
          confirmLabel="Cancelar conta"
          pending={pending}
          onBack={() => setMode("idle")}
          onConfirm={() =>
            startTransition(async () => {
              const result = await cancelBill(id);
              if (result.ok) toast.success("Conta cancelada.");
              else toast.error(result.error);
            })
          }
        />
      </div>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-end gap-2 rounded-lg border p-3">
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
        Forma de pagamento
        <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={selectClass}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <Button
        className="h-11"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await payBill(id, method);
            if (result.ok) toast.success("Conta paga.");
            else toast.error(result.error);
          })
        }
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Confirmar pagamento
      </Button>
      <Button variant="ghost" className="h-11" onClick={() => setMode("idle")}>
        Voltar
      </Button>
    </div>
  );
}
