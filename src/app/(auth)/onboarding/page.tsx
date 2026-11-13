import { redirect } from "next/navigation";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getMemberships } from "@/lib/salon/active-salon";
import { createSalon, signOut } from "../actions";

export const metadata = { title: "Criar salão · Salonix" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if ((await getMemberships()).length > 0) redirect("/painel");

  const pendingSalonName = user.user_metadata?.pending_salon_name as string | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Vamos criar seu salão</CardTitle>
        <CardDescription>
          Sua conta ainda não está ligada a nenhum salão. Se você recebeu um convite, peça ao
          administrador para reenviá-lo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ActionForm
          action={createSalon}
          submitLabel="Criar salão"
          fields={[{ name: "salonName", label: "Nome do salão ou barbearia", defaultValue: pendingSalonName }]}
        />
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="w-full">
            Sair
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
