"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/app/(auth)/actions";

export type FormFieldConfig = {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "tel";
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
};

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: FormFieldConfig[];
  submitLabel: string;
  hidden?: Record<string, string>;
};

export function ActionForm({ action, fields, submitLabel, hidden }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  if (state?.ok && "message" in state) {
    return (
      <p role="status" className="rounded-lg bg-muted p-4 text-sm">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} noValidate>
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <FieldGroup>
        {fields.map((f) => (
          <Field key={f.name} data-invalid={Boolean(fieldErrors[f.name]) || undefined}>
            <FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
            <Input
              id={f.name}
              name={f.name}
              type={f.type ?? "text"}
              autoComplete={f.autoComplete}
              placeholder={f.placeholder}
              defaultValue={f.defaultValue}
              aria-invalid={Boolean(fieldErrors[f.name]) || undefined}
              className="h-11 text-base"
            />
            {fieldErrors[f.name] && <FieldError>{fieldErrors[f.name]}</FieldError>}
          </Field>
        ))}
        {state && !state.ok && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 w-full text-base">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
