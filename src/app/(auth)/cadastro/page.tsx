import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signUp } from "../actions";

export const metadata = { title: "Cadastrar salão · Salonix" };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Cadastre seu salão</CardTitle>
        <CardDescription>Você será o administrador e poderá convidar sua equipe depois.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ActionForm
          action={signUp}
          submitLabel="Criar conta"
          fields={[
            { name: "fullName", label: "Seu nome", autoComplete: "name" },
            { name: "salonName", label: "Nome do salão ou barbearia", autoComplete: "organization" },
            { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
            { name: "password", label: "Senha", type: "password", autoComplete: "new-password" },
          ]}
        />
        <p className="text-center text-sm">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
