import { expect, type Page, test } from "@playwright/test";
import { setupSalonWithAgenda } from "./agenda-helpers";
import { signIn } from "./helpers";

async function addWalkIn(page: Page, customer: string) {
  await page.getByRole("button", { name: "Cliente na porta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Cliente", { exact: true }).fill(customer);
  await dialog.getByRole("button", { name: `Cadastrar “${customer}”` }).click();
  await dialog.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(dialog.getByRole("button", { name: "Trocar cliente" })).toBeVisible();
  await dialog.getByRole("checkbox", { name: /Corte/ }).check();
  await dialog.getByRole("button", { name: "Entrar na fila" }).click();
  await expect(dialog).toBeHidden();
}

test("fila de walk-in atualiza ao vivo em outra tela, chama o próximo e registra falta", async ({ page, browser }) => {
  const email = await setupSalonWithAgenda(page, "fila");

  // Segunda tela (outro navegador) acompanhando a fila.
  const other = await (await browser.newContext()).newPage();
  await signIn(other, email);
  await expect(other).toHaveURL(/\/painel$/);
  await other.goto("/agenda/fila");
  await expect(other.getByText("Ninguém na fila")).toBeVisible();

  await page.goto("/agenda/fila");
  await addWalkIn(page, "Gil Teste");

  // Sem recarregar: chega pelo Realtime.
  const gil = other.getByTestId("queue-item").filter({ hasText: "Gil Teste" });
  await expect(gil).toBeVisible();
  await expect(gil).toContainText("qualquer profissional");

  await other.getByRole("button", { name: "Chamar próximo para Rafa" }).click();
  await expect(other.getByTestId("queue-item").filter({ hasText: "Gil Teste" })).toHaveCount(0);
  await expect(other.getByText(/Em atendimento: Gil Teste/)).toBeVisible();
  await expect(page.getByText(/Em atendimento: Gil Teste/)).toBeVisible();

  await addWalkIn(page, "Hugo Teste");
  await page.getByRole("button", { name: "Hugo Teste faltou" }).click();
  await page.getByRole("button", { name: "Confirmar falta" }).click();
  await expect(page.getByTestId("queue-item").filter({ hasText: "Hugo Teste" })).toHaveCount(0);
  await expect(other.getByTestId("queue-item").filter({ hasText: "Hugo Teste" })).toHaveCount(0);
});

test("profissional vê a fila sem o botão de cliente na porta", async ({ page }) => {
  await signIn(page, "pro@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/agenda/fila");
  await expect(page.getByRole("heading", { name: "Fila", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cliente na porta" })).toHaveCount(0);
});
