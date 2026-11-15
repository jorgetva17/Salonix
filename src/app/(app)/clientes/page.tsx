import { MessageCircle, Search } from "lucide-react";
import type { Metadata } from "next";
import { CustomerForm } from "@/components/catalog/customer-form";
import { ActionButton } from "@/components/forms/action-button";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPhone, whatsappLink } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { deleteCustomer } from "./actions";

export const metadata: Metadata = { title: "Clientes · Salonix" };

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const { membership } = await requireRole(["admin", "reception", "professional"]);
  const canEdit = membership.role !== "professional";
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";

  const supabase = await createServerClient();
  let query = supabase.from("customers").select("*").order("name").limit(100);
  if (q) {
    const term = q.replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term.replace(/\D/g, "") || term}%`);
  }
  const { data: customers, error } = await query;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Clientes</h1>
      {canEdit ? (
        <Card>
          <CardHeader><CardTitle>Novo cliente</CardTitle></CardHeader>
          <CardContent><CustomerForm /></CardContent>
        </Card>
      ) : null}

      <form role="search" className="flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou telefone" aria-label="Buscar clientes" />
        <Button type="submit" variant="secondary"><Search /> Buscar</Button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-destructive">Não foi possível carregar os clientes.</p>
      ) : !customers || customers.length === 0 ? (
        <EmptyState title={q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"} description={q ? "Tente outro nome ou telefone." : "Os clientes aparecem aqui conforme você cadastra."} />
      ) : (
        <ul className="grid gap-3">
          {customers.map((c) => (
            <li key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{formatPhone(c.phone) || "Sem telefone"}</p>
                  {c.notes ? <p className="mt-1 text-sm">{c.notes}</p> : null}
                </div>
                <div className="flex gap-2">
                  {c.phone ? (
                    <Button asChild variant="outline">
                      <a href={whatsappLink(c.phone)} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a>
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <ActionButton variant="outline" confirm={`Excluir ${c.name}?`} run={() => deleteCustomer(c.id)} success="Cliente excluído">
                      Excluir
                    </ActionButton>
                  ) : null}
                </div>
              </div>
              {canEdit ? (
                <details className="mt-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">Editar</summary>
                  <div className="pt-2">
                    <CustomerForm customer={{ id: c.id, name: c.name, phone: c.phone ?? "", notes: c.notes }} />
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
