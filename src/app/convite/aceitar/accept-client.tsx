"use client";

import { useActionState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { acceptInvite, declineInvite } from "./actions";

type Props = { inviteId: string; askPassword: boolean };

export function AcceptInviteForm({ inviteId, askPassword }: Props) {
  const [state, action, pending] = useActionState(acceptInvite, null);
  const [declining, startDecline] = useTransition();
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} noValidate>
      <input type="hidden" name="inviteId" value={inviteId} />
      <FieldGroup>
        {askPassword && (
          <>
            <Field data-invalid={Boolean(errors.fullName) || undefined}>
              <FieldLabel htmlFor={`name-${inviteId}`}>Seu nome</FieldLabel>
              <Input id={`name-${inviteId}`} name="fullName" autoComplete="name" className="h-11 text-base" />
              {errors.fullName && <FieldError>{errors.fullName}</FieldError>}
            </Field>
            <Field data-invalid={Boolean(errors.password) || undefined}>
              <FieldLabel htmlFor={`pwd-${inviteId}`}>Crie uma senha</FieldLabel>
              <Input
                id={`pwd-${inviteId}`}
                name="password"
                type="password"
                autoComplete="new-password"
                className="h-11 text-base"
              />
              {errors.password && <FieldError>{errors.password}</FieldError>}
            </Field>
          </>
        )}
        {state && !state.ok && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || declining} className="h-11 flex-1 text-base">
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Aceitar convite
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            disabled={pending || declining}
            onClick={() => startDecline(() => declineInvite(inviteId))}
          >
            Recusar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
