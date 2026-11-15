"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { recordStockMovement } from "../actions";
import { selectClass } from "../inventory-client";

const TYPES = [
  ["in", "Entrada"],
  ["out", "Saída"],
  ["adjust", "Ajuste por contagem"],
] as const;

export function MovementForm({ itemId, unit }: { itemId: string; unit: string }) {
  const [state, onSubmit, pending] = useActionForm(recordStockMovement, null);
  const [type, setType] = useState<"in" | "out" | "adjust">("in");
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      // Limpa quantidade, custo e motivo; o tipo escolhido continua.
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="movement-type">Movimento</FieldLabel>
            <select
              id="movement-type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className={selectClass}
            >
              {TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field data-invalid={Boolean(errors.quantity) || undefined}>
            <FieldLabel htmlFor="movement-quantity">
              {type === "adjust" ? "Quantidade contada" : "Quantidade"} ({unit})
            </FieldLabel>
            <Input id="movement-quantity" name="quantity" inputMode="decimal" className="h-11 text-base" />
            {errors.quantity && <FieldError>{errors.quantity}</FieldError>}
          </Field>
          {type === "in" && (
            <Field data-invalid={Boolean(errors.unitCost) || undefined}>
              <FieldLabel htmlFor="movement-cost">Custo por unidade (R$)</FieldLabel>
              <Input id="movement-cost" name="unitCost" inputMode="decimal" placeholder="Opcional" className="h-11 text-base" />
              {errors.unitCost && <FieldError>{errors.unitCost}</FieldError>}
            </Field>
          )}
          <Field data-invalid={Boolean(errors.reason) || undefined} className={type === "in" ? undefined : "col-span-2"}>
            <FieldLabel htmlFor="movement-reason">Motivo</FieldLabel>
            <Input id="movement-reason" name="reason" placeholder="Opcional" className="h-11 text-base" />
            {errors.reason && <FieldError>{errors.reason}</FieldError>}
          </Field>
        </div>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 text-base">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Registrar
        </Button>
      </FieldGroup>
    </form>
  );
}
