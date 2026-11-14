import { test, expect, type Page } from "@playwright/test";
import type { FinanceData } from "../../src/lib/types";

test.setTimeout(60_000);

async function showConfiguration(page: Page) {
  await page
    .getByRole("radiogroup", {
      name: "Visualização de categorias",
      exact: true,
    })
    .getByRole("radio", { name: "Configuração", exact: true })
    .click();
}

async function filterCategory(page: Page, name: string) {
  await page
    .getByRole("combobox", {
      name: "Filtrar regras por categoria",
      exact: true,
    })
    .click();
  await page.getByRole("option", { name, exact: true }).click();
}

test("configuração mostra tabela, filtra e permite gerenciar regras persistidas", async ({
  page,
  request,
}) => {
  const data = (await (
    await request.get("/api/data?mode=personal")
  ).json()) as FinanceData;
  await page.goto("/");
  await page.getByRole("button", { name: /^Categorias/ }).click();
  const selector = page.getByRole("radiogroup", {
    name: "Visualização de categorias",
    exact: true,
  });
  await expect(
    selector.getByRole("radio", { name: "Categorias", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("button", { name: "Editar Alimentação", exact: true }),
  ).toContainText("Padrão");
  await showConfiguration(page);
  const table = page.getByRole("table", {
    name: "Regras de classificação",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(
    data.categoryRules.length,
  );
  await filterCategory(page, "Alimentação");
  await expect(table.locator("tbody tr")).toHaveCount(
    data.categoryRules.filter((rule) => rule.category === "Alimentação").length,
  );
  await page
    .getByRole("button", { name: "Adicionar regra", exact: true })
    .click();
  const rule = page.getByRole("dialog", { name: "Nova regra", exact: true });
  await expect(
    rule.getByRole("combobox", { name: "Categoria", exact: true }),
  ).toContainText("Alimentação");
  await rule.getByLabel("Texto da descrição").fill("Estabelecimento de teste");
  await rule.getByRole("button", { name: "Salvar regra", exact: true }).click();
  await expect(rule).toHaveCount(0, { timeout: 15_000 });
  const row = table
    .getByRole("row")
    .filter({ hasText: "Estabelecimento de teste" });
  await expect(
    row.getByRole("cell", { name: "Alimentação", exact: true }),
  ).toBeVisible();
  await row
    .getByRole("button", {
      name: "Editar regra Estabelecimento de teste",
      exact: true,
    })
    .click();
  const edit = page.getByRole("dialog", { name: "Editar regra", exact: true });
  await edit.getByRole("combobox", { name: "Situação", exact: true }).click();
  await page.getByRole("option", { name: "Pausada", exact: true }).click();
  await edit.getByRole("button", { name: "Salvar regra", exact: true }).click();
  await expect(edit).toHaveCount(0, { timeout: 15_000 });
  await expect(
    row.getByRole("cell", { name: "Pausada", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await showConfiguration(page);
  await page
    .getByRole("textbox", { name: "Buscar regra", exact: true })
    .fill("ESTABELECIMENTO");
  await expect(table.locator("tbody tr")).toHaveCount(1, { timeout: 15_000 });
  await expect(
    row.getByRole("cell", { name: "Pausada", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await row
    .getByRole("button", {
      name: "Editar regra Estabelecimento de teste",
      exact: true,
    })
    .click();
  await edit
    .getByRole("button", { name: "Excluir regra", exact: true })
    .click();
  await expect(edit).toHaveCount(0, { timeout: 15_000 });
  await expect(
    page.getByRole("status").filter({ hasText: "Nenhuma regra encontrada." }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar regra", exact: true })
    .fill("");
  await expect(table).toBeVisible();
  await page.screenshot({ path: "work/category-configuration-desktop.png" });
});

test("atalho da categoria abre somente suas regras e permite voltar aos cartões", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/manage/categories?mode=personal", {
    data: { name: "Categoria do atalho", color: "#737373", imageSlug: null },
  });
  expect(created.status()).toBe(201);
  await page.goto("/");
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await page
    .getByRole("button", { name: "Editar Categoria do atalho", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Editar categoria",
    exact: true,
  });
  await expect(
    editor.getByRole("button", { name: "Adicionar regra" }),
  ).toHaveCount(0);
  await expect(editor.getByRole("table")).toHaveCount(0);
  await editor
    .getByRole("button", { name: "Ver configurações", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  const selector = page.getByRole("radiogroup", {
    name: "Visualização de categorias",
    exact: true,
  });
  await expect(
    selector.getByRole("radio", { name: "Configuração", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("combobox", {
      name: "Filtrar regras por categoria",
      exact: true,
    }),
  ).toContainText("Categoria do atalho");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Nenhuma regra para esta categoria." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Adicionar regra", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Nova regra", exact: true });
  await expect(
    dialog.getByRole("combobox", { name: "Categoria", exact: true }),
  ).toContainText("Categoria do atalho");
  await dialog.getByLabel("Texto da descrição").fill("Regra do atalho");
  await dialog
    .getByRole("button", { name: "Salvar regra", exact: true })
    .click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  const table = page.getByRole("table", {
    name: "Regras de classificação",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(
    table.getByRole("cell", { name: "Categoria do atalho", exact: true }),
  ).toBeVisible();
  await filterCategory(page, "Todas as categorias");
  await expect(
    table.locator("tbody tr").filter({ hasText: "Alimentação" }).first(),
  ).toBeVisible();
  await selector
    .getByRole("radio", { name: "Categorias", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Editar Categoria do atalho",
      exact: true,
    }),
  ).toBeVisible();
  await expect(table).toHaveCount(0);
});

test("tabela e edição de regras funcionam no celular sem alargar a página", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await showConfiguration(page);
  const table = page.getByRole("table", {
    name: "Regras de classificação",
    exact: true,
  });
  await expect(table).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  const scroll = page.locator(".category-rules-card .table-scroll");
  expect(
    await scroll.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "work/category-configuration-mobile.png" });
  await filterCategory(page, "Transporte");
  await page.getByRole("button", { name: "Adicionar regra" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova regra", exact: true });
  await expect(
    dialog.getByRole("combobox", { name: "Categoria", exact: true }),
  ).toContainText("Transporte");
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});
