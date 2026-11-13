import { redirect } from "next/navigation";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/salon/active-salon";
import { updatePassword } from "../actions";

export const metadata = { title: "Nova senha · Salonix" };

export default async function NewPasswordPage() {
  // O link do e-mail passa por /auth/callback, que abre a sessão de recuperação.
  if (!(await getCurrentUser())) redirect("/recuperar-senha");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Crie uma nova senha</CardTitle>
      </CardHeader>
      <CardContent>
        <ActionForm
          action={updatePassword}
          submitLabel="Salvar nova senha"
          fields={[
            { name: "password", label: "Nova senha", type: "password", autoComplete: "new-password" },
            {
              name: "confirmPassword",
              label: "Confirme a nova senha",
              type: "password",
              autoComplete: "new-password",
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
