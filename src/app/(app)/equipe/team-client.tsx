"use client";

import { useActionState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/invites";
import type { SalonRole } from "@/lib/salon/membership";
import { inviteMember, revokeInvite, setMemberActive, updateMemberRole } from "./actions";

const ROLES = Object.entries(ROLE_LABELS) as [SalonRole, string][];

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMember, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={action} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.email) || undefined}>
          <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
          <Input id="invite-email" name="email" type="email" autoComplete="off" className="h-11 text-base" />
          {errors.email && <FieldError>{errors.email}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.role) || undefined}>
          <FieldLabel htmlFor="invite-role">Perfil</FieldLabel>
          <select id="invite-role" name="role" defaultValue="professional" className={selectClass}>
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.role && <FieldError>{errors.role}</FieldError>}
        </Field>
        {state && (
          <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm" : "text-sm text-destructive"}>
            {state.ok ? ("message" in state ? state.message : "") : state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 text-base">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Enviar convite
        </Button>
      </FieldGroup>
    </form>
  );
}

type MemberRowProps = {
  id: string;
  name: string;
  role: SalonRole;
  active: boolean;
  isSelf: boolean;
};

export function MemberRow({ id, name, role, active, isSelf }: MemberRowProps) {
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-medium">{name || "Sem nome"}</span>
        {isSelf && <Badge variant="secondary">você</Badge>}
        {!active && <Badge variant="outline">desativado</Badge>}
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`role-${id}`}>
          Perfil de {name}
        </label>
        <select
          id={`role-${id}`}
          defaultValue={role}
          disabled={pending}
          className={`${selectClass} sm:w-44`}
          onChange={(e) => run(() => updateMemberRole(id, e.target.value), "Perfil atualizado")}
        >
          {ROLES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button
          variant={active ? "outline" : "secondary"}
          className="h-11"
          disabled={pending}
          onClick={() =>
            run(() => setMemberActive(id, !active), active ? "Acesso desativado" : "Acesso reativado")
          }
        >
          {active ? "Desativar" : "Reativar"}
        </Button>
      </div>
    </li>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="h-11"
      disabled={pending}
      onClick={() => startTransition(() => revokeInvite(id))}
    >
      Cancelar
    </Button>
  );
}
