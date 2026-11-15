import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/auth/auth-forms";
import { listMemberships } from "@/lib/salon/active-salon";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Seu salão · Salonix" };

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  if ((await listMemberships()).length > 0) redirect("/painel");
  const { data: invites } = await supabase.rpc("my_pending_invites");
  if (invites && invites.length > 0) redirect("/convite/aceitar");
  return (
    <AuthCard title="Cadastre seu salão" description="Falta só o nome do seu salão ou barbearia.">
      <OnboardingForm />
    </AuthCard>
  );
}
