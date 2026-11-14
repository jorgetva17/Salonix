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
