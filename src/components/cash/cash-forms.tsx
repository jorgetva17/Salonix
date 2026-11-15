"use client";

import { closeCashSession, openCashSession } from "@/app/(app)/caixa/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { METHOD_LABELS, METHODS } from "@/lib/payments";

export function OpenCashForm() {
  return (
    <ActionForm action={openCashSession} submitLabel="Abrir caixa" pendingText="Abrindo…" success="Caixa aberto">
      {(fe) => <Field name="opening" label="Valor inicial em dinheiro (R$)" inputMode="decimal" placeholder="0,00" defaultValue="0,00" error={fe("opening")} />}
    </ActionForm>
  );
}

export function CloseCashForm({ sessionId }: { sessionId: string }) {
  return (
    <ActionForm action={closeCashSession} submitLabel="Fechar caixa" pendingText="Fechando…" success="Caixa fechado" className="sm:grid-cols-2">
      {(fe) => (
        <>
          <input type="hidden" name="sessionId" value={sessionId} />
          <p className="text-sm text-muted-foreground sm:col-span-2">Informe o valor contado em cada forma de pagamento (dinheiro: conte a gaveta, inclusive o valor inicial).</p>
          {METHODS.map((m) => (
            <Field key={m} name={`count_${m}`} label={`${METHOD_LABELS[m]} contado (R$)`} inputMode="decimal" placeholder="0,00" error={fe(`count_${m}`)} />
          ))}
        </>
      )}
    </ActionForm>
  );
}
