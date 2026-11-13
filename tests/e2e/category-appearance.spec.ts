import { test, expect } from "@playwright/test";
import { localDate } from "../../src/lib/format";
import type { FinanceData } from "../../src/lib/types";

test.setTimeout(60_000);

test("categoria salva upload, clipboard e cor hexadecimal", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await page
    .getByRole("button", { name: "Nova categoria", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Imagem de teste");
  await page.getByRole("button", { name: "Abrir seletor de cor" }).click();
  const hex = page.getByRole("textbox", { name: "Cor hexadecimal" });
  await expect(hex).toHaveValue("#737373");
  await hex.fill("#FF0000");
  await page.getByRole("slider", { name: "Matiz", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(hex).toHaveValue("#FF0400");
  await hex.fill("#A12B3C");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Cor", { exact: true })).toHaveValue("#A12B3C");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#A12B3C";
    ctx.fillRect(0, 0, 500, 300);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const uploadArea = page.getByRole("group", { name: "Imagem da categoria" });
  const fileChooser = page.waitForEvent("filechooser");
  await uploadArea.getByRole("button", { name: "Enviar imagem" }).click();
  await (
    await fileChooser
  ).setFiles({
    name: "categoria.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  const preview = page.locator(".category-image-upload img");
  await expect(preview).toHaveAttribute("src", /^data:image\/webp;base64,/);
  const uploaded = await preview.getAttribute("src");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /^Categorias/ }).click();
  const card = page.getByRole("button", {
    name: "Editar Imagem de teste",
    exact: true,
  });
  await expect(card.locator("img")).toHaveAttribute("src", uploaded!, {
    timeout: 15_000,
  });
  await expect(card.locator("img")).toHaveJSProperty("naturalWidth", 256);
  await card.click();
  await expect(page.getByLabel("Cor", { exact: true })).toHaveValue("#A12B3C");

  // Exercise a real clipboard paste, including the browser's image decoding.
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#00FF00";
    ctx.fillRect(0, 0, 32, 32);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob!), "image/png"),
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });
  await uploadArea.click({ position: { x: 12, y: 12 } });
  await expect(uploadArea).toBeFocused();
  await page.keyboard.press("Control+V");
  await expect(preview).not.toHaveAttribute("src", uploaded!);
  await expect(preview).toHaveAttribute("src", /^data:image\/webp;base64,/);
  const pasted = await preview.getAttribute("src");
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "Colar imagem", exact: true }).click();
  await expect(preview).toHaveAttribute("src", pasted!);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await expect(card.locator("img")).toHaveAttribute("src", pasted!, {
    timeout: 15_000,
  });
  await card.click();
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(card.locator("img")).toHaveCount(0);
});

test("área recebe imagem arrastada e indica ilustrações do Thiings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await page
    .getByRole("button", { name: "Nova categoria", exact: true })
    .click();
  const uploadArea = page.getByRole("group", { name: "Imagem da categoria" });
  await expect(
    page.getByRole("link", { name: "Thiings", exact: true }),
  ).toHaveAttribute("href", "https://www.thiings.co/things");
  const transfer = await page.evaluateHandle(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#737373";
    ctx.fillRect(0, 0, 48, 48);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob!), "image/png"),
    );
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([blob], "arrastada.png", { type: "image/png" }),
    );
    return transfer;
  });
  await uploadArea.dispatchEvent("dragenter", { dataTransfer: transfer });
  await expect(uploadArea).toHaveAttribute("data-dragging", "true");
  await expect(uploadArea).toContainText("Solte a imagem aqui");
  await uploadArea.dispatchEvent("dragover", { dataTransfer: transfer });
  await uploadArea.dispatchEvent("drop", { dataTransfer: transfer });
  await expect(uploadArea.locator("img")).toHaveAttribute(
    "src",
    /^data:image\/webp;base64,/,
  );
  await expect(uploadArea).not.toHaveAttribute("data-dragging", "true");
  await page.screenshot({ path: "work/category-image-dropzone.png" });
  await transfer.dispose();
});

