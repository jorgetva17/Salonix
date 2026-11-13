import { z } from "zod";

export const SALON_ROLES = ["admin", "reception", "professional"] as const;

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Informe um e-mail válido" })),
  role: z.enum(SALON_ROLES, { error: "Escolha um perfil" }),
});

export const acceptWithPasswordSchema = z.object({
  fullName: z.string().trim().min(2, { error: "Informe seu nome" }).max(120),
  password: z.string().min(8, { error: "A senha deve ter pelo menos 8 caracteres" }).max(72),
});
