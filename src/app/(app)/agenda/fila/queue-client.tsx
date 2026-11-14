"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { callNextWalkIn, cancelAppointment, completeAppointment, markNoShow } from "../actions";

export function CallNextButton({ professionalId, professionalName }: { professionalId: string; professionalName: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="h-11"
      disabled={pending}
      aria-label={`Chamar próximo para ${professionalName}`}
      onClick={() =>
        startTransition(async () => {
          const result = await callNextWalkIn(professionalId);
          if (result.ok) toast.success(`${result.data.customerName} chamado para ${professionalName}`);
          else toast.error(result.error);
        })
      }
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      Chamar próximo
    </Button>
  );
}

export function CompleteButton({ appointmentId }: { appointmentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await completeAppointment(appointmentId);
          if (result.ok) toast.success("Atendimento concluído");
          else toast.error(result.error);
        })
      }
    >
      Concluir
    </Button>
  );
}

/** Remover da fila (cancelar) ou marcar falta, com confirmação no próprio item. */
export function QueueItemActions({ appointmentId, customerName }: { appointmentId: string; customerName: string }) {
  const [confirming, setConfirming] = useState<"remove" | "no_show" | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
      setConfirming(null);
    });

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          className="h-11"
          disabled={pending}
          onClick={() =>
            confirming === "remove"
              ? run(() => cancelAppointment(appointmentId, "Saiu da fila"), `${customerName} saiu da fila`)
              : run(() => markNoShow(appointmentId), `Falta registrada para ${customerName}`)
          }
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {confirming === "remove" ? "Confirmar remoção" : "Confirmar falta"}
        </Button>
        <Button variant="ghost" className="h-11" onClick={() => setConfirming(null)}>
          Voltar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" className="h-11" onClick={() => setConfirming("no_show")} aria-label={`${customerName} faltou`}>
        Faltou
      </Button>
      <Button variant="ghost" className="h-11 text-destructive" onClick={() => setConfirming("remove")} aria-label={`Remover ${customerName} da fila`}>
        Remover
      </Button>
    </div>
  );
}
