"use client";

import { createAppointment, enqueueWalkIn, rescheduleAppointment } from "@/app/(app)/agenda/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { formatBRL } from "@/lib/format";

export type ServiceOption = { id: string; name: string; durationMinutes: number; priceCents: number };
type Option = { id: string; name: string };

function ServiceCheckboxes({ services, error, defaultIds = [] }: { services: ServiceOption[]; error?: string; defaultIds?: string[] }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Serviços</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {services.map((s) => (
          <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-card px-3 text-sm">
            <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={defaultIds.includes(s.id)} className="size-4" />
            <span className="flex-1">{s.name}</span>
            <span className="text-muted-foreground">{s.durationMinutes} min · {formatBRL(s.priceCents)}</span>
          </label>
        ))}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </fieldset>
  );
}

function CustomerPicker({ customers, errors }: { customers: Option[]; errors: { customerId?: string; guestName?: string } }) {
  return (
    <>
      <SelectField name="customerId" label="Cliente cadastrado" placeholder="— escolha ou digite um nome ao lado —"
        options={customers.map((c) => ({ value: c.id, label: c.name }))} error={errors.customerId} />
      <Field name="guestName" label="ou nome do cliente (avulso)" maxLength={80} error={errors.guestName} />
    </>
  );
}

export function AppointmentForm({
  customers,
  professionals,
  services,
  defaults,
}: {
  customers: Option[];
  professionals: Option[];
  services: ServiceOption[];
  defaults?: { startsAt?: string; professionalId?: string; serviceIds?: string[] };
}) {
  return (
    <ActionForm action={createAppointment} submitLabel="Agendar" pendingText="Agendando…" success="Agendamento criado" resetOnSuccess className="sm:grid-cols-2">
      {(fe) => (
        <>
          <CustomerPicker customers={customers} errors={{ customerId: fe("customerId"), guestName: fe("guestName") }} />
          <SelectField name="professionalId" label="Profissional" placeholder="Escolha…" defaultValue={defaults?.professionalId}
            options={professionals.map((p) => ({ value: p.id, label: p.name }))} error={fe("professionalId")} />
          <Field name="startsAt" label="Data e hora" type="datetime-local" step={300} defaultValue={defaults?.startsAt} error={fe("startsAt")} />
          <div className="sm:col-span-2"><ServiceCheckboxes services={services} error={fe("serviceIds")} defaultIds={defaults?.serviceIds} /></div>
          <div className="sm:col-span-2"><Field name="notes" label="Observações (opcional)" maxLength={300} error={fe("notes")} /></div>
        </>
      )}
    </ActionForm>
  );
}

export function WalkInForm({ customers, professionals, services }: { customers: Option[]; professionals: Option[]; services: ServiceOption[] }) {
  return (
    <ActionForm action={enqueueWalkIn} submitLabel="Colocar na fila" pendingText="Registrando…" success="Cliente na fila" resetOnSuccess className="sm:grid-cols-2">
      {(fe) => (
        <>
          <CustomerPicker customers={customers} errors={{ customerId: fe("customerId"), guestName: fe("guestName") }} />
          <div className="sm:col-span-2">
            <SelectField name="professionalId" label="Profissional preferido (opcional)" placeholder="Qualquer um — o primeiro que ficar livre"
              options={professionals.map((p) => ({ value: p.id, label: p.name }))} error={fe("professionalId")} />
          </div>
          <div className="sm:col-span-2"><ServiceCheckboxes services={services} error={fe("serviceIds")} /></div>
        </>
      )}
    </ActionForm>
  );
}

export function RescheduleForm({ id, startsAt, professionalId, professionals }: { id: string; startsAt: string; professionalId: string; professionals: Option[] }) {
  return (
    <ActionForm action={rescheduleAppointment} submitLabel="Reagendar" pendingText="Reagendando…" success="Agendamento reagendado" className="sm:grid-cols-2">
      {(fe) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Field name="startsAt" label="Novo horário" type="datetime-local" step={300} defaultValue={startsAt} error={fe("startsAt")} />
          <SelectField name="professionalId" label="Profissional" defaultValue={professionalId}
            options={professionals.map((p) => ({ value: p.id, label: p.name }))} error={fe("professionalId")} />
        </>
      )}
    </ActionForm>
  );
}
