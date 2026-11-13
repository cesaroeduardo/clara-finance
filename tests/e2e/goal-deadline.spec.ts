import { test, expect } from "@playwright/test";

test("meta sem grupo usa calendário e prazos futuros", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Metas/ }).click();
  await page.getByRole("button", { name: "Nova meta", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Grupo", { exact: true })).toHaveCount(0);
  await page.getByLabel("Nome da meta").fill("Prazo de teste");
  await page.getByLabel("Valor da meta (R$)").fill("1000,00");
  for (const preset of ["Para 30 dias", "Para 3 meses", "Para 1 ano"]) {
    await page.getByRole("button", { name: /^Escolher prazo:/ }).click();
    await page.getByRole("button", { name: preset, exact: true }).click();
    await expect(page.locator('input[name="deadline"]')).toHaveValue(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  }
  await page.getByRole("button", { name: /^Escolher prazo:/ }).click();
  await page.getByRole("button", { name: "Próximo mês", exact: true }).click();
  await page.locator(".goal-deadline-days button").first().click();
  const deadline = await page.locator('input[name="deadline"]').inputValue();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Editar Prazo de teste", exact: true })
    .click();
  await expect(page.locator('input[name="deadline"]')).toHaveValue(deadline);
});
