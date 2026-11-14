import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Os testes usam o salão de demonstração; nome e telefone únicos evitam colisão entre execuções.
const suffix = String(Date.now()).slice(-6);
const name = `João Teste ${suffix}`;
const phoneDigits = `119${suffix}${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;
const phoneFormatted = `(11) ${phoneDigits.slice(2, 7)}-${phoneDigits.slice(7)}`;

test("recepção cadastra cliente, busca sem acento e por telefone, e vê aviso de duplicado", async ({ page }) => {
  await signIn(page, "recepcao@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/clientes");

  await page.getByRole("button", { name: "Novo cliente" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill(name);
  await dialog.getByLabel("WhatsApp (opcional)").fill(phoneFormatted);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("searchbox").fill(`joao teste ${suffix}`);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByTestId("customer-row")).toHaveCount(1);
  await expect(page.getByTestId("customer-row")).toContainText(phoneFormatted);

  await page.getByRole("searchbox").fill(phoneDigits.slice(2, 7));
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByTestId("customer-row").filter({ hasText: name })).toBeVisible();

  await page.getByRole("button", { name: "Novo cliente" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Outra Pessoa");
  await dialog.getByLabel("WhatsApp (opcional)").fill(phoneDigits);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog.getByText("Já existe um cliente com este telefone.")).toBeVisible();
  await expect(dialog.getByLabel("Nome")).toHaveValue("Outra Pessoa");
  await expect(dialog.getByLabel("WhatsApp (opcional)")).toHaveValue(phoneDigits);
});

test("busca sem resultado mostra estado vazio", async ({ page }) => {
  await signIn(page, "recepcao@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/clientes?q=ninguem-com-este-nome");
  await expect(page.getByText("Nada encontrado")).toBeVisible();
});

test("profissional vê clientes, mas não cadastra", async ({ page }) => {
  await signIn(page, "pro@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/clientes");
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo cliente" })).toHaveCount(0);
});
