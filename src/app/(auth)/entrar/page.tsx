import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn } from "../actions";

export const metadata = { title: "Entrar · Salonix" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next, erro } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {erro === "link-invalido" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            O link expirou ou já foi usado. Peça um novo.
          </p>
        )}
        <ActionForm
          action={signIn}
          submitLabel="Entrar"
          hidden={next ? { next } : undefined}
          fields={[
            { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
            { name: "password", label: "Senha", type: "password", autoComplete: "current-password" },
          ]}
        />
        <div className="flex flex-col gap-2 text-center text-sm">
          <Link href="/recuperar-senha" className="text-muted-foreground underline-offset-4 hover:underline">
            Esqueci minha senha
          </Link>
          <span>
            Novo por aqui?{" "}
            <Link href="/cadastro" className="font-medium text-primary underline-offset-4 hover:underline">
              Cadastre seu salão
            </Link>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
