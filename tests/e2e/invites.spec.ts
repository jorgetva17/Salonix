import { expect, test, type Page } from "@playwright/test";
import { createConfirmedUser, latestEmailLink, signIn, signUpSalon, uniqueEmail } from "./helpers";

async function invite(page: Page, email: string, roleLabel: string) {
  await page.goto("/equipe");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Perfil", { exact: true }).selectOption({ label: roleLabel });
  await page.getByRole("button", { name: "Enviar convite" }).click();
}

test("pessoa nova recebe convite por e-mail, cria senha e entra no salão", async ({ page, browser }) => {
  await signUpSalon(page, { email: uniqueEmail("dono"), salonName: "Barbearia Convite" });
  const guest = uniqueEmail("novo");
  await invite(page, guest, "Recepção");
  await expect(page.getByRole("status")).toContainText(`Convite enviado para ${guest}`);
  await expect(page.getByText(guest, { exact: true })).toBeVisible();

  const guestPage = await (await browser.newContext()).newPage();
  await guestPage.goto(await latestEmailLink(guest));
  await expect(guestPage).toHaveURL(/\/convite\/aceitar$/);
  await expect(guestPage.getByText("Você foi convidado como Recepção.")).toBeVisible();
  await guestPage.getByLabel("Seu nome").fill("Rita Recepção");
  await guestPage.getByLabel("Crie uma senha").fill("senhadarita1");
  await guestPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(guestPage).toHaveURL(/\/painel$/);
  await expect(guestPage.getByRole("heading", { name: "Barbearia Convite" })).toBeVisible();

  await guestPage.context().clearCookies();
  await signIn(guestPage, guest, "senhadarita1");
  await expect(guestPage).toHaveURL(/\/painel$/);
});

test("convite para quem já tem conta aparece ao entrar", async ({ page, browser }) => {
  const existing = uniqueEmail("existente");
  await createConfirmedUser(existing, "Paulo Profissional");
  await signUpSalon(page, { email: uniqueEmail("dono2"), salonName: "Salão Existente" });
  await invite(page, existing, "Profissional");
  await expect(page.getByRole("status")).toContainText("já tem conta");

  const guestPage = await (await browser.newContext()).newPage();
  await signIn(guestPage, existing);
  await expect(guestPage).toHaveURL(/\/convite\/aceitar$/);
  await expect(guestPage.getByLabel("Crie uma senha")).toHaveCount(0);
  await guestPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(guestPage.getByRole("heading", { name: "Salão Existente" })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Paulo Profissional", { exact: true })).toBeVisible();
});

test("recepção não acessa a tela de equipe", async ({ page, browser }) => {
  await signUpSalon(page, { email: uniqueEmail("dono3"), salonName: "Salão Restrito" });
  const rec = uniqueEmail("rec");
  await createConfirmedUser(rec, "Rafa");
  await invite(page, rec, "Recepção");

  const recPage = await (await browser.newContext()).newPage();
  await signIn(recPage, rec);
  await recPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(recPage).toHaveURL(/\/painel$/);
  await recPage.goto("/equipe");
  await expect(recPage).toHaveURL(/\/painel$/);
});
