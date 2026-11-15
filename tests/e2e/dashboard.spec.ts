import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const PASSWORD = "salonix123";

test("admin vê o dia, a fila, o caixa e os alertas", async ({ page }) => {
  await signIn(page, "admin@salonix.dev", PASSWORD);
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByTestId("dashboard-today")).toBeVisible();
  await expect(page.getByTestId("dashboard-queue")).toBeVisible();
  await expect(page.getByTestId("dashboard-cash")).toContainText(/Caixa (aberto|fechado)/);
  // O seed tem uma máquina com manutenção vencendo em 5 dias.
  const alerts = page.getByTestId("dashboard-alerts");
  await expect(alerts.getByRole("link", { name: /manutenção/i })).toHaveAttribute("href", "/estoque/equipamentos");
  await expect(page.getByText("O resumo do dia aparece aqui")).toHaveCount(0);
});

test("recepção vê o dia e o caixa, sem alertas", async ({ page }) => {
  await signIn(page, "recepcao@salonix.dev", PASSWORD);
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByTestId("dashboard-today")).toBeVisible();
  await expect(page.getByTestId("dashboard-queue")).toBeVisible();
  await expect(page.getByTestId("dashboard-cash")).toBeVisible();
  await expect(page.getByTestId("dashboard-alerts")).toHaveCount(0);
});

test("profissional vê só os próprios atendimentos de hoje", async ({ page }) => {
  await signIn(page, "pro@salonix.dev", PASSWORD);
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByTestId("dashboard-today")).toContainText("Meus atendimentos de hoje");
  await expect(page.getByTestId("dashboard-cash")).toHaveCount(0);
  await expect(page.getByTestId("dashboard-alerts")).toHaveCount(0);
});
