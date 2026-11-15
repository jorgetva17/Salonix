import { expect, test } from "@playwright/test";
import { signUpUi, uniqueEmail } from "./helpers";

test("admin cadastra serviço, profissional (com jornada e comissão) e cliente", async ({ page }) => {
  await signUpUi(page, { name: "Dono", salon: "Salão Cadastros", email: uniqueEmail("cat"), password: "senha-segura-123" });
  await page.waitForURL("**/painel");

  // Serviço
  await page.goto("/servicos");
  await page.getByLabel("Nome").first().fill("Corte");
  await page.getByLabel("Preço (R$)").first().fill("45,00");
  await page.getByRole("button", { name: "Adicionar serviço" }).click();
  await expect(page.getByText("30 min · R$ 45,00")).toBeVisible();

  // Profissional + jornada + exceção de comissão
  await page.goto("/profissionais");
  await page.getByLabel("Nome").first().fill("Paulo");
  await page.getByLabel("Comissão padrão (%)").first().fill("40");
  await page.getByRole("button", { name: "Adicionar profissional" }).click();
  await page.getByRole("link", { name: /Paulo/ }).click();
  await page.getByRole("button", { name: "Adicionar horário" }).click();
  await expect(page.getByText("09:00 às 18:00")).toBeVisible();
  await page.getByLabel("Serviço").selectOption({ label: "Corte" });
  await page.getByLabel("Comissão (%)").fill("50");
  await page.getByRole("button", { name: "Salvar comissão" }).click();
  await expect(page.getByText("Corte").last()).toBeVisible();
  await expect(page.getByText("50%")).toBeVisible();

  // Cliente + busca
  await page.goto("/clientes");
  await page.getByLabel("Nome").first().fill("Maria Souza");
  await page.getByLabel("WhatsApp (com DDD)").first().fill("(85) 99999-0000");
  await page.getByRole("button", { name: "Adicionar cliente" }).click();
  await expect(page.getByText("(85) 99999-0000")).toBeVisible();
  await page.getByLabel("Buscar clientes").fill("zzz");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Nenhum cliente encontrado")).toBeVisible();
});
