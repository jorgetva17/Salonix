"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import { formatDuration } from "@/lib/validation/services";
import { saveService, setServiceActive } from "./actions";

export type ServiceRowData = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
};

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

function ServiceForm({ service, onDone }: { service?: ServiceRowData; onDone: () => void }) {
  const [state, onSubmit, pending] = useActionForm(saveService, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const prefix = service ? `service-${service.id}` : "service-new";
  return (
    <form onSubmit={onSubmit} noValidate>
      {service && <input type="hidden" name="id" value={service.id} />}
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor={`${prefix}-name`}>Nome</FieldLabel>
          <Input id={`${prefix}-name`} name="name" defaultValue={service?.name} className="h-11 text-base" />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={Boolean(errors.durationMinutes) || undefined}>
            <FieldLabel htmlFor={`${prefix}-duration`}>Duração (min)</FieldLabel>
            <Input
              id={`${prefix}-duration`}
              name="durationMinutes"
              type="number"
              inputMode="numeric"
              min={5}
              max={480}
              step={5}
              defaultValue={service?.duration_minutes ?? 30}
              className="h-11 text-base"
            />
            {errors.durationMinutes && <FieldError>{errors.durationMinutes}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.price) || undefined}>
            <FieldLabel htmlFor={`${prefix}-price`}>Preço (R$)</FieldLabel>
            <Input
              id={`${prefix}-price`}
              name="price"
              inputMode="decimal"
              placeholder="45,00"
              defaultValue={service ? centsToInput(service.price_cents) : ""}
              className="h-11 text-base"
            />
            {errors.price && <FieldError>{errors.price}</FieldError>}
          </Field>
        </div>
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

export function ServiceDialog({ service }: { service?: ServiceRowData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={service ? "outline" : "default"}
        className="h-11"
        onClick={() => setOpen(true)}
        aria-label={service ? `Editar ${service.name}` : undefined}
      >
        {service ? "Editar" : "Novo serviço"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>
          {open && <ServiceForm service={service} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ServiceRow({ service }: { service: ServiceRowData }) {
  const [pending, startTransition] = useTransition();
  const toggle = () =>
    startTransition(async () => {
      const result = await setServiceActive(service.id, !service.active);
      if (result.ok) toast.success(service.active ? "Serviço desativado" : "Serviço reativado");
      else toast.error(result.error);
    });

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center" data-testid="service-row">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{service.name}</span>
          {!service.active && <Badge variant="outline">inativo</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDuration(service.duration_minutes)} · {formatBRL(service.price_cents)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ServiceDialog service={service} />
        <Button variant={service.active ? "ghost" : "secondary"} className="h-11" disabled={pending} onClick={toggle}>
          {service.active ? "Desativar" : "Reativar"}
        </Button>
      </div>
    </li>
  );
}
