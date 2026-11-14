import { test, expect } from "@playwright/test";

test("cria registros e exporta lançamentos sem grupos", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Grupos", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Adicionar", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Nova saída", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Grupo", { exact: true })).toHaveCount(0);
  await dialog
    .getByLabel("Descrição", { exact: true })
    .fill("Despesa sem grupo de verificação");
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("25,50");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Despesa sem grupo de verificação" }),
  ).toBeVisible({ timeout: 15_000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv.split("\n")[0]).not.toContain("Grupo");
  expect(csv).toContain("Despesa sem grupo de verificação");
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Adicionar", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Recorrência", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Grupo", { exact: true })).toHaveCount(0);
  await dialog
    .getByLabel("Descrição", { exact: true })
    .fill("Recorrência sem grupo de verificação");
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill("30,00");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("button", { name: "Recorrentes", exact: true }).click();
  await expect(
    page
      .locator(".recurring-row")
      .filter({ hasText: "Recorrência sem grupo de verificação" }),
  ).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole("button", { name: "Investimentos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adicionar posição", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Grupo", { exact: true })).toHaveCount(0);
  await dialog
    .getByLabel("Nome do investimento")
    .fill("Investimento sem grupo de verificação");
  await dialog
    .getByLabel("Instituição", { exact: true })
    .fill("Banco de teste");
  await dialog.getByLabel("Saldo atual (R$)").fill("150,00");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", {
      name: "Investimento sem grupo de verificação",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await page
    .getByRole("radiogroup", {
      name: "Visualização de categorias",
      exact: true,
    })
    .getByRole("radio", { name: "Configuração", exact: true })
    .click();
  const table = page.getByRole("table", {
    name: "Regras de classificação",
    exact: true,
  });
  await expect(
    table.getByRole("columnheader", { name: "Grupo", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Adicionar regra", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Nova regra", exact: true });
  await expect(dialog.getByLabel("Grupo", { exact: true })).toHaveCount(0);
  await dialog
    .getByLabel("Texto da descrição")
    .fill("Regra sem grupo de verificação");
  await dialog
    .getByRole("button", { name: "Salvar regra", exact: true })
    .click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  await expect(
    table.getByRole("cell", {
      name: "Regra sem grupo de verificação",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
});
