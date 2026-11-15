"use client";

import { recordMovement, saveConsumable, saveInventoryItem } from "@/app/(app)/estoque/actions";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";

export type InventoryFormValues = { id: string; name: string; unit: string; minQuantity: string; salePrice: string };

export function InventoryItemForm({ item }: { item?: InventoryFormValues }) {
  return (
    <ActionForm
      action={saveInventoryItem}
      submitLabel={item ? "Salvar alterações" : "Adicionar item"}
      success={item ? "Item atualizado" : "Item adicionado"}
      resetOnSuccess={!item}
      className="sm:grid-cols-2"
    >
      {(fe) => (
        <>
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <div className="sm:col-span-2"><Field name="name" label="Nome" defaultValue={item?.name} error={fe("name")} /></div>
          <Field name="unit" label="Unidade (un, ml, g…)" defaultValue={item?.unit ?? "un"} maxLength={12} error={fe("unit")} />
          <Field name="minQuantity" label="Estoque mínimo" inputMode="decimal" defaultValue={item?.minQuantity ?? "0"} error={fe("minQuantity")} />
          <div className="sm:col-span-2">
            <Field name="salePrice" label="Preço de venda (R$) — preencha só se for vendido no balcão" inputMode="decimal" placeholder="35,00" defaultValue={item?.salePrice} error={fe("salePrice")} />
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function MovementForm({ itemId, unit }: { itemId: string; unit: string }) {
  return (
    <ActionForm action={recordMovement} submitLabel="Registrar" pendingText="Registrando…" success="Movimentação registrada" resetOnSuccess className="sm:grid-cols-2">
      {(fe) => (
        <>
          <input type="hidden" name="itemId" value={itemId} />
          <SelectField name="type" label="Tipo" defaultValue="in" error={fe("type")}
            options={[{ value: "in", label: "Entrada (compra)" }, { value: "out", label: "Saída (perda/uso)" }, { value: "adjust", label: "Contagem (novo total)" }]} />
          <Field name="quantity" label={`Quantidade (${unit})`} inputMode="decimal" error={fe("quantity")} />
          <Field name="unitCost" label="Custo unitário (R$, só entrada)" inputMode="decimal" placeholder="12,00" error={fe("unitCost")} />
          <Field name="reason" label="Motivo (opcional)" maxLength={120} error={fe("reason")} />
        </>
      )}
    </ActionForm>
  );
}

export function ConsumableForm({ services, items }: { services: { id: string; name: string }[]; items: { id: string; name: string; unit: string }[] }) {
  return (
    <ActionForm action={saveConsumable} submitLabel="Salvar consumo" success="Consumo salvo" resetOnSuccess className="sm:grid-cols-3">
      {(fe) => (
        <>
          <SelectField name="serviceId" label="Serviço" placeholder="Escolha…" options={services.map((s) => ({ value: s.id, label: s.name }))} error={fe("serviceId")} />
          <SelectField name="itemId" label="Material" placeholder="Escolha…" options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))} error={fe("itemId")} />
          <Field name="quantity" label="Qtd. por atendimento" inputMode="decimal" error={fe("quantity")} />
        </>
      )}
    </ActionForm>
  );
}
