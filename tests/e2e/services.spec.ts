import { expect, test } from "@playwright/test";
import { signIn, signUpSalon, uniqueEmail } from "./helpers";

test("admin cria, edita e desativa serviço", async ({ page }) => {
  await signUpSalon(page, { email: uniqueEmail("servicos"), salonName: "Salão dos Serviços" });
  await page.goto("/servicos");
  await expect(page.getByText("Nenhum serviço cadastrado")).toBeVisible();

  await page.getByRole("button", { name: "Novo serviço" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Corte masculino");
  await dialog.getByLabel("Duração (min)").fill("30");
  await dialog.getByLabel("Preço (R$)").fill("45,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByTestId("service-row").filter({ hasText: "Corte masculino" });
  await expect(row).toContainText("30 min · R$ 45,00");

  await row.getByRole("button", { name: "Editar Corte masculino" }).click();
  await page.getByRole("dialog").getByLabel("Preço (R$)").fill("50");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(row).toContainText("R$ 50,00");

  await row.getByRole("button", { name: "Desativar" }).click();
  await expect(row).toContainText("inativo");
});

test("preço inválido mostra mensagem no campo", async ({ page }) => {
  await signUpSalon(page, { email: uniqueEmail("servicos2"), salonName: "Salão do Preço" });
  await page.goto("/servicos");
  await page.getByRole("button", { name: "Novo serviço" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Barba");
  await dialog.getByLabel("Preço (R$)").fill("abc");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog.getByText("Informe um preço válido, ex.: 45,00")).toBeVisible();
  // O que foi digitado continua no formulário depois do erro.
  await expect(dialog.getByLabel("Nome")).toHaveValue("Barba");
  await expect(dialog.getByLabel("Preço (R$)")).toHaveValue("abc");
});

test("recepção não acessa serviços", async ({ page }) => {
  await signIn(page, "recepcao@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/servicos");
  await expect(page).toHaveURL(/\/painel$/);
});
