import { expect, type Page, test } from "@playwright/test";
import { setupSalonWithAgenda } from "./agenda-helpers";
import { adminClient, signIn } from "./helpers";

async function addWalkIn(page: Page, customer: string) {
  await page.getByRole("button", { name: "Cliente na porta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Cliente", { exact: true }).fill(customer);
  await dialog.getByRole("button", { name: `Cadastrar “${customer}” com WhatsApp` }).click();
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

test("cliente novo entra na fila só com o nome digitado", async ({ page }) => {
  await setupSalonWithAgenda(page, "fila-rapida");
  await page.goto("/agenda/fila");
  await page.getByRole("button", { name: "Cliente na porta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Cliente", { exact: true }).fill("Ivo Rápido");
  await dialog.getByRole("checkbox", { name: /Corte/ }).check();
  await dialog.getByRole("button", { name: "Entrar na fila" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("queue-item").filter({ hasText: "Ivo Rápido" })).toBeVisible();
});

test("walk-in que ficou de outro dia sai da fila de hoje e pode ser removido", async ({ page }) => {
  await setupSalonWithAgenda(page, "fila-velha");
  await page.goto("/agenda/fila");
  await addWalkIn(page, "Jaime Antigo");
  await expect(page.getByTestId("queue-item").filter({ hasText: "Jaime Antigo" })).toBeVisible();

  const admin = adminClient();
  const { data: customer } = await admin.from("customers").select("id").eq("name", "Jaime Antigo").order("created_at", { ascending: false }).limit(1).single();
  await admin
    .from("appointments")
    .update({ arrived_at: new Date(Date.now() - 2 * 86_400_000).toISOString() })
    .eq("customer_id", customer!.id);

  await page.reload();
  await expect(page.getByTestId("queue-item").filter({ hasText: "Jaime Antigo" })).toHaveCount(0);
  await expect(page.getByTestId("stale-queue")).toContainText("Jaime Antigo");
  await page.getByRole("button", { name: "Remover Jaime Antigo da fila" }).click();
  await page.getByRole("button", { name: "Confirmar remoção" }).click();
  await expect(page.getByTestId("stale-queue")).toHaveCount(0);
});
