import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Informe um e-mail válido" }));

const newPassword = z.string().min(8, { error: "A senha deve ter pelo menos 8 caracteres" }).max(72, {
  error: "A senha deve ter no máximo 72 caracteres",
});

const salonName = z
  .string()
  .trim()
  .min(2, { error: "Informe o nome do salão" })
  .max(120, { error: "O nome do salão deve ter no máximo 120 caracteres" });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Informe a senha" }),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, { error: "Informe seu nome" }).max(120),
  email,
  password: newPassword,
  salonName,
});

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    error: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export const createSalonSchema = z.object({ salonName });

/** Primeira mensagem de erro por campo, no formato usado pelos formulários. */
export function firstErrors(result: z.ZodSafeParseResult<unknown>): Record<string, string> {
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
