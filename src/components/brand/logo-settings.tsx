"use client";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { removeSalonLogo, uploadSalonLogo } from "@/app/(app)/configuracoes/logo-actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";

/* eslint-disable @next/next/no-img-element */
function VariantCard({
  variant,
  title,
  previewBg,
  src,
  fallback,
  hasCustom,
}: {
  variant: "light" | "dark";
  title: string;
  previewBg: string;
  src: string;
  fallback: string;
  hasCustom: boolean;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(uploadSalonLogo, null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (state?.ok) toast.success("Logo atualizada");
  }, [state]);

  return (
    <div className="grid gap-3 rounded-md border p-4">
      <p className="font-medium">{title}</p>
      <div className="flex h-28 items-center justify-center rounded-md border p-3" style={{ background: previewBg }}>
        <img src={hasCustom ? src : fallback} alt={`Prévia da logo (${title})`} className="max-h-full max-w-full object-contain" />
      </div>
      <form action={action} className="grid gap-2">
        <input type="hidden" name="variant" value={variant} />
        {state && !state.ok ? <FormError message={state.error} /> : null}
        <Label htmlFor={`file-${variant}`} className="sr-only">Arquivo da logo ({title})</Label>
        <input
          id={`file-${variant}`}
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:text-sm file:font-medium"
        />
        <div className="flex gap-2">
          <SubmitButton pendingText="Enviando…">Enviar logo</SubmitButton>
          {hasCustom ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await removeSalonLogo(variant);
                  if (r.ok) toast.success("Logo removida");
                  else toast.error(r.error);
                })
              }
            >
              Remover
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export function LogoSettings({
  lightUrl,
  darkUrl,
}: {
  lightUrl: string | null;
  darkUrl: string | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <VariantCard variant="light" title="Tema claro" previewBg="#ffffff" src={lightUrl ?? ""} fallback="/brand/logo-light.png" hasCustom={!!lightUrl} />
      <VariantCard variant="dark" title="Tema escuro (opcional)" previewBg="#0f2129" src={darkUrl ?? ""} fallback="/brand/logo-dark.png" hasCustom={!!darkUrl} />
    </div>
  );
}
