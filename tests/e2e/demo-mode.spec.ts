import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("dados ficticios sao opcionais e controlados apenas em Contas", async ({
  page,
}) => {
  let syncRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/pluggy/sync")) syncRequests++;
  });
  const initial = page.waitForResponse(
    (response) =>
      response.url().includes("/api/data?mode=personal") && response.ok(),
  );
  await page.goto("/");
  expect((await (await initial).json()).mode).toBe("personal");
  await expect(
    page.getByRole("combobox", { name: "Dados exibidos" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("switch", { name: "Dados fictícios" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Contas", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "Dados fictícios" });
  await expect(toggle).not.toBeChecked();

  const demoResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/data?mode=demo") && response.ok(),
  );
  await toggle.click();
  const demo = await (await demoResponse).json();
  expect(demo.transactions.length).toBeGreaterThan(0);
  expect(demo.merchantAssets).toEqual([]);
  await expect(toggle).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Sincronizar conexões" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Contas", exact: true }).click();
  await expect(toggle).toBeChecked();
  await page.keyboard.press("Control+.");
  await expect(
    page.getByText("Use seus dados para sincronizar com a Pluggy."),
  ).toBeVisible();
  expect(syncRequests).toBe(0);

  const personalResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/data?mode=personal") && response.ok(),
  );
  await toggle.click();
  const personal = await (await personalResponse).json();
  expect(
    personal.accounts.every(
      (account: { id: string }) => !account.id.startsWith("demo-"),
    ),
  ).toBe(true);
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await page.getByRole("button", { name: "Contas", exact: true }).click();
  await expect(toggle).not.toBeChecked();
});
