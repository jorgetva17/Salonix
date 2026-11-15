"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { revokeInvite, setMemberActive, updateMemberRole } from "@/app/(app)/equipe/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import type { ActionResult } from "@/lib/action-result";
import { ROLE_LABELS } from "@/lib/navigation";
import type { SalonRole } from "@/lib/supabase/database.types";

type Member = { id: string; userId: string; name: string; role: SalonRole; active: boolean };
type Invite = { id: string; email: string; role: SalonRole };

function useAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, success: string) =>
    start(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  return { pending, run };
}

export function MemberList({ members, invites, currentUserId }: { members: Member[]; invites: Invite[]; currentUserId: string }) {
  const { pending, run } = useAction();
  return (
    <>
      <Card>
        <CardHeader><CardTitle>Membros</CardTitle></CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <EmptyState title="Nenhum membro ainda" />
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.name} {m.userId === currentUserId ? <span className="text-xs text-muted-foreground">(você)</span> : null}
                    </p>
                    {!m.active ? <Badge className="mt-1">Desativado</Badge> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Perfil de ${m.name}`}
                      value={m.role}
                      disabled={pending}
                      className="min-h-11 rounded-md border border-input bg-card px-2 text-sm"
                      onChange={(e) => run(() => updateMemberRole(m.id, e.target.value as SalonRole), "Perfil atualizado")}
                    >
                      {(Object.keys(ROLE_LABELS) as SalonRole[]).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => setMemberActive(m.id, !m.active), m.active ? "Acesso desativado" : "Acesso reativado")}
                    >
                      {m.active ? "Desativar" : "Reativar"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Convites pendentes</CardTitle></CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>
          ) : (
            <ul className="divide-y">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.email}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[i.role]}</p>
                  </div>
                  <Button variant="outline" disabled={pending} onClick={() => run(() => revokeInvite(i.id), "Convite cancelado")}>
                    Cancelar convite
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
