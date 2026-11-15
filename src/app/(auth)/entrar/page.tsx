import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/site/url";

export const metadata: Metadata = { title: "Entrar · Salonix" };

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNext(sp.next, "") : "";
  const notice =
    sp.confirmar === "1"
      ? "Conta criada! Confirme seu e-mail para entrar."
      : sp.erro === "link"
        ? "Link inválido ou expirado. Peça um novo."
        : undefined;
  return (
    <AuthCard title="Entrar" description="Acesse a gestão do seu salão.">
      {notice ? <p role="status" className="mb-4 rounded-md bg-secondary px-3 py-2 text-sm">{notice}</p> : null}
      <SignInForm next={next} />
    </AuthCard>
  );
}
