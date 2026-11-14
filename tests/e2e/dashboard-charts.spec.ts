import { test, expect, type Page } from "@playwright/test";

async function dashboard(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Contas", exact: true }).click();
  await page.getByRole("switch", { name: "Dados fictícios" }).check();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(page.locator(".budget-gauge")).toBeVisible();
}

test("contas a pagar pertencem ao cartão do limite e abrem os lançamentos", async ({
  page,
}) => {
  await dashboard(page);
  const card = page.locator(".home-forecast");
  await expect(
    card.getByRole("button", { name: "Ver contas a pagar" }),
  ).toBeVisible();
  await expect(
    page.locator(".home-top-stack > .home-bills-summary"),
  ).toHaveCount(0);
  await card.getByRole("button", { name: "Ver contas a pagar" }).click();
  await expect(
    page.getByRole("combobox", { name: "Filtrar por tipo", exact: true }),
  ).toHaveText("Saídas");
});

test("curvas ao lado do resultado terminam nos totais confirmados e ocultam valores acessíveis", async ({
  page,
}) => {
  await dashboard(page);
  const result = page.locator(".home-result");
  const chart = result.locator('[data-slot="chart-card"]');
  const table = chart.getByRole("table", {
    name: "Entradas e saídas acumuladas",
  });
  const last = table.locator("tbody tr").last().locator("td");
  const totals = result.locator(".home-result-metrics > div > strong .sr-only");
  await expect(last.nth(0)).toHaveText(
    (await totals.nth(0).innerText()).trim(),
  );
  await expect(last.nth(1)).toHaveText(
    (await totals.nth(1).innerText()).trim(),
  );
  const graphBounds = await chart.boundingBox();
  const headlineBounds = await result
    .locator(".home-result-headline")
    .boundingBox();
  expect(graphBounds!.x).toBeGreaterThan(headlineBounds!.x);
  const control = chart.getByRole("group", { name: /Use as setas/ });
  await control.press("End");
  await expect(chart.getByRole("status")).toContainText("Entradas");
  await page.getByRole("button", { name: "Ocultar valores" }).click();
  await expect(last.nth(0)).toHaveText("oculto");
  await expect(last.nth(1)).toHaveText("oculto");
  await control.press("End");
  await expect(chart.getByRole("status")).not.toContainText("R$");
  await expect(chart.getByRole("status")).toContainText("oculto");
  await control.press("Escape");
  await expect(chart.getByRole("status")).toHaveText("");
});

test("gráficos TuffUI funcionam no celular, no tema escuro e nas recorrências", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await dashboard(page);
  await page.getByRole("button", { name: "Usar tema escuro" }).press("Enter");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator(".home-result [data-slot='chart-card']"),
  ).toBeAttached();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Recorrentes", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Projeção de recorrências por mês" }),
  ).toBeAttached();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await expect(page.locator(".recharts-wrapper")).toHaveCount(0);
  expect(errors).toEqual([]);
});
