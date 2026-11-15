"use client";

import { callNext, cancelAppointment, markNoShow } from "@/app/(app)/agenda/actions";
import { ActionButton } from "@/components/forms/action-button";

export function CallNextButton({ professionalId, professionalName }: { professionalId: string; professionalName: string }) {
  return (
    <ActionButton run={() => callNext(professionalId)} success={`Próximo chamado para ${professionalName}`}>
      Chamar próximo
    </ActionButton>
  );
}

export function QueueEntryActions({ id, name }: { id: string; name: string }) {
  return (
    <div className="flex gap-2">
      <ActionButton variant="outline" size="sm" confirm={`Marcar que ${name} foi embora/faltou?`} run={() => markNoShow(id)} success="Marcado como faltou">Faltou</ActionButton>
      <ActionButton variant="ghost" size="sm" confirm={`Remover ${name} da fila?`} run={() => cancelAppointment(id, "Removido da fila")} success="Removido da fila">Remover</ActionButton>
    </div>
  );
}
