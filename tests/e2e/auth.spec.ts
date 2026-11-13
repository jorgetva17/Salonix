import { expect, test } from "@playwright/test";
import { createConfirmedUser, latestEmailLink, signIn, signUpSalon, uniqueEmail } from "./helpers";

test("cadastro cria o salão e leva ao painel", async ({ page }) => {
  const email = uniqueEmail("cadastro");
  await signUpSalon(page, { email, salonName: "Barbearia do Teste" });
  await expect(page.getByRole("heading", { name: "Barbearia do Teste" })).toBeVisible();
});

test("login depois de sair volta ao painel", async ({ page, context }) => {
  const email = uniqueEmail("login");
  await signUpSalon(page, { email, salonName: "Salão Login" });
  await context.clearCookies();
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel$/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole("heading", { name: "Salão Login" })).toBeVisible();
});

test("senha errada mostra mensagem em pt-BR", async ({ page }) => {
  const email = uniqueEmail("errada");
  await createConfirmedUser(email);
  await signIn(page, email, "senhaerrada1");
  await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
});

test("usuário sem salão é levado ao onboarding e cria o salão", async ({ page }) => {
  const email = uniqueEmail("semsalao");
  await createConfirmedUser(email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Nome do salão ou barbearia").fill("Salão Recuperado");
  await page.getByRole("button", { name: "Criar salão" }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole("heading", { name: "Salão Recuperado" })).toBeVisible();
});

test("recuperar senha envia link que abre a tela de nova senha", async ({ page }) => {
  const email = uniqueEmail("recupera");
  await createConfirmedUser(email);
  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status")).toContainText("Se houver uma conta com esse e-mail");

  await page.goto(await latestEmailLink(email));
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  await page.getByLabel("Nova senha", { exact: true }).fill("novasenha123");
  await page.getByLabel("Confirme a nova senha").fill("novasenha123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).toHaveURL(/\/(painel|onboarding)$/);

  await page.context().clearCookies();
  await signIn(page, email, "novasenha123");
  await expect(page).toHaveURL(/\/onboarding$/);
});
