"use client";

/* eslint-disable @next/next/no-img-element -- prévia da logo enviada (inclusive SVG) sempre via <img> */
import { useActionState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { removeSalonLogo, uploadSalonLogo } from "./logo-actions";

type Props = {
  variant: "light" | "dark";
  title: string;
  hint: string;
  src: string;
  custom: boolean;
};

export function LogoUploader({ variant, title, hint, src, custom }: Props) {
  const [state, action, pending] = useActionState(uploadSalonLogo, null);
  const [removing, startRemove] = useTransition();
  const inputId = `logo-${variant}`;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="variant" value={variant} />
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div
        className={cn(
          "flex h-28 items-center justify-center rounded-lg border p-4",
          variant === "light" ? "bg-[#f5f7f8]" : "bg-[#1b3b4b]",
        )}
      >
        <img src={src} alt={`Prévia: ${title}`} className="max-h-full max-w-full object-contain" />
      </div>
      <label htmlFor={inputId} className="text-sm font-medium">
        Arquivo (PNG, JPG ou SVG, até 2 MB)
      </label>
      <input
        id={inputId}
        name="file"
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        required
        className="text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:font-medium file:text-secondary-foreground"
      />
      {state && (
        <p role={state.ok ? "status" : "alert"} className={cn("text-sm", !state.ok && "text-destructive")}>
          {state.ok ? ("message" in state ? state.message : "") : state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || removing} className="h-11 flex-1">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Enviar logo
        </Button>
        {custom && (
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            disabled={pending || removing}
            onClick={() =>
              startRemove(async () => {
                const result = await removeSalonLogo(variant);
                if (result.ok) toast.success("Logo removida");
                else toast.error(result.error);
              })
            }
          >
            Remover
          </Button>
        )}
      </div>
    </form>
  );
}
