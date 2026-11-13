import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "segredo123";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.salonix.dev`;
}

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createConfirmedUser(email: string, fullName = "Pessoa Teste") {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user;
}

export async function signUpSalon(page: Page, opts: { email: string; salonName: string; fullName?: string }) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(opts.fullName ?? "Ana Souza");
  await page.getByLabel("Nome do salão ou barbearia").fill(opts.salonName);
  await page.getByLabel("E-mail").fill(opts.email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/painel$/);
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

const MAILPIT = "http://127.0.0.1:54324";

/** Busca o link do último e-mail enviado para o endereço (Mailpit do Supabase local). */
export async function latestEmailLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as {
        HTML: string;
        Text: string;
      };
      const match = (msg.HTML || msg.Text).match(/href="([^"]+)"/) ?? msg.Text.match(/(https?:\/\/\S+)/);
      if (match) return match[1].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nenhum e-mail para ${email}`);
}
