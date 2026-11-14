"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quickCreateCustomer, searchCustomers, type CustomerOption } from "@/app/(app)/clientes/actions";
import { formatPhone } from "@/lib/phone";

/**
 * Busca um cliente pelo nome ou telefone, ou cadastra um novo na hora.
 * O id escolhido vai num input hidden com o `name` informado.
 */
export function CustomerPicker({ name, error }: { name: string; error?: string }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [selected, setSelected] = useState<CustomerOption | null>(null);
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const timer = setTimeout(() => startSearch(async () => setOptions(await searchCustomers(query))), 250);
    return () => clearTimeout(timer);
  }, [query, selected]);

  if (selected) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-lg border px-3">
        <input type="hidden" name={name} value={selected.id} />
        <Check className="size-4 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {selected.name}
          {selected.phone && <span className="text-muted-foreground"> · {formatPhone(selected.phone)}</span>}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Trocar cliente"
          onClick={() => {
            setSelected(null);
            setQuery("");
            setOptions([]);
          }}
        >
          <X aria-hidden />
        </Button>
      </div>
    );
  }

  const create = () =>
    startSave(async () => {
      const result = await quickCreateCustomer(query, phone);
      if (result.ok) {
        setSelected(result.data);
        setCreating(false);
        setCreateError(null);
      } else {
        setCreateError(Object.values(result.fieldErrors ?? {})[0] ?? result.error);
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value="" />
      {/* Sem escolher da lista, o nome digitado vira cadastro novo ao enviar o formulário. */}
      <input type="hidden" name="customerName" value={query} />
      <Input
        id={id}
        aria-label="Cliente"
        placeholder="Nome ou telefone do cliente"
        value={query}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setCreating(false);
        }}
        className="h-11 text-base"
        aria-invalid={Boolean(error) || undefined}
      />
      {searching && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Buscando" />}
      {query.trim().length >= 2 && !creating && (
        <ul className="flex flex-col rounded-lg border" aria-label="Clientes encontrados">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left hover:bg-muted"
                onClick={() => setSelected(o)}
              >
                <span className="truncate">{o.name}</span>
                {o.phone && <span className="text-sm text-muted-foreground">{formatPhone(o.phone)}</span>}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 px-3 text-left font-medium text-primary hover:bg-muted"
              onClick={() => setCreating(true)}
            >
              <UserPlus className="size-4" aria-hidden />
              Cadastrar “{query.trim()}” com WhatsApp
            </button>
          </li>
        </ul>
      )}
      {creating && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm">
            Novo cliente: <strong>{query.trim()}</strong>
          </p>
          <Input
            aria-label="WhatsApp do novo cliente (opcional)"
            placeholder="WhatsApp (opcional)"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 text-base"
          />
          {createError && (
            <p role="alert" className="text-sm text-destructive">
              {createError}
            </p>
          )}
          <Button type="button" className="h-11" disabled={saving} onClick={create}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Cadastrar cliente
          </Button>
        </div>
      )}
      {query.trim().length >= 2 && !creating && (
        <p className="text-sm text-muted-foreground">Não está na lista? Basta continuar: o cliente é cadastrado com este nome.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
