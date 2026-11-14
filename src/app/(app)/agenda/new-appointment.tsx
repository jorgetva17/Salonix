"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/validation/services";
import { createAppointment, getFreeSlots } from "./actions";

export type ServiceOption = { id: string; name: string; duration_minutes: number; price_cents: number };
export type ProfessionalOption = { id: string; name: string; color: string };

export const selectClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ServiceChecklist({
  services,
  selected,
  onChange,
}: {
  services: ServiceOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {services.map((s) => (
        <li key={s.id}>
          <label className="flex min-h-11 items-center gap-3 px-3">
            <input
              type="checkbox"
              name="serviceIds"
              value={s.id}
              className="size-5 accent-primary"
              checked={selected.includes(s.id)}
              onChange={(e) => onChange(e.target.checked ? [...selected, s.id] : selected.filter((id) => id !== s.id))}
            />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="text-sm text-muted-foreground">
              {formatDuration(s.duration_minutes)} · {formatBRL(s.price_cents)}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function SlotPicker({
  professionalId,
  date,
  durationMinutes,
  value,
  onChange,
  ignoreAppointmentId,
}: {
  professionalId: string;
  date: string;
  durationMinutes: number;
  value: string;
  onChange: (time: string) => void;
  ignoreAppointmentId?: string;
}) {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!professionalId || !date || durationMinutes <= 0) return;
    startLoading(async () => setSlots(await getFreeSlots(professionalId, date, durationMinutes, ignoreAppointmentId)));
  }, [professionalId, date, durationMinutes, ignoreAppointmentId]);

  if (durationMinutes <= 0) return <p className="text-sm text-muted-foreground">Escolha os serviços para ver os horários.</p>;
  if (loading || slots === null) return <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Carregando horários" />;
  if (slots.length === 0) return <p className="text-sm text-muted-foreground">Nenhum horário livre neste dia.</p>;
  return (
    <div role="radiogroup" aria-label="Horários livres" className="flex flex-wrap gap-2">
      {slots.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "h-11 min-w-16 rounded-lg border px-3 text-base tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function NewAppointmentForm({
  services,
  professionals,
  defaultDate,
  defaultProfessionalId,
  onDone,
}: {
  services: ServiceOption[];
  professionals: ProfessionalOption[];
  defaultDate: string;
  defaultProfessionalId: string;
  onDone: () => void;
}) {
  const [state, onSubmit, pending] = useActionForm(createAppointment, null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const duration = services.filter((s) => serviceIds.includes(s.id)).reduce((sum, s) => sum + s.duration_minutes, 0);

  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} noValidate>
      <input type="hidden" name="time" value={time} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.customerId) || undefined}>
          <FieldLabel>Cliente</FieldLabel>
          <CustomerPicker name="customerId" error={errors.customerId} />
        </Field>
        <Field data-invalid={Boolean(errors.serviceIds) || undefined}>
          <FieldLabel>Serviços</FieldLabel>
          <ServiceChecklist
            services={services}
            selected={serviceIds}
            onChange={(ids) => {
              setServiceIds(ids);
              setTime("");
            }}
          />
          {errors.serviceIds && <FieldError>{errors.serviceIds}</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="appointment-professional">Profissional</FieldLabel>
            <select
              id="appointment-professional"
              name="professionalId"
              value={professionalId}
              onChange={(e) => {
                setProfessionalId(e.target.value);
                setTime("");
              }}
              className={selectClass}
            >
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="appointment-date">Data</FieldLabel>
            <Input
              id="appointment-date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTime("");
              }}
              className="h-11 text-base"
            />
          </Field>
        </div>
        <Field data-invalid={Boolean(errors.time) || undefined}>
          <FieldLabel>Horário</FieldLabel>
          <SlotPicker professionalId={professionalId} date={date} durationMinutes={duration} value={time} onChange={setTime} />
          {errors.time && <FieldError>{errors.time}</FieldError>}
        </Field>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 text-base">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Agendar
        </Button>
      </FieldGroup>
    </form>
  );
}

export function NewAppointmentButton(props: {
  services: ServiceOption[];
  professionals: ProfessionalOption[];
  defaultDate: string;
  defaultProfessionalId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="h-11" onClick={() => setOpen(true)} disabled={props.professionals.length === 0}>
        <CalendarPlus aria-hidden />
        Agendar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
          {open && <NewAppointmentForm {...props} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
