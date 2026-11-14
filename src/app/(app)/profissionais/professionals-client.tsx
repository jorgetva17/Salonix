"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PROFESSIONAL_COLORS } from "@/lib/validation/professionals";
import { saveProfessional, setProfessionalActive } from "./actions";

export type ProfessionalFormData = {
  id: string;
  name: string;
  color: string;
  commissionPercent: number;
};

const percentToInput = (n: number) => String(n).replace(".", ",");

export function ProfessionalForm({
  professional,
  onDone,
}: {
  professional?: ProfessionalFormData;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(saveProfessional, null);
  const [color, setColor] = useState<string>(professional?.color ?? PROFESSIONAL_COLORS[0]);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onDone?.();
    }
  }, [state, onDone]);

  const prefix = professional ? `pro-${professional.id}` : "pro-new";
  return (
    <form action={action} noValidate>
      {professional && <input type="hidden" name="id" value={professional.id} />}
      <input type="hidden" name="color" value={color} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor={`${prefix}-name`}>Nome</FieldLabel>
          <Input id={`${prefix}-name`} name="name" defaultValue={professional?.name} className="h-11 text-base" />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.color) || undefined}>
          <FieldLabel id={`${prefix}-color-label`}>Cor na agenda</FieldLabel>
          <div role="radiogroup" aria-labelledby={`${prefix}-color-label`} className="flex flex-wrap gap-2">
            {PROFESSIONAL_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Cor ${i + 1}`}
                onClick={() => setColor(c)}
                className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{ backgroundColor: c }}
              >
                {color === c && <Check className="size-5 text-white" aria-hidden />}
              </button>
            ))}
          </div>
          {errors.color && <FieldError>{errors.color}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.commissionPercent) || undefined}>
          <FieldLabel htmlFor={`${prefix}-commission`}>Comissão padrão (%)</FieldLabel>
          <Input
            id={`${prefix}-commission`}
            name="commissionPercent"
            inputMode="decimal"
            placeholder="40"
            defaultValue={professional ? percentToInput(professional.commissionPercent) : ""}
            className="h-11 text-base"
          />
          {errors.commissionPercent && <FieldError>{errors.commissionPercent}</FieldError>}
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

export function NewProfessionalDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="h-11" onClick={() => setOpen(true)}>
        Novo profissional
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo profissional</DialogTitle>
          </DialogHeader>
          {open && <ProfessionalForm onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProfessionalActiveButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={active ? "outline" : "secondary"}
      className="h-11"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setProfessionalActive(id, !active);
          if (result.ok) toast.success(active ? "Profissional desativado" : "Profissional reativado");
          else toast.error(result.error);
        })
      }
    >
      {active ? "Desativar" : "Reativar"}
    </Button>
  );
}
