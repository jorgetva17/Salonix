"use client";
import {
  addBlock,
  addSchedule,
  saveProfessional,
  setCommissionOverride,
} from "@/app/(app)/profissionais/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { Label } from "@/components/ui/label";
import { WEEKDAYS } from "@/lib/format";

export type ProfessionalFormValues = { id: string; name: string; color: string; commissionPercent: string };

export function ProfessionalForm({ professional }: { professional?: ProfessionalFormValues }) {
  return (
    <ActionForm
      action={saveProfessional}
      submitLabel={professional ? "Salvar alterações" : "Adicionar profissional"}
      success={professional ? "Profissional atualizado" : "Profissional adicionado"}
      resetOnSuccess={!professional}
      className="sm:grid-cols-2"
    >
      {(fe) => (
        <>
          {professional ? <input type="hidden" name="id" value={professional.id} /> : null}
          <div className="sm:col-span-2">
            <Field name="name" label="Nome" defaultValue={professional?.name} error={fe("name")} />
          </div>
          <Field name="commissionPercent" label="Comissão padrão (%)" inputMode="decimal" placeholder="40"
            defaultValue={professional?.commissionPercent ?? "0"} error={fe("commissionPercent")} />
          <div className="grid gap-1.5">
            <Label htmlFor="color">Cor na agenda</Label>
            <input id="color" name="color" type="color" defaultValue={professional?.color ?? "#1B3B4B"}
              className="min-h-11 w-full cursor-pointer rounded-md border border-input bg-card p-1" />
            {fe("color") ? <p role="alert" className="text-sm text-destructive">{fe("color")}</p> : null}
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function ScheduleForm({ professionalId }: { professionalId: string }) {
  return (
    <ActionForm action={addSchedule} submitLabel="Adicionar horário" success="Horário adicionado" resetOnSuccess className="sm:grid-cols-3">
      {(fe) => (
        <>
          <input type="hidden" name="professionalId" value={professionalId} />
          <SelectField name="weekday" label="Dia" defaultValue="1" options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} error={fe("weekday")} />
          <Field name="startTime" label="Início" type="time" defaultValue="09:00" error={fe("startTime")} />
          <Field name="endTime" label="Fim" type="time" defaultValue="18:00" error={fe("endTime")} />
        </>
      )}
    </ActionForm>
  );
}

export function BlockForm({ professionalId }: { professionalId: string }) {
  return (
    <ActionForm action={addBlock} submitLabel="Adicionar bloqueio" success="Bloqueio adicionado" resetOnSuccess className="sm:grid-cols-2">
      {(fe) => (
        <>
          <input type="hidden" name="professionalId" value={professionalId} />
          <Field name="startsAt" label="Início" type="datetime-local" error={fe("startsAt")} />
          <Field name="endsAt" label="Fim" type="datetime-local" error={fe("endsAt")} />
          <div className="sm:col-span-2">
            <Field name="reason" label="Motivo (folga, férias, almoço…)" maxLength={120} error={fe("reason")} />
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function CommissionForm({ professionalId, services }: { professionalId: string; services: { id: string; name: string }[] }) {
  return (
    <ActionForm action={setCommissionOverride} submitLabel="Salvar comissão" success="Comissão salva" resetOnSuccess className="sm:grid-cols-2">
      {(fe) => (
        <>
          <input type="hidden" name="professionalId" value={professionalId} />
          <SelectField name="serviceId" label="Serviço" placeholder="Escolha…" options={services.map((s) => ({ value: s.id, label: s.name }))} error={fe("serviceId")} />
          <Field name="percent" label="Comissão (%)" inputMode="decimal" placeholder="50" error={fe("percent")} />
        </>
      )}
    </ActionForm>
  );
}
