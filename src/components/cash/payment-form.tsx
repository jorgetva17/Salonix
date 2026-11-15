"use client";

import { receivePayment } from "@/app/(app)/atendimento/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { centsToInput, formatBRL } from "@/lib/format";
import { METHOD_LABELS, METHODS } from "@/lib/payments";

export function PaymentForm({ id, totalCents }: { id: string; totalCents: number }) {
  return (
    <ActionForm action={receivePayment} submitLabel="Receber pagamento" pendingText="Registrando…" success="Pagamento recebido" className="sm:grid-cols-2">
      {(fe) => (
        <>
          <input type="hidden" name="id" value={id} />
          <p className="text-sm sm:col-span-2">
            Total do atendimento: <strong>{formatBRL(totalCents)}</strong>. Preencha uma ou mais formas de pagamento; a soma deve ser igual a <em>total − desconto</em>.
          </p>
          <Field name="discount" label="Desconto (R$, opcional)" inputMode="decimal" placeholder="0,00" error={fe("discount")} />
          <span className="hidden sm:block" />
          {METHODS.map((m) => (
            <Field key={m} name={`pay_${m}`} label={METHOD_LABELS[m]} inputMode="decimal" placeholder="0,00"
              defaultValue={m === "cash" ? centsToInput(totalCents) : ""} error={fe(`pay_${m}`)} />
          ))}
        </>
      )}
    </ActionForm>
  );
}
