"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** Formulário ligado a uma Server Action: erros por campo, toast e reset no sucesso. */
export function ActionForm({
  action,
  submitLabel,
  pendingText = "Salvando…",
  success = "Salvo",
  resetOnSuccess = false,
  className,
  children,
}: {
  action: Action;
  submitLabel: string;
  pendingText?: string;
  success?: string;
  resetOnSuccess?: boolean;
  className?: string;
  children: (fieldError: (key: string) => string | undefined) => React.ReactNode;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(success);
      if (resetOnSuccess) ref.current?.reset();
    }
  }, [state, success, resetOnSuccess]);

  const fieldError = (key: string) => (state && !state.ok ? state.fieldErrors?.[key] : undefined);
  return (
    <form ref={ref} action={formAction} noValidate className={cn("grid gap-4", className)}>
      {state && !state.ok && !state.fieldErrors ? <FormError message={state.error} /> : null}
      {children(fieldError)}
      <div>
        <SubmitButton pendingText={pendingText}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
