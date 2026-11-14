import { test, expect } from "@playwright/test";
test.setTimeout(60_000);
test("criar, filtrar, editar e excluir lançamento com persistência", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Você ainda pode gastar" }),
  ).toBeVisible();
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Adicionar", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Nova saída" }).click();
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Lançamento de verificação");
  await page.getByLabel("Valor (R$)", { exact: true }).fill("123,45");
  await page.getByRole("combobox", { name: "Categoria", exact: true }).click();
  await page.getByRole("option", { name: "Alimentação", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar lançamento" })
    .fill("Lançamento de verificação");
  await expect(page.getByRole("cell", { name: "− R$ 123,45" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar lançamento" })
    .fill("Lançamento de verificação");
  await page
    .getByRole("button", {
      name: "Editar Lançamento de verificação",
      exact: true,
    })
    .click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("130,01");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "− R$ 130,01" })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Editar Lançamento de verificação",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Excluir registro" }).click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(page.getByText("Nenhum lançamento encontrado")).toBeVisible();
});
test("metas gravam no modo pessoal", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Você ainda pode gastar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Metas/ }).click();
  await page.getByRole("button", { name: "Nova meta" }).click();
  await page.getByLabel("Nome da meta").fill("Reserva de verificação");
  await page.getByLabel("Valor da meta (R$)", { exact: true }).fill("1000,00");
  await page.getByLabel("Valor reservado (R$)", { exact: true }).fill("100,00");
  await page.getByRole("button", { name: /^Escolher prazo:/ }).click();
  await page.getByRole("button", { name: "Para 1 ano", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("10%")).toBeVisible();
  await page
    .getByRole("button", { name: "Opções da meta Reserva de verificação" })
    .click();
  await page
    .getByRole("menuitem", { name: "Registrar progresso", exact: true })
    .click();
  await page.getByLabel("Valor reservado (R$)").fill("100,00");
  await page
    .getByRole("button", { name: "Registrar progresso", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("20%")).toBeVisible();
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await expect(page.getByText("Nenhum lançamento encontrado")).toBeVisible();
});
test("navegação mobile, tema, privacidade e telas sem erro de execução", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Você ainda pode gastar" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Ocultar valores" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/values-hidden/);
  expect(await page.locator(".amount").allTextContents()).toEqual(
    expect.arrayContaining(["••••••"]),
  );
  await page.getByRole("button", { name: "Usar tema escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page
    .getByRole("button", { name: "Investimentos", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Carteira" })).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
});
test("posição de investimento manual é criada, atualizada e removida", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Investimentos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adicionar posição", exact: true })
    .click();
  await page.getByLabel("Nome do investimento").fill("Tesouro de verificação");
  await page.getByLabel("Instituição", { exact: true }).fill("Banco teste");
  await page.getByLabel("Saldo atual (R$)").fill("1100,80");
  await page.getByLabel("Custo de aquisição (R$)").fill("1000,70");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("R$ 1.100,80").first()).toBeVisible();
  await page.getByRole("button", { name: /Tesouro de verificação/ }).click();
  await page.getByLabel("Saldo atual (R$)").fill("1200,30");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("R$ 1.200,30").first()).toBeVisible();
  await page.getByRole("button", { name: /Tesouro de verificação/ }).click();
  await page.getByRole("button", { name: "Excluir registro" }).click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(page.getByText("Nenhum investimento")).toBeVisible();
});
test("filtros de tipo e exportação refletem a consulta da tabela", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Contas", exact: true }).click();
  await page.getByRole("switch", { name: "Dados fictícios" }).check();
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar lançamento" })
    .fill("Salário");
  await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
  await page.getByRole("option", { name: "Saídas", exact: true }).click();
  await expect(page.getByText("Nenhum lançamento encontrado")).toBeVisible();
  await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
  await page.getByRole("option", { name: "Entradas", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Editar Salário", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^clara-lancamentos-\d{4}-\d{2}\.csv$/,
  );
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("Salário");
  expect(csv).not.toContain("Netflix");
});
