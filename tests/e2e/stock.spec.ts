import { expect, test } from "@playwright/test";
import { signUpUi, uniqueEmail } from "./helpers";

// Pré-requisito: Supabase local + .env.local. Estoque baixa sozinho ao receber e volta no estorno.
test("baixa automática de estoque no recebimento e devolução no estorno", async ({ page }) => {
  await signUpUi(page, { name: "Dono", salon: "Salão Estoque", email: uniqueEmail("es"), password: "senha-segura-123" });
  await page.waitForURL("**/painel");

  await page.goto("/servicos");
  await page.getByLabel("Nome").first().fill("Corte");
  await page.getByLabel("Preço (R$)").first().fill("45,00");
  await page.getByRole("button", { name: "Adicionar serviço" }).click();
  await expect(page.getByText("30 min · R$ 45,00")).toBeVisible();

  await page.goto("/profissionais");
  await page.getByLabel("Nome").first().fill("Paulo");
  await page.getByRole("button", { name: "Adicionar profissional" }).click();

  await page.goto("/estoque");
  await page.getByLabel("Nome").first().fill("Shampoo");
  await page.getByLabel("Unidade (un, ml, g…)").first().fill("ml");
  await page.getByLabel("Estoque mínimo").first().fill("100");
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByText("Registrar entrada, saída ou contagem").first().click();
  await page.getByLabel("Quantidade (ml)").fill("500");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(page.getByText("500 ml").first()).toBeVisible();

  await page.getByLabel("Serviço").selectOption({ label: "Corte" });
  await page.getByLabel("Material").selectOption({ label: "Shampoo (ml)" });
  await page.getByLabel("Qtd. por atendimento").fill("20");
  await page.getByRole("button", { name: "Salvar consumo" }).click();
  await expect(page.getByText("usa 20 ml de Shampoo")).toBeVisible();

  // atendimento -> caixa -> receber
  await page.goto("/fila");
  await page.getByLabel("ou nome do cliente (avulso)").fill("Carlos");
  await page.getByRole("checkbox", { name: /Corte/ }).check();
  await page.getByRole("button", { name: "Colocar na fila" }).click();
  await page.getByRole("button", { name: "Chamar próximo" }).click();
  await page.getByRole("link", { name: "Abrir atendimento" }).click();
  await page.getByRole("button", { name: "Concluir atendimento" }).click();
  await page.goto("/caixa");
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await page.getByRole("link", { name: "Receber" }).click();
  await page.getByRole("button", { name: "Receber pagamento" }).click();
  await expect(page.getByText("Pago").first()).toBeVisible();

  await page.goto("/estoque");
  await expect(page.getByText("480 ml").first()).toBeVisible();
});
