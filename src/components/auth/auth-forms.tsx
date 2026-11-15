"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createSalon,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
} from "@/app/(auth)/actions";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import type { ActionResult } from "@/lib/action-result";

const initial: ActionResult | null = null;
const fe = (r: ActionResult | null, key: string) => (r && !r.ok ? r.fieldErrors?.[key] : undefined);
const topError = (r: ActionResult | null) => (r && !r.ok && !r.fieldErrors ? r.error : undefined);

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormError message={topError(state)} />
      <Field name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" error={fe(state, "email")} />
      <Field name="password" label="Senha" type="password" autoComplete="current-password" error={fe(state, "password")} />
      <SubmitButton size="lg" pendingText="Entrando…">Entrar</SubmitButton>
      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href="/recuperar-senha" className="text-primary underline underline-offset-4 hover:no-underline">Esqueci minha senha</Link>
        <Link href="/cadastro" className="text-primary underline underline-offset-4 hover:no-underline">Criar conta e cadastrar meu salão</Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={topError(state)} />
      <Field name="fullName" label="Seu nome" autoComplete="name" error={fe(state, "fullName")} />
      <Field name="salonName" label="Nome do salão ou barbearia" error={fe(state, "salonName")} />
      <Field name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" error={fe(state, "email")} />
      <Field name="password" label="Senha (mínimo 8 caracteres)" type="password" autoComplete="new-password" error={fe(state, "password")} />
      <SubmitButton size="lg" pendingText="Criando…">Criar conta</SubmitButton>
      <p className="text-center text-sm">
        Já tem conta? <Link href="/entrar" className="text-primary underline underline-offset-4 hover:no-underline">Entrar</Link>
      </p>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  if (state?.ok) {
    return (
      <p role="status" className="rounded-md bg-secondary px-3 py-3 text-sm">
        Se o e-mail estiver cadastrado, você vai receber um link para redefinir a senha.
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={topError(state)} />
      <Field name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" error={fe(state, "email")} />
      <SubmitButton size="lg" pendingText="Enviando…">Enviar link</SubmitButton>
      <Link href="/entrar" className="text-center text-sm text-primary underline underline-offset-4 hover:no-underline">Voltar para o login</Link>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={topError(state)} />
      <Field name="password" label="Nova senha" type="password" autoComplete="new-password" error={fe(state, "password")} />
      <Field name="confirmPassword" label="Confirmar nova senha" type="password" autoComplete="new-password" error={fe(state, "confirmPassword")} />
      <SubmitButton size="lg" pendingText="Salvando…">Salvar nova senha</SubmitButton>
    </form>
  );
}

export function OnboardingForm() {
  const [state, action] = useActionState(createSalon, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={topError(state)} />
      <Field name="salonName" label="Nome do salão ou barbearia" error={fe(state, "salonName")} />
      <Field name="phone" label="Telefone (opcional)" type="tel" autoComplete="tel" inputMode="tel" />
      <SubmitButton size="lg" pendingText="Criando…">Criar salão</SubmitButton>
    </form>
  );
}
