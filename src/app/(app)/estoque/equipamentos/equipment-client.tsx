"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUSES, type EquipmentStatus } from "@/lib/equipment/status";
import { addMaintenance, deleteMaintenance, saveEquipment, setEquipmentStatus } from "./actions";
import { selectClass } from "../inventory-client";

export type EquipmentData = {
  id: string;
  name: string;
  status: EquipmentStatus;
  professional_id: string | null;
  notes: string | null;
};

type Option = { id: string; name: string };

function EquipmentForm({ equipment, professionals, onDone }: { equipment?: EquipmentData; professionals: Option[]; onDone: () => void }) {
  const [state, onSubmit, pending] = useActionForm(saveEquipment, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const prefix = equipment ? `equipment-${equipment.id}` : "equipment-new";
  return (
    <form onSubmit={onSubmit} noValidate>
      {equipment && <input type="hidden" name="id" value={equipment.id} />}
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor={`${prefix}-name`}>Nome</FieldLabel>
          <Input id={`${prefix}-name`} name="name" defaultValue={equipment?.name} className="h-11 text-base" />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor={`${prefix}-status`}>Status</FieldLabel>
            <select id={`${prefix}-status`} name="status" defaultValue={equipment?.status ?? "active"} className={selectClass}>
              {EQUIPMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EQUIPMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${prefix}-professional`}>Responsável</FieldLabel>
            <select
              id={`${prefix}-professional`}
              name="professionalId"
              defaultValue={equipment?.professional_id ?? ""}
              className={selectClass}
            >
              <option value="">Ninguém</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field data-invalid={Boolean(errors.notes) || undefined}>
          <FieldLabel htmlFor={`${prefix}-notes`}>Observação</FieldLabel>
          <Input id={`${prefix}-notes`} name="notes" defaultValue={equipment?.notes ?? ""} className="h-11 text-base" />
          {errors.notes && <FieldError>{errors.notes}</FieldError>}
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

export function EquipmentDialog({ equipment, professionals }: { equipment?: EquipmentData; professionals: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={equipment ? "outline" : "default"} className="h-11" onClick={() => setOpen(true)}>
        {equipment ? "Editar" : "Novo equipamento"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{equipment ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
          </DialogHeader>
          {open && <EquipmentForm equipment={equipment} professionals={professionals} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EquipmentStatusSelect({ id, name, status }: { id: string; name: string; status: EquipmentStatus }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={`Status de ${name}`}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const result = await setEquipmentStatus(id, next);
          if (!result.ok) toast.error(result.error);
        });
      }}
      className={selectClass}
    >
      {EQUIPMENT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {EQUIPMENT_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export function MaintenanceForm({ equipmentId, today }: { equipmentId: string; today: string }) {
  const [state, onSubmit, pending] = useActionForm(addMaintenance, null);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  const prefix = `maintenance-${equipmentId}`;
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate>
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.description) || undefined}>
          <FieldLabel htmlFor={`${prefix}-description`}>Descrição</FieldLabel>
          <Input id={`${prefix}-description`} name="description" className="h-11 text-base" />
          {errors.description && <FieldError>{errors.description}</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field data-invalid={Boolean(errors.performedOn) || undefined}>
            <FieldLabel htmlFor={`${prefix}-date`}>Data</FieldLabel>
            <Input id={`${prefix}-date`} name="performedOn" type="date" defaultValue={today} className="h-11 text-base" />
            {errors.performedOn && <FieldError>{errors.performedOn}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.cost) || undefined}>
            <FieldLabel htmlFor={`${prefix}-cost`}>Custo (R$)</FieldLabel>
            <Input id={`${prefix}-cost`} name="cost" inputMode="decimal" placeholder="0,00" className="h-11 text-base" />
            {errors.cost && <FieldError>{errors.cost}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.nextDue) || undefined}>
            <FieldLabel htmlFor={`${prefix}-next`}>Próxima manutenção</FieldLabel>
            <Input id={`${prefix}-next`} name="nextDue" type="date" className="h-11 text-base" />
            {errors.nextDue && <FieldError>{errors.nextDue}</FieldError>}
          </Field>
        </div>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 text-base">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Registrar manutenção
        </Button>
      </FieldGroup>
    </form>
  );
}

export function DeleteMaintenanceButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11"
      aria-label={`Remover manutenção ${label}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteMaintenance(id);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      <X aria-hidden />
    </Button>
  );
}
