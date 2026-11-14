import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Requer `npm run db:reset` antes (carrega supabase/seed.sql).
test.describe("usuários de demonstração do seed", () => {
  for (const [email, extraLink] of [
    ["admin@salonix.dev", "Equipe"],
    ["recepcao@salonix.dev", "Caixa"],
    ["pro@salonix.dev", "Meus ganhos"],
  ] as const) {
    test(`${email} entra na Barbearia Demo`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await signIn(page, email, "salonix123");
      await expect(page).toHaveURL(/\/painel$/);
      await expect(page.getByRole("heading", { name: "Barbearia Demo" })).toBeVisible();
      await expect(page.locator("aside").getByRole("link", { name: extraLink })).toBeVisible();
    });
  }
});

test.describe("cadastros de demonstração do seed", () => {
  test("admin vê serviços e profissionais de demonstração", async ({ page }) => {
    await signIn(page, "admin@salonix.dev", "salonix123");
    await expect(page).toHaveURL(/\/painel$/);
    await page.goto("/servicos");
    await expect(page.getByTestId("service-row").filter({ hasText: "Corte masculino" })).toContainText(
      "30 min · R$ 45,00",
    );
    await page.goto("/profissionais");
    await expect(page.getByRole("link", { name: /Paulo Profissional/ })).toContainText("Com acesso ao app");
    await expect(page.getByRole("link", { name: /Marcos/ })).toContainText("Sem login");
  });

  test("recepção vê clientes de demonstração", async ({ page }) => {
    await signIn(page, "recepcao@salonix.dev", "salonix123");
    await expect(page).toHaveURL(/\/painel$/);
    await page.goto("/clientes?q=carlos");
    await expect(page.getByTestId("customer-row").filter({ hasText: "Carlos Cliente" })).toBeVisible();
  });
});

/** Próxima terça estritamente depois de hoje, em São Paulo (mesma regra do seed). */
function nextTuesday(): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (((2 - d.getUTCDay() + 7) % 7) || 7));
  return d.toISOString().slice(0, 10);
}

test.describe("agenda de demonstração do seed", () => {
  test("recepção vê o agendamento e a fila de demonstração", async ({ page }) => {
    await signIn(page, "recepcao@salonix.dev", "salonix123");
    await expect(page).toHaveURL(/\/painel$/);
    await page.goto(`/agenda?data=${nextTuesday()}`);
    await expect(page.getByTestId("agenda-appointment").filter({ hasText: "Carlos Cliente" })).toContainText("10:00");
    await page.goto("/agenda/fila");
    await expect(page.getByTestId("queue-item").filter({ hasText: "Bruna Souza" })).toBeVisible();
  });
});

test.describe("caixa e comissões de demonstração do seed", () => {
  test("recepção vê o caixa aberto e o Diego aguardando pagamento", async ({ page }) => {
    await signIn(page, "recepcao@salonix.dev", "salonix123");
    await expect(page).toHaveURL(/\/painel$/);
    await page.goto("/caixa");
    await expect(page.getByText(/Aberto em .* com R\$ 100,00/)).toBeVisible();
    await expect(page.getByTestId("expected-cash")).toHaveText("R$ 180,00");
    await expect(page.getByTestId("awaiting-payment")).toContainText("Diego Souza");
  });

  test("admin vê a comissão disponível do Paulo no mês", async ({ page }) => {
    await signIn(page, "admin@salonix.dev", "salonix123");
    await expect(page).toHaveURL(/\/painel$/);
    await page.goto("/financeiro");
    await expect(page.getByTestId("commissions-Paulo Profissional").getByTestId("commission-available")).toHaveText("R$ 18,00");
    await expect(page.getByTestId("commissions-Marcos").getByTestId("commission-available")).toHaveText("R$ 17,50");
  });
});
