import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/invites";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { InviteForm, MemberRow, RevokeInviteButton } from "./team-client";

export const metadata = { title: "Equipe · Salonix" };

export default async function TeamPage() {
  const { salon, user } = await requireRole(["admin"]);
  const supabase = await createServerClient();

  const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, user_id, role, active")
      .eq("salon_id", salon.id)
      .order("active", { ascending: false })
      .order("created_at"),
    supabase
      .from("salon_invites")
      .select("id, email, role, created_at, expires_at")
      .eq("salon_id", salon.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);
  if (membersError || invitesError) throw membersError ?? invitesError;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in(
      "id",
      members.map((m) => m.user_id),
    );
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Equipe</h1>

      <Card>
        <CardHeader>
          <CardTitle>Convidar pessoa</CardTitle>
          <CardDescription>A pessoa recebe um e-mail para entrar no {salon.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convites pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{invite.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {ROLE_LABELS[invite.role]} ·{" "}
                      {new Date(invite.expires_at) < new Date()
                        ? "vencido, convide de novo"
                        : `enviado em ${formatDateTime(invite.created_at, salon.timezone)}`}
                    </p>
                  </div>
                  <RevokeInviteButton id={invite.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pessoas com acesso</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                id={m.id}
                name={nameById.get(m.user_id) ?? ""}
                role={m.role}
                active={m.active}
                isSelf={m.user_id === user.id}
              />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
