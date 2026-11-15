import { expect, test } from "@playwright/test";
import { dayInSaoPaulo } from "./agenda-helpers";
import { signIn, signUpSalon, uniqueEmail } from "./helpers";

test("equipamento com manutenção e aviso da próxima", async ({ page }) => {
  await signUpSalon(page, { email: uniqueEmail("equip"), salonName: "Salão Equipamentos" });
  await page.goto("/estoque/equipamentos");
  await page.getByRole("button", { name: "Novo equipamento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Máquina de corte");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();

  const card = page.getByTestId("equipment-Máquina de corte");
  await card.getByText("Manutenções (0)").click();
  await card.getByLabel("Descrição").fill("Troca de lâmina");
  await card.getByLabel("Custo (R$)").fill("80,00");
  await card.getByLabel("Próxima manutenção").fill(dayInSaoPaulo(3));
  await card.getByRole("button", { name: "Registrar manutenção" }).click();
  await expect(page.getByText("Manutenção registrada.")).toBeVisible();
  await expect(card.getByTestId("maintenance-status")).toHaveText("Manutenção próxima");
  await expect(card.getByTestId("maintenance-history")).toContainText("R$ 80,00");
  await expect(page.getByTestId("equipment-summary")).toHaveText("1 com manutenção atrasada ou próxima");

  await card.getByLabel("Status de Máquina de corte").selectOption({ label: "Em manutenção" });
  await expect(card.getByTestId("equipment-status")).toHaveText("Em manutenção");
});

test("profissional consulta equipamentos sem cadastrar", async ({ page }) => {
  await signIn(page, "pro@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/estoque/equipamentos");
  await expect(page.getByRole("heading", { name: "Equipamentos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo equipamento" })).toHaveCount(0);
});
