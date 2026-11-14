import { test, expect, type Page } from "@playwright/test";

test.use({ hasTouch: true });

async function demoDashboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Contas", exact: true }).click();
  await page.getByRole("switch", { name: "Dados fictícios" }).check();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Você ainda pode gastar" }),
  ).toBeVisible();
}

test("primeiro cartão mantém título, ações e ritmo visível acima das contas", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await demoDashboard(page);
  const forecast = page.locator(".home-forecast");
  await expect(
    forecast.locator(':scope > [data-slot="surface-header"]'),
  ).toHaveCount(0);
  await expect(
    forecast
      .locator(".home-forecast-body")
      .getByRole("heading", { name: "Você ainda pode gastar" }),
  ).toBeVisible();
  await expect(forecast.locator("h2 svg")).toHaveCount(0);
  await expect(forecast.locator(".home-forecast-footer")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Insight anterior" }),
  ).toHaveCount(0);
  const info = forecast
    .locator(".home-forecast-body")
    .getByRole("button", { name: "Cálculo do quanto ainda pode gastar" });
  await info.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Limite do mês");
  await expect(tooltip).not.toContainText("Ritmo de gastos");
  await expect(forecast.locator(".budget-pace")).toContainText(
    "Ritmo de gastos",
  );
  await expect(forecast.locator(".budget-pace")).toContainText("por dia.");
  await expect(tooltip).not.toContainText("Renda e sobra");
  await page.keyboard.press("Escape");
  await forecast.getByRole("button", { name: "Editar planejamento" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("comparação de gastos fica no info da distribuição e respeita privacidade", async ({
  page,
}) => {
  await demoDashboard(page);
  await page.getByRole("button", { name: "Ocultar valores" }).click();
  const info = page
    .locator(".home-distribution")
    .getByRole("button", { name: "Mudança nos gastos" });
  await info.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Mudança nos gastos");
  await expect(tooltip).toContainText(/mesmo período|Sem variação relevante/);
  expect(
    (await tooltip.locator(".amount").allTextContents()).every(
      (value) => value === "••••••",
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(tooltip).not.toBeVisible();
  await page
    .getByRole("button", { name: "Período anterior", exact: true })
    .click();
  await page
    .locator(".home-forecast")
    .getByRole("button", { name: "Cálculo do resultado do mês" })
    .press("Enter");
  await expect(page.getByRole("tooltip")).toContainText(
    "Entradas menos saídas",
  );
});

test("info abre por toque e tooltip TuffUI cabe no celular", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await demoDashboard(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of [
    "Cálculo do quanto ainda pode gastar",
    "Mudança nos gastos",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).tap();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    const bounds = await tooltip.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await page.keyboard.press("Escape");
  }
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
});
