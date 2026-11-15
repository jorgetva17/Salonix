import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockForm, CommissionForm, ProfessionalForm, ScheduleForm } from "@/components/catalog/professional-forms";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WEEKDAYS, formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import {
  deleteBlock,
  deleteSchedule,
  removeCommissionOverride,
  setProfessionalActive,
} from "../actions";

export const metadata: Metadata = { title: "Profissional · Salonix" };

export default async function ProfissionalPage({ params }: PageProps<"/profissionais/[id]">) {
  const { id } = await params;
  const { membership, salon } = await requireRole(["admin", "reception", "professional"]);
  const isAdmin = membership.role === "admin";
  const canBlock = membership.role !== "professional";

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: professional } = await supabase.from("professionals").select("*").eq("id", id).maybeSingle();
  if (!professional) notFound();
  const showCommissions = isAdmin || (!!user && professional.user_id === user.id);

  const [{ data: schedules }, { data: blocks }, { data: services }, { data: overrides }, { data: rate }] = await Promise.all([
    supabase.from("professional_schedules").select("*").eq("professional_id", id).order("weekday").order("start_time"),
    supabase.from("schedule_blocks").select("*").eq("professional_id", id).gte("ends_at", new Date().toISOString()).order("starts_at"),
    supabase.from("services").select("id, name, active").order("name"),
    showCommissions
      ? supabase.from("professional_service_commissions").select("id, service_id, commission_percent").eq("professional_id", id)
      : Promise.resolve({ data: [] }),
    showCommissions
      ? supabase.from("professional_default_commissions").select("commission_percent").eq("professional_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));
  const activeServices = (services ?? []).filter((s) => s.active);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/profissionais" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary">
        <ArrowLeft className="size-4" /> Profissionais
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <span className="size-5 rounded-full border" style={{ background: professional.color }} aria-hidden />
          {professional.name}
          {!professional.active ? <Badge>Inativo</Badge> : null}
        </h1>
        {isAdmin ? (
          <ActionButton
            variant="outline"
            run={() => setProfessionalActive(id, !professional.active)}
            success={professional.active ? "Profissional desativado" : "Profissional reativado"}
          >
            {professional.active ? "Desativar" : "Reativar"}
          </ActionButton>
        ) : null}
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader><CardTitle>Dados</CardTitle></CardHeader>
          <CardContent>
            <ProfessionalForm
              professional={{ id, name: professional.name, color: professional.color, commissionPercent: String(rate?.commission_percent ?? 0) }}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Jornada semanal</CardTitle>
          <CardDescription>Horários em que atende em cada dia da semana.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!schedules || schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum horário cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {schedules.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{WEEKDAYS[s.weekday]}</span>{" "}
                    <span className="text-sm text-muted-foreground">{s.start_time.slice(0, 5)} às {s.end_time.slice(0, 5)}</span>
                  </span>
                  {isAdmin ? (
                    <ActionButton variant="ghost" size="sm" run={() => deleteSchedule(s.id, id)} success="Horário removido">Remover</ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {isAdmin ? <ScheduleForm professionalId={id} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bloqueios (folgas, férias)</CardTitle>
          <CardDescription>Períodos em que não recebe agendamentos. Horários no fuso do salão ({salon.timezone}).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!blocks || blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum bloqueio futuro.</p>
          ) : (
            <ul className="divide-y">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-sm">
                    <span className="font-medium">{formatDateTime(b.starts_at, salon.timezone)}</span> até{" "}
                    <span className="font-medium">{formatDateTime(b.ends_at, salon.timezone)}</span>
                    {b.reason ? <span className="block text-muted-foreground">{b.reason}</span> : null}
                  </span>
                  {canBlock ? (
                    <ActionButton variant="ghost" size="sm" run={() => deleteBlock(b.id, id)} success="Bloqueio removido">Remover</ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canBlock ? <BlockForm professionalId={id} /> : null}
        </CardContent>
      </Card>

      {showCommissions ? (
        <Card>
          <CardHeader>
            <CardTitle>Comissão por serviço</CardTitle>
            <CardDescription>
              Padrão: {rate?.commission_percent ?? 0}% do valor bruto. Exceções abaixo substituem o padrão em cada serviço.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!overrides || overrides.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem exceções: vale a comissão padrão em todos os serviços.</p>
            ) : (
              <ul className="divide-y">
                {overrides.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-medium">{serviceName.get(o.service_id) ?? "Serviço"}</span>{" "}
                      <span className="text-sm text-muted-foreground">{o.commission_percent}%</span>
                    </span>
                    {isAdmin ? (
                      <ActionButton variant="ghost" size="sm" run={() => removeCommissionOverride(o.id, id)} success="Exceção removida">Remover</ActionButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {isAdmin ? <CommissionForm professionalId={id} services={activeServices.map((s) => ({ id: s.id, name: s.name }))} /> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
