import { expect, test } from "@playwright/test";
import { MAILPIT, adminClient, logoutUi, signInUi, signUpUi, uniqueEmail } from "./helpers";

const PASSWORD = "senha-segura-123";

test("cadastro cria o salão e leva ao painel", async ({ page }) => {
  await signUpUi(page, { name: "Ana Dona", salon: "Barbearia Teste", email: uniqueEmail("cad"), password: PASSWORD });
  await page.waitForURL("**/painel");
  await expect(page.getByText("Barbearia Teste").first()).toBeVisible();
});

test("logout e novo login com a mesma conta", async ({ page }) => {
  const email = uniqueEmail("login");
  await signUpUi(page, { name: "Beto", salon: "Salão Login", email, password: PASSWORD });
  await page.waitForURL("**/painel");
  await logoutUi(page);
  await signInUi(page, email, PASSWORD);
  await page.waitForURL("**/painel");
});

test("senha errada mostra mensagem em pt-BR", async ({ page }) => {
  const email = uniqueEmail("errada");
  await signUpUi(page, { name: "Caio", salon: "Salão Erro", email, password: PASSWORD });
  await page.waitForURL("**/painel");
  await logoutUi(page);
  await signInUi(page, email, "senha-errada-999");
  await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
});

// Review Focus 1: usuário sem salão nunca fica preso.
test("usuário sem salão cai no onboarding e consegue criar o salão", async ({ page }) => {
  const email = uniqueEmail("semsalao");
  const { error } = await adminClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Dani" } });
  expect(error).toBeNull();
  await signInUi(page, email, PASSWORD);
  await page.waitForURL("**/onboarding");
  await page.getByLabel("Nome do salão ou barbearia").fill("Salão Recuperado");
  await page.getByRole("button", { name: "Criar salão" }).click();
  await page.waitForURL("**/painel");
  await expect(page.getByText("Salão Recuperado").first()).toBeVisible();
});

test("recuperar senha envia e-mail com link para /redefinir-senha", async ({ page }) => {
  const email = uniqueEmail("reset");
  const { error } = await adminClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  expect(error).toBeNull();
  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status")).toContainText("Se o e-mail estiver cadastrado");

  let link: string | undefined;
  for (let i = 0; i < 20 && !link; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
    const msg = list.messages?.find((m: { To: { Address: string }[] }) => m.To.some((t) => t.Address === email));
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      link = (full.HTML as string).match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    } else {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  expect(link, "e-mail de recuperação no Mailpit").toBeTruthy();
  await page.goto(link!);
  await page.waitForURL("**/redefinir-senha");
});