test("imagem inválida mantém a ilustração selecionada", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await page
    .getByRole("button", { name: "Editar Alimentação", exact: true })
    .click();
  const preview = page.locator(".category-image-upload img");
  const original = await preview.getAttribute("src");
  await page.getByLabel("Enviar ilustração da categoria").setInputFiles({
    name: "texto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("texto"),
  });
  await expect(page.getByRole("alert")).toContainText("Use uma imagem");
  await expect(preview).toHaveAttribute("src", original!);
  await page.getByLabel("Enviar ilustração da categoria").setInputFiles({
    name: "corrompida.png",
    mimeType: "image/png",
    buffer: Buffer.from("imagem inválida"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(preview).toHaveAttribute("src", original!);
});

test("seletor hexadecimal cabe na tela do celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await page
    .getByRole("button", { name: "Nova categoria", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir seletor de cor" }).click();
  await expect(
    page.getByRole("textbox", { name: "Cor hexadecimal" }),
  ).toBeVisible();
  const bounds = await page.locator(".color-picker-popup").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await page.screenshot({ path: "work/category-picker-mobile.png" });
});

test("imagem salva da categoria aparece nos lançamentos, filtros e resumos", async ({
  page,
  request,
}) => {
  const data = (await (
    await request.get("/api/data?mode=personal")
  ).json()) as FinanceData;

  const transaction = await request.post(
    "/api/manage/transactions?mode=personal",
    {
      data: {
        description: "Verificação da imagem de categoria",
        amount: 2500,
        kind: "expense",
        date: localDate(),
        status: "paid",

        category: "Alimentação",
        accountId: null,
      },
    },
  );
  expect(transaction.status()).toBe(201);
  const recurring = await request.post("/api/manage/recurrings?mode=personal", {
    data: {
      description: "Recorrência com imagem de categoria",
      amount: 2500,
      kind: "expense",
      type: "fixed",
      dayOfMonth: 15,

      category: "Alimentação",
      accountId: null,
    },
  });
  expect(recurring.status()).toBe(201);
  await page.goto("/");
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await page
    .getByRole("button", { name: "Editar Alimentação", exact: true })
    .click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#123456";
    ctx.fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Enviar ilustração da categoria").setInputFiles({
    name: "lancamento.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  const preview = page.locator(".category-image-upload img");
  await expect(preview).toHaveAttribute("src", /^data:image\/webp;base64,/);
  const uploaded = (await preview.getAttribute("src"))!;
  await page.getByLabel("Cor", { exact: true }).fill("#123456");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Verificação da imagem de categoria" });
  await expect(row.locator(".transaction-category-icon img")).toHaveAttribute(
    "src",
    uploaded,
    { timeout: 15_000 },
  );
  await expect(row.locator(".transaction-symbol img")).toHaveAttribute(
    "src",
    uploaded,
  );
  await expect(row.locator(".transaction-category-icon")).toHaveCSS(
    "color",
    "rgb(18, 52, 86)",
  );
  await page
    .locator(".table-filters")
    .getByRole("combobox", { name: "Filtrar por categoria", exact: true })
    .click();
  await expect(
    page
      .getByRole("option", { name: "Alimentação", exact: true })
      .locator("img"),
  ).toHaveAttribute("src", uploaded);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(
    page
      .locator(".home-spending-row")
      .filter({ hasText: "Alimentação" })
      .locator("img"),
  ).toHaveAttribute("src", uploaded);
  await page.getByRole("button", { name: "Recorrentes", exact: true }).click();
  await expect(
    page
      .locator(".recurring-row")
      .filter({ hasText: "Recorrência com imagem de categoria" })
      .locator("img"),
  ).toHaveAttribute("src", uploaded);
  await page.reload();
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await expect(row.locator(".transaction-category-icon img")).toHaveAttribute(
    "src",
    uploaded,
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: /^Categorias/ }).click();
  await page
    .getByRole("button", { name: "Editar Alimentação", exact: true })
    .click();
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await expect(row).toBeVisible();
  await expect(row.locator(".transaction-category-icon img")).toHaveCount(0);
  await expect(row.locator(".transaction-symbol img")).toHaveCount(0);
});
