import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { db, getData } from "../src/lib/db";
import { POST } from "../src/app/api/manage/[resource]/route";

fs.mkdirSync("work", { recursive: true });
process.env.DATABASE_PATH = path.join(
  fs.mkdtempSync(path.join(process.cwd(), "work", "no-groups-")),
  "test.sqlite",
);
let database = db();
after(() => database.close());

async function create(resource: string, body: Record<string, unknown>) {
  return POST(
    new NextRequest(
      `http://localhost:3013/api/manage/${resource}?mode=personal`,
      {
        method: "POST",
        headers: {
          host: "localhost:3013",
          origin: "http://localhost:3013",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ resource }) },
  );
}

test("lançamentos, investimentos, recorrências e regras funcionam sem grupo", async () => {
  assert.equal(
    (
      await create("transactions", {
        description: "Despesa sem grupo",
        amount: 12345,
        kind: "expense",
        date: "2030-01-15",
        status: "paid",
        category: "Alimentação",
        accountId: null,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await create("investments", {
        name: "Investimento sem grupo",
        institution: "Banco de teste",
        type: "FIXED_INCOME",
        balance: 50000,
        invested: 40000,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await create("recurrings", {
        description: "Recorrência sem grupo",
        amount: 2500,
        kind: "expense",
        type: "fixed",
        dayOfMonth: 15,
        category: "Alimentação",
        accountId: null,
      })
    ).status,
    201,
  );
  const data = getData("personal");
  assert.equal(
    (
      await create("category-rules", {
        categoryId: data.categories[0].id,
        match: "Regra sem grupo",
        operator: "contains",
        priority: 0,
        active: true,
      })
    ).status,
    201,
  );
  assert.equal(
    (await create("groups", { name: "Grupo removido" })).status,
    404,
  );
  assert.equal("groups" in data, false);
  for (const records of [
    data.transactions,
    data.investments,
    data.recurrings,
    data.categoryRules,
  ])
    for (const record of records) assert.equal("groupId" in record, false);
});

test("migração remove os vínculos antigos e preserva todos os demais campos", () => {
  const tables = [
    "transactions",
    "investments",
    "recurrings",
    "category_rules",
  ];
  const before = tables.map((table) =>
    database.prepare(`SELECT * FROM ${table} ORDER BY id`).all(),
  );
  // Reconstruct a legacy database, then exercise the normal startup migration.
  database.exec(
    "CREATE TABLE groups(id TEXT PRIMARY KEY); INSERT INTO groups VALUES('legacy'); DELETE FROM schema_migrations WHERE version=20",
  );
  for (const table of tables) {
    database.exec(
      `ALTER TABLE ${table} ADD COLUMN group_id TEXT REFERENCES groups(id); UPDATE ${table} SET group_id='legacy'`,
    );
  }
  database.exec(
    "CREATE INDEX category_rules_group ON category_rules(group_id)",
  );
  database.close();
  const state = globalThis as unknown as {
    financeDb?: unknown;
    financeDbSchemaVersion?: number;
  };
  state.financeDb = undefined;
  state.financeDbSchemaVersion = undefined;
  database = db();
  assert.deepEqual(
    tables.map((table) =>
      database.prepare(`SELECT * FROM ${table} ORDER BY id`).all(),
    ),
    before,
  );
  assert.equal(
    database.prepare("SELECT 1 FROM sqlite_master WHERE name='groups'").get(),
    undefined,
  );
  assert.deepEqual(database.pragma("foreign_key_check"), []);
  for (const table of tables)
    assert.equal(
      (database.pragma(`table_info(${table})`) as { name: string }[]).some(
        (column) => column.name === "group_id",
      ),
      false,
    );
  database.close();
  state.financeDb = undefined;
  database = db();
  assert.equal(
    database.prepare("SELECT 1 FROM sqlite_master WHERE name='groups'").get(),
    undefined,
  );
});
