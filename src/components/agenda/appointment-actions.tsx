"use client";

import { cancelAppointment, markNoShow, startAppointment } from "@/app/(app)/agenda/actions";
import { ActionButton } from "@/components/forms/action-button";

export function AppointmentActions({ id, name, canManage, canStart }: { id: string; name: string; canManage: boolean; canStart: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canStart ? <ActionButton variant="accent" size="sm" run={() => startAppointment(id)} success="Atendimento iniciado">Iniciar</ActionButton> : null}
      {canManage ? (
        <>
          <ActionButton variant="outline" size="sm" confirm={`Marcar que ${name} faltou?`} run={() => markNoShow(id)} success="Marcado como faltou">Faltou</ActionButton>
          <ActionButton variant="outline" size="sm" confirm={`Cancelar o agendamento de ${name}?`} run={() => cancelAppointment(id)} success="Agendamento cancelado">Cancelar</ActionButton>
        </>
      ) : null}
    </div>
  );
}
