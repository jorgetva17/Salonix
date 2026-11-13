import type { SalonRole } from "@/lib/salon/membership";

export type InviteMailer = {
  inviteUserByEmail: (
    email: string,
    options: { redirectTo: string },
  ) => Promise<{ error: { code?: string; message: string } | null }>;
};

const EXISTING_USER_CODES = new Set(["email_exists", "user_already_exists"]);

/**
 * Envia o e-mail de convite do Supabase Auth. Se a pessoa já tem conta, o Auth
 * recusa o envio; o convite continua válido e aparece quando ela entrar.
 */
export async function sendInviteEmail(
  mailer: InviteMailer,
  email: string,
  redirectTo: string,
): Promise<{ existingUser: boolean }> {
  const { error } = await mailer.inviteUserByEmail(email, { redirectTo });
  if (!error) return { existingUser: false };
  if (error.code && EXISTING_USER_CODES.has(error.code)) return { existingUser: true };
  throw new Error(error.message);
}

export const ROLE_LABELS: Record<SalonRole, string> = {
  admin: "Administrador",
  reception: "Recepção",
  professional: "Profissional",
};

/** Pessoa que chegou pelo e-mail de convite e ainda não definiu uma senha. */
export function needsPasswordSetup(
  user: { invited_at?: string | null; user_metadata?: Record<string, unknown> } | null,
): boolean {
  return Boolean(user?.invited_at && !user.user_metadata?.password_set);
}
