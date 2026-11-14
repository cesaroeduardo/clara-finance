import { test, expect } from "@playwright/test";
import type { FinanceData } from "../../src/lib/types";

test("TuffUI aparece nas superfícies, indicadores e campos", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const surface = page.locator(".home-distribution");
  await expect(
    surface.getByRole("heading", { name: "Distribuição dos gastos" }),
  ).toBeVisible();
  await expect(
    surface.locator(':scope > [data-slot="surface-header"]'),
  ).toBeVisible();
  const colors = await surface.evaluate((element) => {
    const panel = element.querySelector(":scope > .tuff-finance-body")!;
    return {
      shell: getComputedStyle(element).backgroundColor,
      panel: getComputedStyle(panel).backgroundColor,
      border: getComputedStyle(element).borderTopWidth,
    };
  });
  expect(colors.shell).not.toBe(colors.panel);
  expect(colors.border).toBe("0px");
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  const stat = page.locator(".tuff-stat").first();
  await expect(stat.locator(".tuff-stat-value")).toBeVisible();
  const frame = await stat.boundingBox();
  const panel = await stat.locator(":scope > .tuff-finance-body").boundingBox();
  expect(
    frame!.y + frame!.height - panel!.y - panel!.height,
  ).toBeLessThanOrEqual(7);
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Adicionar", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Nova saída", exact: true }).click();
  const field = page
    .getByRole("dialog")
    .getByLabel("Descrição", { exact: true });
  await expect(field).toBeVisible();
  const fill = await field.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(fill).not.toBe("rgba(0, 0, 0, 0)");
});

test("menu e seletor por teclado preservam formulário, foco e valor enviado", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const trigger = page
    .locator(".page-heading")
    .getByRole("button", { name: "Adicionar", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Nova saída", exact: true }).focus();
  await page.keyboard.press("Enter");
  const form = page.getByRole("dialog", {
    name: "Novo lançamento",
    exact: true,
  });
  await expect(form).toBeVisible();
  await form
    .getByLabel("Descrição", { exact: true })
    .fill("Controle SDK por teclado");
  await form.getByLabel("Valor (R$)", { exact: true }).fill("12,34");
  const category = form.getByRole("combobox", {
    name: "Categoria",
    exact: true,
  });
  await category.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(form).toBeVisible();
  await expect(category).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await form.evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(form).toHaveCount(0);
  const data = (await (
    await request.get("/api/data?mode=personal")
  ).json()) as FinanceData;
  const row = data.transactions.find(
    (row) => row.description === "Controle SDK por teclado",
  );
  expect(row?.amount).toBe(1234);
  expect(row?.accountId).toBeNull();
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  const transaction = page
    .getByRole("row")
    .filter({ hasText: "Controle SDK por teclado" });
  await transaction.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Descrição", { exact: true }),
  ).toHaveValue("Controle SDK por teclado");
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("paleta usa navegação do SDK e preserva a busca do Clara", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Abrir paleta de comandos", exact: true })
    .click();
  const palette = page.getByRole("dialog", { name: "Paleta de comandos" });
  const search = palette.getByRole("combobox");
  await search.fill("Investimentos");
  await expect(
    palette.getByRole("option", { name: "Investimentos", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Carteira", exact: true }),
  ).toBeVisible();
});

test("período mensal aceita intervalo e reinicia o rascunho ao fechar", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Escolher período" });
  await trigger.click();
  const months = page.getByRole("group", { name: "Meses", exact: true });
  await months.getByRole("button", { name: "jan", exact: true }).click();
  await months.getByRole("button", { name: "mar", exact: true }).click();
  await expect(trigger).toContainText(/jan.*mar/i);
  await trigger.click();
  await months.getByRole("button", { name: "fev", exact: true }).click();
  await page.keyboard.press("Escape");
  await trigger.click();
  await page
    .locator(".period-picker-actions")
    .getByRole("button", { name: "Este mês", exact: true })
    .click();
  await expect(trigger).not.toContainText(/jan.*mar/i);
});

test("aparência neutra, privacidade e calendário cabem no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Ocultar valores" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/values-hidden/);
  await expect
    .poll(async () =>
      page.locator(".amount").first().evaluate((el) => getComputedStyle(el).filter),
    )
    .toContain("blur");
  await page.getByRole("button", { name: "Usar tema escuro" }).click();
  await page.getByRole("button", { name: /^Metas/ }).click();
  await page.getByRole("button", { name: "Nova meta", exact: true }).click();
  await page.getByRole("button", { name: /^Escolher prazo:/ }).click();
  const calendar = page.locator(".goal-deadline-panel");
  await expect(calendar).toBeVisible();
  const bounds = await calendar.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.screenshot({ path: "work/ui-sdk-calendar-mobile-dark.png" });
});
