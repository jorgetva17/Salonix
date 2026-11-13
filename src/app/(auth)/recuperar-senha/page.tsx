import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordReset } from "../actions";

export const metadata = { title: "Recuperar senha · Salonix" };

export default function ResetRequestPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Recuperar senha</CardTitle>
        <CardDescription>Enviaremos um link para você criar uma nova senha.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ActionForm
          action={requestPasswordReset}
          submitLabel="Enviar link"
          fields={[{ name: "email", label: "E-mail", type: "email", autoComplete: "email" }]}
        />
        <Link
          href="/entrar"
          className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Voltar para o login
        </Link>
      </CardContent>
    </Card>
  );
}
