import type { Metadata } from "next";
import { MemberList } from "@/components/team/member-list";
import { InviteForm } from "@/components/team/invite-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Equipe · Salonix" };

export default async function EquipePage() {
  const { membership } = await requireRole(["admin"]);
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: members } = await supabase
    .from("salon_members")
    .select("id, user_id, role, active")
    .eq("salon_id", membership.salonId)
    .order("created_at");
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const { data: invites } = await supabase
    .from("salon_invites")
    .select("id, email, role, created_at")
    .eq("salon_id", membership.salonId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Equipe</h1>
      <Card>
        <CardHeader>
          <CardTitle>Convidar pessoa</CardTitle>
          <CardDescription>A pessoa recebe um e-mail com o link para entrar no salão com o perfil escolhido.</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>
      <MemberList
        currentUserId={user?.id ?? ""}
        members={(members ?? []).map((m) => ({ id: m.id, userId: m.user_id, name: names.get(m.user_id) || "Sem nome", role: m.role, active: m.active }))}
        invites={(invites ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role }))}
      />
    </div>
  );
}
