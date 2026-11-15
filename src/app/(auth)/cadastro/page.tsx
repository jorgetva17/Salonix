import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Criar conta · Salonix" };

export default function CadastroPage() {
  return (
    <AuthCard title="Criar conta" description="Cadastre seu salão e comece a organizar a agenda, o caixa e a equipe.">
      <SignUpForm />
    </AuthCard>
  );
}
