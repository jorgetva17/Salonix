import { redirect } from "next/navigation";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { needsPasswordSetup } from "@/lib/invites";
import { getCurrentUser } from "@/lib/salon/active-salon";
import { setInitialPassword } from "../actions";

export const metadata = { title: "Criar senha · Salonix" };

export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (!needsPasswordSetup(user)) redirect("/painel");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Crie sua senha</CardTitle>
        <CardDescription>Você vai usar este e-mail e esta senha para entrar no Salonix.</CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm
          action={setInitialPassword}
          submitLabel="Salvar e continuar"
          fields={[
            { name: "fullName", label: "Seu nome", autoComplete: "name" },
            { name: "password", label: "Crie uma senha", type: "password", autoComplete: "new-password" },
          ]}
        />
      </CardContent>
    </Card>
  );
}
