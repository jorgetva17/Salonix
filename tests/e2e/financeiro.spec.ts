import { expect, test } from "@playwright/test";
import { signUpUi, uniqueEmail } from "./helpers";

// Pré-requisito: Supabase local + .env.local. Despesas, relatório e exportação CSV (admin).
test("contas a pagar, resultado no relatório e exportação CSV", async ({ page }) => {
  await signUpUi(page, { name: "Dono", salon: "Salão Financeiro", email: uniqueEmail("fin"), password: "senha-segura-123" });
  await page.waitForURL("**/painel");

  await page.goto("/financeiro/contas");
  await page.getByLabel("Categoria").selectOption("aluguel");
  await page.getByLabel("Descrição").fill("Aluguel de novembro");
  await page.getByLabel("Valor (R$)").fill("2.500,00");
  await page.getByLabel("Já foi paga").check();
  await page.getByLabel("Forma de pagamento").selectOption("pix");
  await page.getByRole("button", { name: "Lançar despesa" }).click();
  await expect(page.getByText("Despesa lançada")).toBeVisible();

  await page.getByLabel("Categoria").selectOption("energia");
  await page.getByLabel("Descrição").fill("Conta de luz");
  await page.getByLabel("Valor (R$)").fill("380,00");
  await page.getByRole("button", { name: "Lançar despesa" }).click();
  await expect(page.getByText("Conta de luz")).toBeVisible();
  await page.getByRole("button", { name: "Marcar como paga" }).click();
  await expect(page.getByText("Despesa paga")).toBeVisible();

  await page.goto("/financeiro");
  await expect(page.getByText("Resultado estimado do período")).toBeVisible();
  await expect(page.getByText("-R$ 2.880,00").first()).toBeVisible(); // sem vendas: resultado = -(2.500 + 380)

  const res = await page.request.get("/financeiro/exportar?tipo=despesas");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(await res.text()).toContain("Aluguel de novembro");
});
