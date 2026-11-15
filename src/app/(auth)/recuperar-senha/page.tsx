import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetRequestForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha · Salonix" };

export default function RecuperarSenhaPage() {
  return (
    <AuthCard title="Recuperar senha" description="Informe seu e-mail para receber o link de redefinição.">
      <ResetRequestForm />
    </AuthCard>
  );
}
