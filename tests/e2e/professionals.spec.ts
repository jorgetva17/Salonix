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

test("admin define jornada, vê erro de sobreposição e cria férias", async ({ page }) => {
  await signUpSalon(page, { email: uniqueEmail("jornada"), salonName: "Salão da Jornada" });
  await createProfessional(page, "Lia", "40");
  await page.getByRole("link", { name: /Lia/ }).click();

  const tuesday = page.getByTestId("schedule-2");
  await tuesday.getByRole("checkbox", { name: "Terça" }).check();
  await tuesday.getByLabel("Terça, início do intervalo 1").fill("09:00");
  await tuesday.getByLabel("Terça, fim do intervalo 1").fill("12:00");
  await tuesday.getByRole("button", { name: "Adicionar intervalo em Terça" }).click();
  await tuesday.getByLabel("Terça, início do intervalo 2").fill("11:00");
  await tuesday.getByLabel("Terça, fim do intervalo 2").fill("14:00");
  await page.getByRole("button", { name: "Salvar jornada" }).click();
  await expect(tuesday.getByRole("alert")).toHaveText("Horários se sobrepõem em Terça");

  await tuesday.getByLabel("Terça, início do intervalo 2").fill("13:00");
  await tuesday.getByLabel("Terça, fim do intervalo 2").fill("19:00");
  await page.getByRole("button", { name: "Salvar jornada" }).click();
  await expect(page.getByText("Jornada salva")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("schedule-2").getByLabel("Terça, fim do intervalo 2")).toHaveValue("19:00");
  await expect(page.getByTestId("schedule-1").getByText("Não trabalha")).toBeVisible();

  await page.getByLabel("Tipo", { exact: true }).selectOption({ label: "Férias" });
  await page.getByLabel("De", { exact: true }).fill("2030-01-10");
  await page.getByLabel("Até", { exact: true }).fill("2030-01-20");
  await page.getByRole("button", { name: "Adicionar bloqueio" }).click();
  await expect(page.getByTestId("block-row")).toContainText("Férias");
  await expect(page.getByTestId("block-row")).toContainText("10/01/2030 a 20/01/2030");
});
