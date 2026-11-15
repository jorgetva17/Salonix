"use client";

import { useState } from "react";
import { addAppointmentItem, addProductItem, completeAppointment, removeAppointmentItem, reverseAppointment, confirmPix } from "@/app/(app)/atendimento/actions";
import { ActionButton } from "@/components/forms/action-button";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { formatBRL } from "@/lib/format";

export function CompleteButton({ id }: { id: string }) {
  return (
    <ActionButton variant="accent" size="lg" run={() => completeAppointment(id)} success="Atendimento concluído — aguardando pagamento">
      Concluir atendimento
    </ActionButton>
  );
}

export function ItemEditor({
  id,
  items,
  services,
  products = [],
  editable,
}: {
  id: string;
  items: { id: string; description: string; priceCents: number; quantity: number }[];
  services: { id: string; name: string; priceCents: number }[];
  products?: { id: string; name: string; priceCents: number }[];
  editable: boolean;
}) {
  const [serviceId, setServiceId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  return (
    <div className="space-y-3">
      <ul className="divide-y">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 py-2">
            <span>{i.quantity > 1 ? `${i.quantity}× ` : ""}{i.description}</span>
            <span className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{formatBRL(i.priceCents * i.quantity)}</span>
              {editable && items.length > 1 ? (
                <ActionButton variant="ghost" size="sm" confirm={`Remover ${i.description}?`} run={() => removeAppointmentItem(id, i.id)} success="Item removido">Remover</ActionButton>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid flex-1 gap-1 text-sm font-medium">
            Adicionar serviço
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="min-h-11 rounded-md border border-input bg-card px-3 font-normal">
              <option value="">Escolha…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatBRL(s.priceCents)}</option>)}
            </select>
          </label>
          <ActionButton variant="secondary" disabled={!serviceId} run={() => addAppointmentItem(id, serviceId)} success="Serviço adicionado">Adicionar</ActionButton>
        </div>
      ) : null}
      {editable && products.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid flex-1 gap-1 text-sm font-medium">
            Adicionar produto
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="min-h-11 rounded-md border border-input bg-card px-3 font-normal">
              <option value="">Escolha…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatBRL(p.priceCents)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Qtd.
            <input type="number" min={1} max={999} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="min-h-11 w-20 rounded-md border border-input bg-card px-3 font-normal" />
          </label>
          <ActionButton variant="secondary" disabled={!productId} run={() => addProductItem(id, productId, Math.max(1, Number(quantity) || 1))} success="Produto adicionado">Adicionar</ActionButton>
        </div>
      ) : null}
    </div>
  );
}

export function ReverseForm({ id }: { id: string }) {
  return (
    <ActionForm action={reverseAppointment} submitLabel="Estornar atendimento" pendingText="Estornando…" success="Atendimento estornado">
      {(fe) => (
        <>
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-muted-foreground">O estorno devolve o valor pelo caixa aberto, reverte a comissão e cancela o atendimento. Não pode ser desfeito.</p>
          <Field name="reason" label="Motivo do estorno" maxLength={200} error={fe("reason")} />
        </>
      )}
    </ActionForm>
  );
}

export function ConfirmPixButton({ transactionId, appointmentId }: { transactionId: string; appointmentId?: string }) {
  return (
    <ActionButton size="sm" run={() => confirmPix(transactionId, appointmentId)} success="Pix confirmado">
      Confirmar Pix recebido
    </ActionButton>
  );
}
