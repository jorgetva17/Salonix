import { z } from "zod";

const email = z
  .string({ error: "Informe um e-mail válido" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Informe um e-mail válido" }));

const password = z
  .string({ error: "Informe a senha" })
  .min(8, { error: "A senha deve ter pelo menos 8 caracteres" });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Informe a senha" }),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, { error: "Informe seu nome" }),
  email,
  password,
  salonName: z.string().trim().min(2, { error: "Informe o nome do salão" }),
});

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    error: "As senhas não conferem",
  });

export const createSalonSchema = z.object({
  salonName: z.string().trim().min(2, { error: "Informe o nome do salão" }),
  phone: z.string().trim().optional(),
});

export const inviteSchema = z.object({
  email,
  role: z.enum(["admin", "reception", "professional"], { error: "Escolha um perfil" }),
  professionalId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
}).refine((v) => !v.professionalId || v.role === "professional", {
  path: ["professionalId"],
  error: "Só é possível vincular um cadastro de profissional ao perfil Profissional",
});

/** Converte erros do Zod em { campo: mensagem } (primeira mensagem de cada campo). */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Mapeia mensagens de erro do Supabase Auth para pt-BR. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Este e-mail já está cadastrado";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde um instante e tente de novo";
  if (m.includes("password") && m.includes("characters"))
    return "A senha deve ter pelo menos 8 caracteres";
  return "Não foi possível concluir. Tente novamente";
}
