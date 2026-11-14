import { Contact, Search } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/phone";
import { requireRole } from "@/lib/salon/active-salon";
import { escapeLike, normalizeSearch } from "@/lib/search";
import { createServerClient } from "@/lib/supabase/server";
import { CustomerDialog } from "./customers-client";

export const metadata = { title: "Clientes · Salonix" };

const LIMIT = 50;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { salon, membership } = await requireRole();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const canEdit = membership.role === "admin" || membership.role === "reception";

  const supabase = await createServerClient();
  let query = supabase
    .from("customers")
    .select("id, name, phone, notes")
    .eq("salon_id", salon.id)
    .order("name")
    .limit(LIMIT + 1);
  if (q) {
    // Busca por telefone quando só há dígitos e pontuação de telefone; senão por nome sem acento.
    const digits = q.replace(/\D/g, "");
    query =
      digits && /^[\d\s()+-]+$/.test(q)
        ? query.like("phone", `%${digits}%`)
        : query.ilike("name_search", `%${escapeLike(normalizeSearch(q))}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const customers = data.slice(0, LIMIT);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        {canEdit && <CustomerDialog />}
      </div>

      <form role="search" className="flex gap-2">
        <label htmlFor="customer-search" className="sr-only">
          Buscar por nome ou telefone
        </label>
        <Input
          id="customer-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por nome ou telefone"
          className="h-11 text-base"
        />
        <Button type="submit" variant="secondary" className="h-11" aria-label="Buscar">
          <Search aria-hidden />
        </Button>
      </form>

      {customers.length === 0 ? (
        q ? (
          <EmptyState icon={Search} title="Nada encontrado" description={`Nenhum cliente corresponde a "${q}".`} />
        ) : (
          <EmptyState
            icon={Contact}
            title="Nenhum cliente ainda"
            description="Os clientes cadastrados aqui aparecem na agenda e no atendimento."
          />
        )
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {customers.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3" data-testid="customer-row">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[c.phone && formatPhone(c.phone), c.notes].filter(Boolean).join(" · ") || "Sem telefone"}
                    </p>
                  </div>
                  {canEdit && <CustomerDialog customer={c} canDelete={membership.role === "admin"} />}
                </li>
              ))}
            </ul>
            {data.length > LIMIT && (
              <p className="pt-3 text-sm text-muted-foreground">Mostrando os 50 primeiros. Refine a busca.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
