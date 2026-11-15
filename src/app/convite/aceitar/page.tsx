import type { Metadata } from "next";
import Link from "next/link";
import { acceptInvite, declineInvite } from "@/app/convite/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Convite · Salonix" };

export default async function AceitarConvitePage({ searchParams }: PageProps<"/convite/aceitar">) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=%2Fconvite%2Faceitar");

  const { data: invites } = await supabase.rpc("my_pending_invites");
  return (
    <AuthCard title="Convites para você" description="Aceite para entrar no salão com o perfil indicado.">
      {sp.erro ? <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">Convite inválido ou expirado.</p> : null}
      {!invites || invites.length === 0 ? (
        <div className="grid gap-3 text-center text-sm">
          <p>Você não tem convites pendentes.</p>
          <Button asChild><Link href="/painel">Ir para o painel</Link></Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {invites.map((i) => (
            <li key={i.id} className="rounded-md border p-4">
              <p className="font-semibold">{i.salon_name}</p>
              <p className="mb-3 text-sm text-muted-foreground">Perfil: {ROLE_LABELS[i.role]}</p>
              <div className="flex gap-2">
                <form action={acceptInvite} className="flex-1">
                  <input type="hidden" name="id" value={i.id} />
                  <Button type="submit" className="w-full">Aceitar</Button>
                </form>
                <form action={declineInvite} className="flex-1">
                  <input type="hidden" name="id" value={i.id} />
                  <Button type="submit" variant="outline" className="w-full">Recusar</Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AuthCard>
  );
}
