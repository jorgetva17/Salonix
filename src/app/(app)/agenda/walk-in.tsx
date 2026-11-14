"use client";

import { useEffect, useState } from "react";
import { DoorOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { enqueueWalkIn } from "./actions";
import { selectClass, ServiceChecklist, type ProfessionalOption, type ServiceOption } from "./new-appointment";

function WalkInForm({
  services,
  professionals,
  onDone,
}: {
  services: ServiceOption[];
  professionals: ProfessionalOption[];
  onDone: () => void;
}) {
  const [state, onSubmit, pending] = useActionForm(enqueueWalkIn, null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
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
        <Field data-invalid={Boolean(errors.customerId) || undefined}>
          <FieldLabel>Cliente</FieldLabel>
          <CustomerPicker name="customerId" error={errors.customerId} />
        </Field>
        <Field data-invalid={Boolean(errors.serviceIds) || undefined}>
          <FieldLabel>Serviços</FieldLabel>
          <ServiceChecklist services={services} selected={serviceIds} onChange={setServiceIds} />
          {errors.serviceIds && <FieldError>{errors.serviceIds}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="walk-in-professional">Profissional</FieldLabel>
          <select id="walk-in-professional" name="professionalId" defaultValue="" className={selectClass}>
            <option value="">Qualquer profissional</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 text-base">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Entrar na fila
        </Button>
      </FieldGroup>
    </form>
  );
}

/** "Cliente na porta": fixo acima do rodapé no celular, botão comum no desktop. */
export function WalkInButton({ services, professionals }: { services: ServiceOption[]; professionals: ProfessionalOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        className="fixed right-4 bottom-20 z-30 h-12 rounded-full bg-accent px-5 text-base text-accent-foreground shadow-lg md:static md:h-11 md:rounded-lg md:shadow-none"
        onClick={() => setOpen(true)}
      >
        <DoorOpen aria-hidden />
        Cliente na porta
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cliente na porta</DialogTitle>
          </DialogHeader>
          {open && <WalkInForm services={services} professionals={professionals} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
