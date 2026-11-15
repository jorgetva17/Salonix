import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { NewPasswordForm } from "@/components/auth/auth-forms";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nova senha · Salonix" };

export default async function RedefinirSenhaPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?erro=link");
  return (
    <AuthCard title="Nova senha" description="Escolha uma senha com pelo menos 8 caracteres.">
      <NewPasswordForm />
    </AuthCard>
  );
}
