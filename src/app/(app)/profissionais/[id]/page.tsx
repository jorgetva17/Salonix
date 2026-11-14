import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { ProfessionalActiveButton, ProfessionalForm } from "../professionals-client";
import { BLOCK_KIND_LABELS, formatBlockPeriod, type BlockKind } from "@/lib/professionals/schedule";
import { BlockForm, RemoveBlockButton } from "./blocks-client";
import { AccessSelect, ServiceCommissionInput } from "./commissions-client";
import { ScheduleEditor } from "./schedule-editor";

export const metadata = { title: "Profissional · Salonix" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProfessionalPage({ params }: { params: Promise<{ id: string }> }) {
  const { salon } = await requireRole(["admin"]);
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerClient();
  const { data: professional, error } = await supabase
    .from("professionals")
    .select("id, name, color, active, user_id, commission_rates(percent, service_id)")
    .eq("id", id)
    .eq("salon_id", salon.id)
    .maybeSingle();
  if (error) throw error;
  if (!professional) notFound();

  const [
    { data: services, error: servicesError },
    { data: members, error: membersError },
    { data: linked },
    { data: schedule, error: scheduleError },
    { data: blocks, error: blocksError },
  ] = await Promise.all([
    supabase.from("services").select("id, name").eq("salon_id", salon.id).eq("active", true).order("name"),
    supabase.from("salon_members").select("user_id").eq("salon_id", salon.id).eq("active", true),
    supabase.from("professionals").select("user_id").eq("salon_id", salon.id).not("user_id", "is", null),
    supabase
      .from("professional_schedules")
      .select("weekday, starts_at, ends_at")
      .eq("professional_id", professional.id)
      .order("weekday")
      .order("starts_at"),
    supabase
      .from("schedule_blocks")
      .select("id, kind, starts_at, ends_at, note")
      .eq("professional_id", professional.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at"),
  ]);
  if (servicesError || membersError || scheduleError || blocksError) {
    throw servicesError ?? membersError ?? scheduleError ?? blocksError;
  }

  // Membros ativos que ainda não estão ligados a outro profissional.
  const takenByOthers = new Set(
    (linked ?? []).map((p) => p.user_id).filter((u) => u && u !== professional.user_id),
  );
  const candidateIds = members.map((m) => m.user_id).filter((u) => !takenByOthers.has(u));
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", candidateIds);
  const candidates = (profiles ?? [])
    .map((p) => ({ userId: p.id, name: p.full_name || "Sem nome" }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const defaultPercent = professional.commission_rates.find((r) => r.service_id === null)?.percent ?? 0;
  const overrides = new Map(
    professional.commission_rates.filter((r) => r.service_id).map((r) => [r.service_id, r.percent]),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/profissionais"
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Profissionais
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: professional.color }} aria-hidden />
            <h1 className="truncate text-2xl font-semibold">{professional.name}</h1>
            {!professional.active && <Badge variant="outline">inativo</Badge>}
          </div>
          <ProfessionalActiveButton id={professional.id} active={professional.active} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfessionalForm
            professional={{
              id: professional.id,
              name: professional.name,
              color: professional.color,
              commissionPercent: defaultPercent,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jornada</CardTitle>
          <CardDescription>Dias e horários em que {professional.name} atende.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleEditor
            professionalId={professional.id}
            initial={schedule.map((s) => ({
              weekday: s.weekday,
              startsAt: s.starts_at.slice(0, 5),
              endsAt: s.ends_at.slice(0, 5),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bloqueios</CardTitle>
          <CardDescription>Folgas, férias e intervalos em que a agenda fica fechada.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum bloqueio programado.</p>
          ) : (
            <ul className="divide-y">
              {blocks.map((b) => {
                const label = BLOCK_KIND_LABELS[b.kind as BlockKind];
                const period = formatBlockPeriod(b.starts_at, b.ends_at, salon.timezone);
                return (
                  <li key={b.id} className="flex items-center gap-3 py-3" data-testid="block-row">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">
                        {period}
                        {b.note && ` · ${b.note}`}
                      </p>
                    </div>
                    <RemoveBlockButton id={b.id} label={`${label} ${period}`} />
                  </li>
                );
              })}
            </ul>
          )}
          <BlockForm professionalId={professional.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acesso ao app</CardTitle>
          <CardDescription>
            Vincule a uma pessoa da equipe para ela ver a própria agenda e os próprios ganhos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccessSelect professionalId={professional.id} userId={professional.user_id} members={candidates} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comissão por serviço</CardTitle>
          <CardDescription>
            Deixe em branco para usar a comissão padrão ({String(defaultPercent).replace(".", ",")}%).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cadastre serviços para definir comissões específicas.</p>
          ) : (
            <ul className="divide-y">
              {services.map((s) => (
                <ServiceCommissionInput
                  key={s.id}
                  professionalId={professional.id}
                  serviceId={s.id}
                  serviceName={s.name}
                  percent={overrides.get(s.id) ?? null}
                  defaultPercent={defaultPercent}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
