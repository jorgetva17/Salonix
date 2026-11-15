import type { AppointmentRow, Database } from "@/lib/supabase/database.types";
import type { createServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createServerClient>>;
type Item = Database["public"]["Tables"]["appointment_items"]["Row"];

export type AppointmentView = AppointmentRow & {
  displayName: string;
  phone: string | null;
  items: Item[];
  durationMinutes: number;
  serviceNames: string;
};

/** Anexa itens e cliente a cada atendimento (consultas separadas; RLS vale em todas). */
export async function withDetails(supabase: Client, rows: AppointmentRow[]): Promise<AppointmentView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter((v): v is string => !!v))];

  const [{ data: items }, { data: customers }] = await Promise.all([
    supabase.from("appointment_items").select("*").in("appointment_id", ids),
    customerIds.length
      ? supabase.from("customers").select("id, name, phone").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string; phone: string | null }[] }),
  ]);
  const byAppt = new Map<string, Item[]>();
  for (const item of items ?? []) byAppt.set(item.appointment_id, [...(byAppt.get(item.appointment_id) ?? []), item]);
  const customerOf = new Map((customers ?? []).map((c) => [c.id, c]));

  return rows.map((row) => {
    const list = byAppt.get(row.id) ?? [];
    const customer = row.customer_id ? customerOf.get(row.customer_id) : undefined;
    return {
      ...row,
      displayName: customer?.name ?? row.guest_name ?? "Cliente",
      phone: customer?.phone ?? null,
      items: list,
      durationMinutes: list.reduce((sum, i) => sum + i.duration_minutes * i.quantity, 0),
      serviceNames: list.map((i) => i.description).join(" + "),
    };
  });
}
