"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/phone";
import { deleteCustomer, saveCustomer } from "./actions";

export type CustomerData = { id: string; name: string; phone: string | null; notes: string | null };

function CustomerForm({ customer, onDone }: { customer?: CustomerData; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveCustomer, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const prefix = customer ? `customer-${customer.id}` : "customer-new";
  return (
    <form action={action} noValidate>
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor={`${prefix}-name`}>Nome</FieldLabel>
          <Input id={`${prefix}-name`} name="name" defaultValue={customer?.name} className="h-11 text-base" />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.phone) || undefined}>
          <FieldLabel htmlFor={`${prefix}-phone`}>WhatsApp (opcional)</FieldLabel>
          <Input
            id={`${prefix}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="(11) 98888-7777"
            defaultValue={customer?.phone ? formatPhone(customer.phone) : ""}
            className="h-11 text-base"
          />
          {errors.phone && <FieldError>{errors.phone}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.notes) || undefined}>
          <FieldLabel htmlFor={`${prefix}-notes`}>Observações (opcional)</FieldLabel>
          <textarea
            id={`${prefix}-notes`}
            name="notes"
            rows={3}
            maxLength={500}
            defaultValue={customer?.notes ?? ""}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {errors.notes && <FieldError>{errors.notes}</FieldError>}
        </Field>
        {state && !state.ok && !errors.phone && (
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

function DeleteCustomer({ customer, onDone }: { customer: CustomerData; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return (
      <Button variant="ghost" className="h-11 text-destructive" onClick={() => setConfirming(true)}>
        Excluir cliente
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-3">
      <p className="text-sm">Excluir {customer.name}? Isso não pode ser desfeito.</p>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          className="h-11"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteCustomer(customer.id);
              if (result.ok) {
                toast.success("Cliente excluído");
                onDone();
              } else {
                toast.error(result.error);
              }
            })
          }
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Confirmar exclusão
        </Button>
        <Button variant="outline" className="h-11" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function CustomerDialog({ customer, canDelete = false }: { customer?: CustomerData; canDelete?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={customer ? "outline" : "default"}
        className="h-11"
        onClick={() => setOpen(true)}
        aria-label={customer ? `Editar ${customer.name}` : undefined}
      >
        {customer ? "Editar" : "Novo cliente"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{customer ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="flex flex-col gap-4">
              <CustomerForm customer={customer} onDone={() => setOpen(false)} />
              {customer && canDelete && <DeleteCustomer customer={customer} onDone={() => setOpen(false)} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
