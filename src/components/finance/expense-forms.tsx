"use client";

import { useState } from "react";
import { createExpense, deleteExpense, payExpense } from "@/app/(app)/financeiro/contas/actions";
import { ActionButton } from "@/components/forms/action-button";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { METHOD_LABELS, METHODS } from "@/lib/payments";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/lib/reports";

export function ExpenseForm({ today }: { today: string }) {
  const [paid, setPaid] = useState(false);
  return (
    <ActionForm action={createExpense} submitLabel="Lançar despesa" pendingText="Lançando…" success="Despesa lançada" resetOnSuccess className="sm:grid-cols-2">
      {(fe) => (
        <>
          <SelectField name="category" label="Categoria" placeholder="Escolha…" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} error={fe("category")} />
          <Field name="description" label="Descrição" maxLength={120} error={fe("description")} />
          <Field name="amount" label="Valor (R$)" inputMode="decimal" placeholder="200,00" error={fe("amount")} />
          <Field name="dueDate" label="Vencimento" type="date" defaultValue={today} error={fe("dueDate")} />
          <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="paid" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-4" />
            Já foi paga
          </label>
          {paid ? <SelectField name="method" label="Forma de pagamento" placeholder="Escolha…" options={METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] }))} error={fe("method")} /> : null}
        </>
      )}
    </ActionForm>
  );
}

export function PayExpenseControls({ id, description }: { id: string; description: string }) {
  const [method, setMethod] = useState<(typeof METHODS)[number]>("pix");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={`Forma de pagamento de ${description}`} value={method} onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])} className="min-h-9 rounded-md border border-input bg-card px-2 text-sm">
        {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
      </select>
      <ActionButton size="sm" run={() => payExpense(id, method)} success="Despesa paga">Marcar como paga</ActionButton>
      <ActionButton size="sm" variant="ghost" confirm={`Excluir “${description}”?`} run={() => deleteExpense(id)} success="Despesa excluída">Excluir</ActionButton>
    </div>
  );
}
