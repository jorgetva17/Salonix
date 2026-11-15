"use client";
import { saveService } from "@/app/(app)/servicos/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";

export type ServiceFormValues = { id: string; name: string; durationMinutes: number; price: string };

export function ServiceForm({ service }: { service?: ServiceFormValues }) {
  return (
    <ActionForm
      action={saveService}
      submitLabel={service ? "Salvar alterações" : "Adicionar serviço"}
      success={service ? "Serviço atualizado" : "Serviço adicionado"}
      resetOnSuccess={!service}
      className="sm:grid-cols-2"
    >
      {(fe) => (
        <>
          {service ? <input type="hidden" name="id" value={service.id} /> : null}
          <div className="sm:col-span-2">
            <Field name="name" label="Nome" defaultValue={service?.name} error={fe("name")} />
          </div>
          <Field name="durationMinutes" label="Duração (minutos)" type="number" inputMode="numeric" min={5} max={600} step={5}
            defaultValue={service?.durationMinutes ?? 30} error={fe("durationMinutes")} />
          <Field name="price" label="Preço (R$)" inputMode="decimal" placeholder="45,00" defaultValue={service?.price} error={fe("price")} />
        </>
      )}
    </ActionForm>
  );
}
