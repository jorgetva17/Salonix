import { expect, test } from "@playwright/test";
import { dayInSaoPaulo } from "./agenda-helpers";
import { openCash } from "./cash-helpers";
import { signIn, signUpSalon, uniqueEmail } from "./helpers";

async function newBill(page: import("@playwright/test").Page, bill: { category: string; description: string; amount: string; due: string; paid?: string }) {
  await page.getByRole("button", { name: "Nova conta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Categoria").selectOption({ label: bill.category });
  await dialog.getByLabel("Descrição").fill(bill.description);
  await dialog.getByLabel("Valor (R$)").fill(bill.amount);
  await dialog.getByLabel("Vencimento").fill(bill.due);
  if (bill.paid) await dialog.getByLabel("Já paga em").selectOption({ label: bill.paid });
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();
}

test("contas a pagar: lançar, pagar e cancelar", async ({ page }) => {
  test.slow();
  await signUpSalon(page, { email: uniqueEmail("contas"), salonName: "Salão Contas" });
  await page.goto("/financeiro/contas");
  await expect(page.getByText("Nenhuma conta")).toBeVisible();

  await newBill(page, { category: "Aluguel", description: "Aluguel novembro", amount: "1.500,00", due: dayInSaoPaulo(0) });
  const aluguel = page.getByTestId("bill").filter({ hasText: "Aluguel novembro" });
  await expect(aluguel).toContainText("Vence em breve");
  await expect(page.getByTestId("bills-open")).toHaveText("R$ 1.500,00");

  // Conta paga em dinheiro sai da gaveta.
  await openCash(page, "100,00");
  await page.goto("/financeiro/contas");
  await newBill(page, { category: "Outros", description: "Luz", amount: "80,00", due: dayInSaoPaulo(0), paid: "Dinheiro" });
  await page.goto("/caixa");
  await expect(page.getByTestId("expected-cash")).toHaveText("R$ 20,00");

  await page.goto("/financeiro/contas");
  await aluguel.getByRole("button", { name: "Pagar" }).click();
  await aluguel.getByLabel("Forma de pagamento").selectOption({ label: "Pix" });
  await aluguel.getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.getByText("Conta paga.")).toBeVisible();
  await page.goto("/financeiro/contas?status=todas");
  await expect(page.getByTestId("bill").filter({ hasText: "Aluguel novembro" })).toContainText("Paga");

  await newBill(page, { category: "Fornecedor", description: "Distribuidora", amount: "640,00", due: dayInSaoPaulo(10) });
  const forn = page.getByTestId("bill").filter({ hasText: "Distribuidora" });
  await forn.getByRole("button", { name: "Cancelar" }).click();
  await forn.getByRole("button", { name: "Cancelar conta" }).click();
  await expect(forn).toContainText("Cancelada");
});

test("recepção não abre as contas", async ({ page }) => {
  await signIn(page, "recepcao@salonix.dev", "salonix123");
  await expect(page).toHaveURL(/\/painel$/);
  await page.goto("/financeiro/contas");
  await expect(page).toHaveURL(/\/painel$/);
});
