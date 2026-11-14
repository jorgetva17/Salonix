"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/cash/methods";
import { formatBRL } from "@/lib/format";
import { selectClass } from "../agenda/new-appointment";
import { payCommissions } from "./actions";

export function PayCommissionsButton({
  professionalId,
  professionalName,
  month,
  amountCents,
}: {
  professionalId: string;
  professionalName: string;
  month: string;
  amountCents: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [asExpense, setAsExpense] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button className="h-11" onClick={() => setConfirming(true)}>
        Pagar {formatBRL(amountCents)}
      </Button>
    );
  }

  const pay = () =>
    startTransition(async () => {
      const result = await payCommissions(professionalId, month, asExpense ? method : null);
      if (result.ok) {
        toast.success(`Comissão de ${professionalName} paga: ${formatBRL(result.data.paidCents)}`);
        setConfirming(false);
      } else {
        toast.error(result.error);
      }
    });

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <p className="text-sm">
        Marcar {formatBRL(amountCents)} como pago a {professionalName}?
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={asExpense} onChange={(e) => setAsExpense(e.target.checked)} className="size-5" />
        Lançar como despesa
      </label>
      {asExpense && (
        <select
          aria-label="Forma do pagamento da comissão"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          className={selectClass}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <Button className="h-11 flex-1" disabled={pending} onClick={pay}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Confirmar pagamento
        </Button>
        <Button variant="outline" className="h-11" onClick={() => setConfirming(false)}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
