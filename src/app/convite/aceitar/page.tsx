import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { needsPasswordSetup, ROLE_LABELS } from "@/lib/invites";
import { getCurrentUser, getMemberships } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "./accept-client";

export const metadata = { title: "Convites · Salonix" };

export default async function AcceptInvitePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <p className="mb-4 text-center text-3xl font-semibold tracking-tight text-primary">Salonix</p>
        {user ? <Invites askPassword={needsPasswordSetup(user)} /> : <SignInFirst />}
      </div>
    </main>
  );
}

function SignInFirst() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entre para ver seus convites</CardTitle>
      </CardHeader>
      <CardContent>
        <Link href="/entrar?next=/convite/aceitar" className={buttonVariants({ className: "h-11 w-full text-base" })}>
          Entrar
        </Link>
      </CardContent>
    </Card>
  );
}

async function Invites({ askPassword }: { askPassword: boolean }) {
  const supabase = await createServerClient();
  const { data: invites, error } = await supabase.rpc("my_pending_invites");

  if (error) {
    return (
      <p role="alert" className="text-center text-destructive">
        Não foi possível carregar seus convites. Recarregue a página.
      </p>
    );
  }

  if (!invites.length) {
    const hasSalon = (await getMemberships()).length > 0;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Nenhum convite pendente</CardTitle>
          <CardDescription>
            {hasSalon ? "Você já tem acesso ao seu salão." : "Peça ao administrador do salão para enviar um convite."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={hasSalon ? "/painel" : "/onboarding"}
            className={buttonVariants({ variant: "outline", className: "h-11 w-full text-base" })}
          >
            {hasSalon ? "Ir para o painel" : "Criar meu próprio salão"}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return invites.map((invite) => (
    <Card key={invite.id}>
      <CardHeader>
        <CardTitle className="text-xl">{invite.salon_name}</CardTitle>
        <CardDescription>Você foi convidado como {ROLE_LABELS[invite.role]}.</CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptInviteForm inviteId={invite.id} askPassword={askPassword} />
      </CardContent>
    </Card>
  ));
}
