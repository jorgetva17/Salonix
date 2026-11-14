"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BLOCK_KIND_LABELS, BLOCK_KINDS } from "@/lib/professionals/schedule";
import { addScheduleBlock, removeScheduleBlock } from "../actions";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Remonta o formulário depois de salvar, para voltar aos valores iniciais. */
export function BlockForm({ professionalId }: { professionalId: string }) {
  const [saved, setSaved] = useState(0);
  return <BlockFormFields key={saved} professionalId={professionalId} onSaved={() => setSaved((n) => n + 1)} />;
}

function BlockFormFields({ professionalId, onSaved }: { professionalId: string; onSaved: () => void }) {
  const [state, onSubmit, pending] = useActionForm(addScheduleBlock, null);
  const [allDay, setAllDay] = useState(true);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok && "message" in state) {
      toast.success(state.message);
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <form onSubmit={onSubmit} noValidate>
      <input type="hidden" name="professionalId" value={professionalId} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.kind) || undefined}>
          <FieldLabel htmlFor="block-kind">Tipo</FieldLabel>
          <select id="block-kind" name="kind" defaultValue="day_off" className={selectClass}>
            {BLOCK_KINDS.map((k) => (
              <option key={k} value={k}>
                {BLOCK_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          {errors.kind && <FieldError>{errors.kind}</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={Boolean(errors.startDate) || undefined}>
            <FieldLabel htmlFor="block-start-date">De</FieldLabel>
            <Input id="block-start-date" name="startDate" type="date" className="h-11 text-base" />
            {errors.startDate && <FieldError>{errors.startDate}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.endDate) || undefined}>
            <FieldLabel htmlFor="block-end-date">Até</FieldLabel>
            <Input id="block-end-date" name="endDate" type="date" className="h-11 text-base" />
            {errors.endDate && <FieldError>{errors.endDate}</FieldError>}
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="allDay"
            className="size-5 accent-primary"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          Dia inteiro
        </label>
        {!allDay && (
          <div className="grid grid-cols-2 gap-4">
            <Field data-invalid={Boolean(errors.startTime) || undefined}>
              <FieldLabel htmlFor="block-start-time">Das</FieldLabel>
              <Input id="block-start-time" name="startTime" type="time" className="h-11 text-base" />
              {errors.startTime && <FieldError>{errors.startTime}</FieldError>}
            </Field>
            <Field data-invalid={Boolean(errors.endTime) || undefined}>
              <FieldLabel htmlFor="block-end-time">Às</FieldLabel>
              <Input id="block-end-time" name="endTime" type="time" className="h-11 text-base" />
              {errors.endTime && <FieldError>{errors.endTime}</FieldError>}
            </Field>
          </div>
        )}
        <Field data-invalid={Boolean(errors.note) || undefined}>
          <FieldLabel htmlFor="block-note">Observação (opcional)</FieldLabel>
          <Input id="block-note" name="note" maxLength={200} className="h-11 text-base" />
          {errors.note && <FieldError>{errors.note}</FieldError>}
        </Field>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 text-base">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Adicionar bloqueio
        </Button>
      </FieldGroup>
    </form>
  );
}

export function RemoveBlockButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="h-11"
      disabled={pending}
      aria-label={`Remover ${label}`}
      onClick={() =>
        startTransition(async () => {
          const result = await removeScheduleBlock(id);
          if (result.ok) toast.success("Bloqueio removido");
          else toast.error(result.error);
        })
      }
    >
      Remover
    </Button>
  );
}
