"use client";

import { useState } from "react";
import { payCommissions } from "@/app/(app)/financeiro/actions";
import { ActionButton } from "@/components/forms/action-button";
import { formatBRL } from "@/lib/format";

export function PayCommissionsButton({ professionalId, professionalName, month, amountCents }: { professionalId: string; professionalName: string; month: string; amountCents: number }) {
  const [expense, setExpense] = useState(true);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={expense} onChange={(e) => setExpense(e.target.checked)} className="size-4" />
        Gerar despesa
      </label>
      <ActionButton
        confirm={`Marcar ${formatBRL(amountCents)} de ${professionalName} como pagos?`}
        run={() => payCommissions(professionalId, month, expense)}
        success="Comissões marcadas como pagas"
      >
        Marcar como paga
      </ActionButton>
    </div>
  );
}
