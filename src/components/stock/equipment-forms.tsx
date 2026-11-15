"use client";

import { addMaintenance, saveEquipment } from "@/app/(app)/estoque/equipamentos/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";

export function EquipmentForm({ professionals, equipment }: { professionals: { id: string; name: string }[]; equipment?: { id: string; name: string; responsibleId: string; notes: string } }) {
  return (
    <ActionForm action={saveEquipment} submitLabel={equipment ? "Salvar alterações" : "Adicionar equipamento"} success={equipment ? "Equipamento atualizado" : "Equipamento adicionado"} resetOnSuccess={!equipment} className="sm:grid-cols-2">
      {(fe) => (
        <>
          {equipment ? <input type="hidden" name="id" value={equipment.id} /> : null}
          <Field name="name" label="Nome" defaultValue={equipment?.name} error={fe("name")} />
          <SelectField name="responsibleId" label="Responsável (opcional)" placeholder="Ninguém" defaultValue={equipment?.responsibleId}
            options={professionals.map((p) => ({ value: p.id, label: p.name }))} error={fe("responsibleId")} />
          <div className="sm:col-span-2"><Field name="notes" label="Observações" defaultValue={equipment?.notes} maxLength={300} error={fe("notes")} /></div>
        </>
      )}
    </ActionForm>
  );
}

export function MaintenanceForm({ equipmentId, today }: { equipmentId: string; today: string }) {
  return (
    <ActionForm action={addMaintenance} submitLabel="Registrar manutenção" pendingText="Registrando…" success="Manutenção registrada" resetOnSuccess className="sm:grid-cols-2">
      {(fe) => (
        <>
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <div className="sm:col-span-2"><Field name="description" label="O que foi feito" error={fe("description")} /></div>
          <Field name="performedOn" label="Realizada em" type="date" defaultValue={today} error={fe("performedOn")} />
          <Field name="nextDueOn" label="Próxima manutenção (opcional)" type="date" error={fe("nextDueOn")} />
          <Field name="cost" label="Custo (R$, opcional)" inputMode="decimal" placeholder="80,00" error={fe("cost")} />
        </>
      )}
    </ActionForm>
  );
}
