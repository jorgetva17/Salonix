import { expect, type Page } from "@playwright/test";
import { signUpSalon, uniqueEmail } from "./helpers";

/** Data de hoje + n dias no fuso do salão (YYYY-MM-DD). */
export function dayInSaoPaulo(offsetDays: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Salão novo com serviço "Corte" (30 min) e a profissional "Rafa" trabalhando todos os dias 09:00–18:00. */
export async function setupSalonWithAgenda(page: Page, label: string) {
  await signUpSalon(page, { email: uniqueEmail(label), salonName: `Salão ${label}`, fullName: "Dona Ana" });

  await page.goto("/servicos");
  await page.getByRole("button", { name: "Novo serviço" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Corte");
  await dialog.getByLabel("Preço (R$)").fill("40");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/profissionais");
  await page.getByRole("button", { name: "Novo profissional" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Rafa");
  await dialog.getByLabel("Comissão padrão (%)").fill("40");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: /Rafa/ }).click();
  for (const day of ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]) {
    await page.getByRole("checkbox", { name: day, exact: true }).check();
  }
  await page.getByRole("button", { name: "Salvar jornada" }).click();
  await expect(page.getByText("Jornada salva")).toBeVisible();
}

export async function bookTomorrow(page: Page, customer: string, time: string) {
  await page.goto(`/agenda?data=${dayInSaoPaulo(1)}`);
  await page.getByRole("button", { name: "Agendar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Cliente", { exact: true }).fill(customer);
  await dialog.getByRole("button", { name: `Cadastrar “${customer}”` }).click();
  await dialog.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(dialog.getByRole("button", { name: "Trocar cliente" })).toBeVisible();
  await dialog.getByRole("checkbox", { name: /Corte/ }).check();
  await dialog.getByRole("radio", { name: time }).click();
  await dialog.getByRole("button", { name: "Agendar" }).click();
  await expect(dialog).toBeHidden();
}
