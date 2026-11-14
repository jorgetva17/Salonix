import { expect, type Page, test } from "@playwright/test";
import { signIn, signUpSalon, uniqueEmail } from "./helpers";

async function createService(page: Page, name: string) {
  await page.goto("/servicos");
  await page.getByRole("button", { name: "Novo serviço" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill(name);
  await dialog.getByLabel("Preço (R$)").fill("40");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();
}

async function createProfessional(page: Page, name: string, commission: string) {
  await page.goto("/profissionais");
  await page.getByRole("button", { name: "Novo profissional" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill(name);
  await dialog.getByRole("radio", { name: "Cor 3" }).click();
  await dialog.getByLabel("Comissão padrão (%)").fill(commission);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();
}

test("admin cadastra profissional, vincula acesso e define comissão por serviço", async ({ page }) => {
  await signUpSalon(page, { email: uniqueEmail("pros"), salonName: "Salão dos Profissionais", fullName: "Dona Ana" });
  await createService(page, "Barba");
  await createProfessional(page, "Marcos", "50");

  await expect(page.getByRole("link", { name: /Marcos/ })).toContainText("Comissão 50% · Sem login");
  await page.getByRole("link", { name: /Marcos/ }).click();
  await expect(page.getByRole("heading", { name: "Marcos" })).toBeVisible();

  await page.getByLabel("Pessoa da equipe").selectOption({ label: "Dona Ana" });
  await expect(page.getByText("Acesso vinculado")).toBeVisible();

  const barba = page.getByLabel("Barba");
  await barba.fill("60");
  await barba.blur();
  await expect(page.getByText("Comissão de Barba salva")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Pessoa da equipe")).toHaveValue(/.+/);
  await expect(page.getByLabel("Barba")).toHaveValue("60");
  await expect(page.getByLabel("Comissão padrão (%)")).toHaveValue("50");

  await page.goto("/profissionais");
  await expect(page.getByRole("link", { name: /Marcos/ })).toContainText("Com acesso ao app");
});

test("comissão inválida mostra mensagem no campo", async ({ page }) => {
  await signUpSalon(page, { email: uniqueEmail("pros2"), salonName: "Salão da Comissão" });
  await page.goto("/profissionais");
  await page.getByRole("button", { name: "Novo profissional" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Teo");
  await dialog.getByLabel("Comissão padrão (%)").fill("120");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog.getByText("Entre 0 e 100%")).toBeVisible();
});

test("profissional não acessa a tela de profissionais", async ({ page }) => {
  await signIn(page, "pro@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/profissionais");
  await expect(page).toHaveURL(/\/painel$/);
});
