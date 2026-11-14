import { expect, test } from "@playwright/test";
import { bookTomorrow, dayInSaoPaulo, setupSalonWithAgenda } from "./agenda-helpers";
import { signIn } from "./helpers";

test("recepção agenda escolhendo um horário livre e o horário deixa de ser oferecido", async ({ page }) => {
  await setupSalonWithAgenda(page, "agenda");
  await bookTomorrow(page, "Ana Teste", "10:00");

  await expect(page.getByTestId("agenda-appointment").filter({ hasText: "Ana Teste" })).toContainText("10:00");

  await page.getByRole("button", { name: "Agendar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /Corte/ }).check();
  await expect(dialog.getByRole("radio", { name: "10:30" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "10:00" })).toHaveCount(0);
  await expect(dialog.getByRole("radio", { name: "09:45" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Semana" }).click();
  await expect(page.getByTestId(`agenda-day-${dayInSaoPaulo(1)}`)).toContainText("Ana Teste");
});

test("profissional vê a agenda sem o botão de agendar", async ({ page }) => {
  await signIn(page, "pro@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/agenda");
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agendar" })).toHaveCount(0);
});

test("detalhe do atendimento: reagendar, lembrete, iniciar, concluir e cancelar", async ({ page }) => {
  await setupSalonWithAgenda(page, "detalhe");
  await bookTomorrow(page, "Bia Teste", "10:00", "(11) 98765-4321");

  const bia = page.getByTestId("agenda-appointment").filter({ hasText: "Bia Teste" });
  await bia.click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Reagendar" }).click();
  await dialog.getByRole("radio", { name: "11:00" }).click();
  await dialog.getByRole("button", { name: "Confirmar reagendamento" }).click();
  await expect(dialog).toBeHidden();
  await expect(bia).toContainText("11:00");

  await bia.click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("appointment-history")).toContainText("Reagendado");
  await expect(dialog.getByRole("link", { name: "Lembrar no WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/5511987654321\?text=/,
  );
  await dialog.getByRole("button", { name: "Iniciar" }).click();
  await expect(dialog).toBeHidden();

  await bia.click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("appointment-status")).toHaveText("Em atendimento");
  await dialog.getByRole("button", { name: "Concluir" }).click();
  await expect(dialog).toBeHidden();
  await bia.click();
  await expect(page.getByRole("dialog").getByTestId("appointment-status")).toHaveText("Aguardando pagamento");
  await page.keyboard.press("Escape");

  await bookTomorrow(page, "Caio Teste", "14:00");
  await page.getByTestId("agenda-appointment").filter({ hasText: "Caio Teste" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await dialog.getByLabel("Motivo (opcional)").fill("Cliente desmarcou");
  await dialog.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("agenda-appointment").filter({ hasText: "Caio Teste" })).toHaveCount(0);

  await page.getByRole("button", { name: "Agendar" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /Corte/ }).check();
  await expect(dialog.getByRole("radio", { name: "14:00" })).toBeVisible();
});
