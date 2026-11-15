import { expect, test } from "@playwright/test";
import { signUpUi, uniqueEmail } from "./helpers";

// Pré-requisito: Supabase local + .env.local. Fluxo: fila → atender → concluir → caixa → receber → comissão → estorno.
test("atendimento completo: receber no caixa, gerar comissão e estornar", async ({ page }) => {
  await signUpUi(page, { name: "Dono", salon: "Salão Caixa", email: uniqueEmail("cx"), password: "senha-segura-123" });
  await page.waitForURL("**/painel");

  await page.goto("/servicos");
  await page.getByLabel("Nome").first().fill("Corte");
  await page.getByLabel("Preço (R$)").first().fill("45,00");
  await page.getByRole("button", { name: "Adicionar serviço" }).click();
  await expect(page.getByText("30 min · R$ 45,00")).toBeVisible();

  await page.goto("/profissionais");
  await page.getByLabel("Nome").first().fill("Paulo");
  await page.getByLabel("Comissão padrão (%)").first().fill("40");
  await page.getByRole("button", { name: "Adicionar profissional" }).click();

  await page.goto("/fila");
  await page.getByLabel("ou nome do cliente (avulso)").fill("Carlos");
  await page.getByRole("checkbox", { name: /Corte/ }).check();
  await page.getByRole("button", { name: "Colocar na fila" }).click();
  await page.getByRole("button", { name: "Chamar próximo" }).click();
  await page.getByRole("link", { name: "Abrir atendimento" }).click();
  await page.getByRole("button", { name: "Concluir atendimento" }).click();
  await expect(page.getByText("Receber pagamento").first()).toBeVisible();

  // Sem caixa aberto, o recebimento é recusado
  await page.getByRole("button", { name: "Receber pagamento" }).click();
  await expect(page.getByText("Abra o caixa antes de receber")).toBeVisible();

  await page.goto("/caixa");
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await expect(page.getByText("Caixa aberto")).toBeVisible();
  await page.getByRole("link", { name: "Receber" }).click();
  await page.getByRole("button", { name: "Receber pagamento" }).click();
  await expect(page.getByText("Pago").first()).toBeVisible();
  await expect(page.getByText("40% de R$ 45,00")).toBeVisible();

  // Estorno (admin)
  await page.getByLabel("Motivo do estorno").fill("Cobrança duplicada");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Estornar atendimento" }).click();
  await expect(page.getByText("Cancelado").first()).toBeVisible();
});
