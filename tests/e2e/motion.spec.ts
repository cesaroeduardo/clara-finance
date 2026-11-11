import { test, expect } from "@playwright/test";

test("marca textual, menu com transição e fechamento animado do formulário", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".brand")).toHaveText("clara.");
  await expect(page.locator(".brand-icon, .brand small")).toHaveCount(0);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const menu = page.locator('[data-slot="dropdown-menu-content"]');
  await expect(menu).toBeVisible();
  expect(
    await menu.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toContain("0.25s");
  await page.getByRole("menuitem", { name: "Nova saída" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("clara-modal-enter");
  await page.getByLabel("Descrição", { exact: true }).fill("Texto preservado");
  const oldPosition = await dialog.locator(".segment-indicator").boundingBox();
  await page.getByRole("button", { name: "Entrada", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Entrada", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveValue(
    "Texto preservado",
  );
  await expect
    .poll(async () => {
      const box = await dialog.locator(".segment-indicator").boundingBox();
      return box!.x > oldPosition!.x + 30;
    })
    .toBe(true);
  const ending = await page.evaluate(() => {
    const popup = document.querySelector('[data-slot="dialog-content"]')!;
    const cancel = [...popup.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Cancelar",
    )!;
    cancel.click();
    return !!document.querySelector('[data-slot="dialog-content"]');
  });
  expect(ending).toBe(true);
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveAttribute(
    "data-ending-style",
    "",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("ocultação de valores é imediata e movimento reduzido é respeitado", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByText("Saldo previsto")).toBeVisible();
  const forecast = page.locator(".home-forecast-amount .amount");
  await expect(forecast).toBeVisible();
  await expect(forecast).not.toHaveText("");
  await expect(page.locator(".page-enter")).toHaveClass(/is-shown/);
  await page.getByRole("button", { name: "Ocultar valores" }).click();
  expect(
    (await page.locator(".amount").allTextContents()).every(
      (value) => value === "••••••",
    ),
  ).toBe(true);
  const icon = page.locator('[aria-label="Mostrar valores"] .t-icon').first();
  expect(
    await icon.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const menu = page.locator('[data-slot="dropdown-menu-content"]');
  expect(
    await menu.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.getByRole("menuitem", { name: "Nova saída" }).click();
  const modal = page.locator('[data-slot="dialog-content"]');
  expect(
    await modal.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("entrada de página monta reel no saldo e troca de view sem erro", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("Saldo previsto")).toBeVisible();
  const reel = page.locator(".home-forecast-amount .t-reel");
  await expect(reel).toBeVisible();
  await expect(reel).toHaveAttribute("aria-label", /R\$/);
  await expect(page.locator(".page-enter.is-shown")).toHaveCount(1);
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await expect(page.getByText("Entradas no mês")).toBeVisible();
  await expect(page.locator(".summary-grid .t-reel").first()).toBeVisible();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(page.getByText("Saldo previsto")).toBeVisible();
  expect(errors).toEqual([]);
});
