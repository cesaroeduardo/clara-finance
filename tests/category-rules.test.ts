import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { db, getData } from "../src/lib/db";
import {
  categorizeTransaction,
  defaultCategorySeed,
} from "../src/lib/categorize";
import {
  categoryFallback,
  initializeCategoryRules,
  listCategoryRules,
} from "../src/lib/category-rules";
import { POST, PATCH, DELETE } from "../src/app/api/manage/[resource]/route";

fs.mkdirSync("work", { recursive: true });
const directory = fs.mkdtempSync(
  path.join(process.cwd(), "work", "category-rules-tests-"),
);
process.env.DATABASE_PATH = path.join(directory, "test.sqlite");
const database = db();
after(() => database.close());
function request(
  method: string,
  body: unknown,
  resource = "category-rules",
  mode = "personal",
) {
  return new NextRequest(
    `http://localhost:3013/api/manage/${resource}?mode=${mode}`,
    {
      method,
      headers: {
        host: "localhost:3013",
        origin: "http://localhost:3013",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}
const context = (resource = "category-rules") => ({
  params: Promise.resolve({ resource }),
});
const classify = (description: string) =>
  categorizeTransaction(
    { description },
    listCategoryRules(database, "personal"),
    categoryFallback(database, "personal"),
  );

test("regras persistem, respeitam prioridade, pausa, igualdade e isolamento", async () => {
  const category = getData("personal").categories.find(
    (row) => row.name === "Saúde",
  )!;
  const rule = {
    categoryId: category.id,
    match: "Mercado de teste",
    operator: "contains",
    priority: 0,
    active: true,
  };
  const created = await POST(request("POST", rule), context());
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.equal(
    classify("Pagamento efetuado|MERCADO DE TESTE FILIAL").category,
    "Saúde",
  );
  assert.equal(
    getData("personal").categoryRules.find((row) => row.id === id)?.match,
    rule.match,
  );
  assert.equal(
    (await PATCH(request("PATCH", { ...rule, id, active: false }), context()))
      .status,
    200,
  );
  assert.equal(classify("Mercado de teste filial").category, "Alimentação");
  assert.equal(
    (
      await PATCH(
        request("PATCH", { ...rule, id, operator: "equals" }),
        context(),
      )
    ).status,
    200,
  );
  assert.equal(classify("Mercado de teste filial").category, "Alimentação");
  assert.equal(
    classify("Pagamento efetuado|Mercádo de teste").category,
    "Saúde",
  );
  assert.equal(
    (
      await POST(
        request("POST", {
          ...rule,
          operator: "equals",
          match: "MERCÁDO DE TESTE",
        }),
        context(),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await PATCH(
        request("PATCH", { ...rule, id }, "category-rules", "demo"),
        context(),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await POST(
        request("POST", {
          ...rule,
          categoryId: "demo-cat-saude",
          match: "Outra condição",
        }),
        context(),
      )
    ).status,
    400,
  );
  assert.equal(
    (await DELETE(request("DELETE", { id }), context())).status,
    200,
  );
  assert.equal(
    listCategoryRules(database, "personal").some((row) => row.id === id),
    false,
  );
});

test("renomear categoria preserva regras por ID e excluir remove as regras associadas", async () => {
  const category = getData("personal").categories.find(
    (row) => row.name === "Saúde",
  )!;
  assert.equal(
    (
      await PATCH(
        request("PATCH", { ...category, name: "Cuidados" }, "categories"),
        context("categories"),
      )
    ).status,
    200,
  );
  assert.equal(classify("Farmácia central").category, "Cuidados");
  assert.equal(
    getData("personal").categories.find((row) => row.id === category.id)
      ?.taxonomyKey,
    "Saúde",
  );
  assert.equal(
    (
      await DELETE(
        request("DELETE", { id: category.id }, "categories"),
        context("categories"),
      )
    ).status,
    200,
  );
  assert.equal(
    getData("personal").categoryRules.some(
      (row) => row.categoryId === category.id,
    ),
    false,
  );
  assert.equal(classify("Farmácia central").category, "Sem categoria");
});

test("migração local preserva regras pessoais e não as copia para novas instalações", () => {
  const file = path.join(directory, "legacy.sqlite");
  fs.writeFileSync(
    `${file}.legacy-category-rules.json`,
    JSON.stringify([
      {
        match: "Fornecedor privado de teste",
        category: "Saúde",
      },
    ]),
  );
  const legacy = new Database(":memory:");
  legacy.pragma("foreign_keys = ON");
  legacy.exec(
    "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY); CREATE TABLE categories(id TEXT PRIMARY KEY, mode TEXT, name TEXT); CREATE TABLE groups(id TEXT PRIMARY KEY, mode TEXT);",
  );
  for (const mode of ["personal", "demo"]) {
    for (const key of ["home", "life", "other", "future", "work"])
      legacy
        .prepare("INSERT INTO groups VALUES(?,?)")
        .run(`${mode}-${key}`, mode);
    for (const category of defaultCategorySeed)
      legacy
        .prepare("INSERT INTO categories VALUES(?,?,?)")
        .run(`${mode}-${category.name}`, mode, category.name);
  }
  initializeCategoryRules(legacy, file);
  const rules = listCategoryRules(legacy, "personal");
  assert.equal(rules.length, 1);
  assert.equal(rules[0].match, "Fornecedor privado de teste");
  assert.ok(listCategoryRules(legacy, "demo").length > 1);
  assert.ok(
    listCategoryRules(database, "personal").every(
      (rule) => rule.match !== "Fornecedor privado de teste",
    ),
  );
  legacy.prepare("DELETE FROM category_rules WHERE mode='personal'").run();
  initializeCategoryRules(legacy, file);
  assert.equal(listCategoryRules(legacy, "personal").length, 0);
  legacy.close();
});
