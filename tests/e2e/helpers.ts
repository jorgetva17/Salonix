import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@salonix.test`;

export async function signUpUi(page: Page, opts: { name: string; salon: string; email: string; password: string }) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(opts.name);
  await page.getByLabel("Nome do salão ou barbearia").fill(opts.salon);
  await page.getByLabel("E-mail").fill(opts.email);
  await page.getByLabel(/^Senha/).fill(opts.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
}

export async function signInUi(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function logoutUi(page: Page) {
  await page.getByRole("button", { name: "Minha conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.waitForURL("**/entrar");
}
