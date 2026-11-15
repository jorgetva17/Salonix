import { expect, test } from "@playwright/test";
import { adminClient, signUpUi, uniqueEmail } from "./helpers";

// Pré-requisito: Supabase local rodando + .env.local. Cria salão, serviço e profissional
// via UI/admin client e exercita agendamento, fila e chamada do próximo.
test("agendar, conflito, fila de walk-in e chamar próximo", async ({ page }) => {
  await signUpUi(page, { name: "Dono", salon: "Salão Agenda", email: uniqueEmail("ag"), password: "senha-segura-123" });
  await page.waitForURL("**/painel");

  await page.goto("/servicos");
  await page.getByLabel("Nome").first().fill("Corte");
  await page.getByLabel("Preço (R$)").first().fill("45,00");
  await page.getByRole("button", { name: "Adicionar serviço" }).click();
  await expect(page.getByText("30 min · R$ 45,00")).toBeVisible();

  await page.goto("/profissionais");
  await page.getByLabel("Nome").first().fill("Paulo");
  await page.getByRole("button", { name: "Adicionar profissional" }).click();
  await page.getByRole("link", { name: /Paulo/ }).click();
  for (let weekday = 0; weekday < 7; weekday++) {
    await page.getByLabel("Dia").selectOption(String(weekday));
    await page.getByRole("button", { name: "Adicionar horário" }).click();
  }

  // Agenda: amanhã 10:00 e conflito às 10:15
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  await page.goto("/agenda");
  const book = async (time: string) => {
    await page.getByLabel("ou nome do cliente (avulso)").fill("Cliente Teste");
    await page.getByLabel("Profissional", { exact: true }).last().selectOption({ label: "Paulo" });
    await page.getByLabel("Data e hora").fill(`${tomorrow}T${time}`);
    await page.getByRole("checkbox", { name: /Corte/ }).check();
    await page.getByRole("button", { name: "Agendar" }).click();
  };
  await book("10:00");
  await expect(page.getByText("Agendamento criado")).toBeVisible();
  await book("10:15");
  await expect(page.getByText("Horário indisponível")).toBeVisible();

  // Fila
  await page.goto("/fila");
  await page.getByLabel("ou nome do cliente (avulso)").fill("Carlos");
  await page.getByRole("checkbox", { name: /Corte/ }).check();
  await page.getByRole("button", { name: "Colocar na fila" }).click();
  await expect(page.getByText("Carlos")).toBeVisible();
  await expect(page.getByText("Pode ser chamado agora")).toBeVisible();
  await page.getByRole("button", { name: "Chamar próximo" }).click();
  await expect(page.getByText("Atendendo Carlos")).toBeVisible();
  void adminClient;
});
