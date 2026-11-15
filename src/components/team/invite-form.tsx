"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { inviteMember } from "@/app/(app)/equipe/actions";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/navigation";
import type { ActionResult } from "@/lib/action-result";

export function InviteForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(inviteMember, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      toast.success(
        state.existingUser
          ? "Essa pessoa já tem conta; o convite aparece quando ela entrar."
          : "Convite enviado por e-mail.",
      );
    }
  }, [state]);

  const fieldError = (key: string) => (state && !state.ok ? state.fieldErrors?.[key] : undefined);
  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end" noValidate>
      {state && !state.ok && !state.fieldErrors ? (
        <div className="sm:col-span-3"><FormError message={state.error} /></div>
      ) : null}
      <Field name="email" label="E-mail" type="email" inputMode="email" autoComplete="off" error={fieldError("email")} />
      <div className="grid gap-1.5">
        <Label htmlFor="role">Perfil</Label>
        <select id="role" name="role" defaultValue="reception" className="min-h-11 rounded-md border border-input bg-card px-3 text-base md:text-sm">
          {(Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <SubmitButton pendingText="Enviando…">Convidar</SubmitButton>
    </form>
  );
}
