"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { linkProfessionalUser, saveServiceCommission } from "../actions";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const percentToInput = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export function ServiceCommissionInput({
  professionalId,
  serviceId,
  serviceName,
  percent,
  defaultPercent,
}: {
  professionalId: string;
  serviceId: string;
  serviceName: string;
  percent: number | null;
  defaultPercent: number;
}) {
  const [saved, setSaved] = useState(percentToInput(percent));
  const [pending, startTransition] = useTransition();
  const id = `commission-${serviceId}`;

  const save = (value: string) => {
    if (value.trim() === saved.trim()) return;
    startTransition(async () => {
      const result = await saveServiceCommission(professionalId, serviceId, value);
      if (result.ok) {
        setSaved(value);
        toast.success(value.trim() ? `Comissão de ${serviceName} salva` : `${serviceName} volta à comissão padrão`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <li className="flex items-center gap-3 py-3">
      <label htmlFor={id} className="min-w-0 flex-1 truncate">
        {serviceName}
      </label>
      <div className="flex items-center gap-1">
        <Input
          id={id}
          inputMode="decimal"
          defaultValue={saved}
          placeholder={percentToInput(defaultPercent)}
          disabled={pending}
          onBlur={(e) => save(e.currentTarget.value)}
          className="h-11 w-20 text-right text-base"
        />
        <span aria-hidden>%</span>
      </div>
    </li>
  );
}

export function AccessSelect({
  professionalId,
  userId,
  members,
}: {
  professionalId: string;
  userId: string | null;
  members: { userId: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="professional-access" className="text-sm font-medium">
        Pessoa da equipe
      </label>
      <select
        id="professional-access"
        defaultValue={userId ?? ""}
        disabled={pending}
        className={selectClass}
        onChange={(e) => {
          const value = e.target.value || null;
          startTransition(async () => {
            const result = await linkProfessionalUser(professionalId, value);
            if (result.ok) toast.success(value ? "Acesso vinculado" : "Acesso removido");
            else toast.error(result.error);
          });
        }}
      >
        <option value="">Sem acesso ao app</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
