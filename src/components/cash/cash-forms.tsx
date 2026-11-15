"use client";

import { closeCashSession, createCounterSale, openCashSession } from "@/app/(app)/caixa/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { formatBRL } from "@/lib/format";
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

export function CounterSaleForm({ products, customers }: { products: { id: string; name: string; priceCents: number }[]; customers: { id: string; name: string }[] }) {
  return (
    <ActionForm action={createCounterSale} submitLabel="Criar venda" pendingText="Criando…" success="Venda criada — receba em “A receber”" resetOnSuccess className="sm:grid-cols-2">
      {(fe) => (
        <>
          <SelectField name="inventoryItemId" label="Produto" placeholder="Escolha…" options={products.map((p) => ({ value: p.id, label: `${p.name} · ${formatBRL(p.priceCents)}` }))} error={fe("inventoryItemId")} />
          <Field name="quantity" label="Quantidade" type="number" min={1} max={999} defaultValue={1} error={fe("quantity")} />
          <SelectField name="customerId" label="Cliente (opcional)" placeholder="Sem cadastro" options={customers.map((c) => ({ value: c.id, label: c.name }))} error={fe("customerId")} />
          <Field name="guestName" label="ou nome (opcional)" maxLength={80} error={fe("guestName")} />
        </>
      )}
    </ActionForm>
  );
}
