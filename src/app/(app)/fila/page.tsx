import type { Metadata } from "next";
import Link from "next/link";
import { CallNextButton, QueueEntryActions } from "@/components/agenda/queue-actions";
import { WalkInForm } from "@/components/agenda/forms";
import { RealtimeRefresh } from "@/components/agenda/realtime-refresh";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { estimateWaits, freeAtFor } from "@/lib/agenda";
import { withDetails } from "@/lib/agenda-data";
import { DEFAULT_TIMEZONE, formatTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fila · Salonix" };

export default async function FilaPage() {
  const { membership, salon } = await requireRole(["admin", "reception", "professional"]);
  const canManage = membership.role !== "professional";
  const tz = salon.timezone || DEFAULT_TIMEZONE;
  const now = new Date();

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: waitingRows }, { data: busyRows }, { data: pros }, { data: services }, { data: customers }] = await Promise.all([
    supabase.from("appointments").select("*").eq("kind", "walk_in").eq("status", "waiting").order("arrived_at").order("id"),
    supabase.from("appointments").select("*").eq("status", "in_progress"),
    supabase.from("professionals").select("id, name, color, user_id").eq("active", true).order("name"),
    supabase.from("services").select("id, name, duration_minutes, price_cents").eq("active", true).order("name"),
    canManage ? supabase.from("customers").select("id, name").order("name").limit(300) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const waiting = await withDetails(supabase, waitingRows ?? []);
  const inProgress = await withDetails(supabase, busyRows ?? []);
  const professionals = pros ?? [];

  const currentOf = new Map(inProgress.filter((a) => a.professional_id).map((a) => [a.professional_id as string, a]));
  const estimates = estimateWaits(
    waiting.map((w) => ({ id: w.id, professionalId: w.professional_id, durationMinutes: w.durationMinutes })),
    professionals.map((p) => {
      const cur = currentOf.get(p.id);
      return { id: p.id, freeAt: freeAtFor(cur?.started_at ? { startedAt: cur.started_at, durationMinutes: cur.durationMinutes } : null, now) };
    }),
    now,
  );
  const nameOf = new Map(professionals.map((p) => [p.id, p.name]));
  const serviceOptions = (services ?? []).map((s) => ({ id: s.id, name: s.name, durationMinutes: s.duration_minutes, priceCents: s.price_cents }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fila de espera</h1>
        <RealtimeRefresh salonId={membership.salonId} />
      </div>

      {canManage ? (
        <Card>
          <CardHeader><CardTitle>Cliente na porta</CardTitle></CardHeader>
          <CardContent>
            {serviceOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cadastre ao menos um serviço para registrar clientes na fila.</p>
            ) : (
              <WalkInForm
                customers={(customers ?? []).map((c) => ({ id: c.id, name: c.name }))}
                professionals={professionals.map((p) => ({ id: p.id, name: p.name }))}
                services={serviceOptions}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="profs" className="space-y-3">
        <h2 id="profs" className="text-lg font-semibold">Profissionais</h2>
        {professionals.length === 0 ? (
          <EmptyState title="Nenhum profissional ativo" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {professionals.map((p) => {
              const cur = currentOf.get(p.id);
              const mine = !!user && p.user_id === user.id;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="size-3 rounded-full border" style={{ background: p.color }} aria-hidden /> {p.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {cur ? `Atendendo ${cur.displayName}${cur.ends_at ? ` · até ~${formatTime(cur.ends_at, tz)}` : ""}` : "Livre"}
                    </p>
                  </div>
                  {(canManage || mine) && !cur ? <CallNextButton professionalId={p.id} professionalName={p.name} /> : null}
                  {cur ? <Button asChild variant="secondary"><Link href={`/atendimento/${cur.id}`}>Abrir atendimento</Link></Button> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="fila" className="space-y-3">
        <h2 id="fila" className="text-lg font-semibold">Aguardando ({waiting.length})</h2>
        {waiting.length === 0 ? (
          <EmptyState title="Fila vazia" description={canManage ? "Use “Cliente na porta” quando alguém chegar sem hora marcada." : "Ninguém aguardando no momento."} />
        ) : (
          <ol className="grid gap-3">
            {waiting.map((w) => {
              const est = estimates.get(w.id);
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground" aria-label={`Posição ${est?.position ?? ""}`}>
                      {est?.position}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{w.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {w.serviceNames} · chegou às {w.arrived_at ? formatTime(w.arrived_at, tz) : "--:--"}
                        {w.professional_id ? ` · prefere ${nameOf.get(w.professional_id) ?? "profissional"}` : ""}
                      </p>
                      <p className="text-sm">
                        <Badge>
                          {est?.waitMinutes === null || est === undefined ? "Espera indefinida" : est.waitMinutes === 0 ? "Pode ser chamado agora" : `Espera estimada ~${est.waitMinutes} min`}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  {canManage ? <QueueEntryActions id={w.id} name={w.displayName} /> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
