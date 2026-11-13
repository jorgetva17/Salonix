const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos",
  user_already_exists: "Este e-mail já está cadastrado",
  email_exists: "Este e-mail já está cadastrado",
  weak_password: "Senha muito fraca. Use pelo menos 8 caracteres.",
  same_password: "A nova senha deve ser diferente da atual",
  email_not_confirmed: "Confirme seu e-mail antes de entrar",
  over_email_send_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
};

export function authErrorMessage(code: string | undefined): string {
  return (code && AUTH_ERRORS[code]) || "Não foi possível concluir. Tente novamente.";
}

export const DEFAULT_AFTER_LOGIN = "/painel";

/** Aceita apenas caminhos internos, evitando redirecionamento para outros sites. */
export function safeNextPath(next: string | null | undefined): string {
  // Caracteres de controle e "\" são descartados/convertidos pelo navegador e
  // podem transformar "/\t/site.com" em "//site.com".
  if (!next || !next.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(next)) return DEFAULT_AFTER_LOGIN;
  const base = "http://salonix.invalid";
  const url = new URL(next, base);
  if (url.origin !== base) return DEFAULT_AFTER_LOGIN;
  return url.pathname + url.search + url.hash;
}
