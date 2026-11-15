"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/** Botão que dispara uma Server Action (opcionalmente com confirmação). */
export function ActionButton({
  run,
  success,
  confirm,
  children,
  ...props
}: Omit<ButtonProps, "onClick"> & { run: () => Promise<ActionResult>; success: string; confirm?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const result = await run();
          if (result.ok) toast.success(success);
          else toast.error(result.error);
        });
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
