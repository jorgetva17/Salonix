"use client";
import { saveCustomer } from "@/app/(app)/clientes/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Label } from "@/components/ui/label";

export type CustomerFormValues = { id: string; name: string; phone: string; notes: string };

export function CustomerForm({ customer }: { customer?: CustomerFormValues }) {
  return (
    <ActionForm
      action={saveCustomer}
      submitLabel={customer ? "Salvar alterações" : "Adicionar cliente"}
      success={customer ? "Cliente atualizado" : "Cliente adicionado"}
      resetOnSuccess={!customer}
      className="sm:grid-cols-2"
    >
      {(fe) => (
        <>
          {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
          <Field name="name" label="Nome" defaultValue={customer?.name} error={fe("name")} />
          <Field name="phone" label="WhatsApp (com DDD)" type="tel" inputMode="tel" placeholder="(85) 99999-0000" defaultValue={customer?.phone} error={fe("phone")} />
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <textarea id="notes" name="notes" rows={2} defaultValue={customer?.notes}
              className="rounded-md border border-input bg-card px-3 py-2 text-base md:text-sm" />
            {fe("notes") ? <p role="alert" className="text-sm text-destructive">{fe("notes")}</p> : null}
          </div>
        </>
      )}
    </ActionForm>
  );
}
