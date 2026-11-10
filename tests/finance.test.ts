import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { db, getData } from "../src/lib/db";
import { POST, PATCH, DELETE } from "../src/app/api/manage/[resource]/route";
import { GET } from "../src/app/api/data/route";
import { summarize } from "../src/lib/analytics";
import { parseMoney } from "../src/lib/format";
import { syncAll, transactionKind } from "../src/lib/pluggy";

fs.mkdirSync("work", { recursive: true });
const directory = fs.mkdtempSync(
  path.join(process.cwd(), "work", "finance-tests-"),
);
process.env.DATABASE_PATH = path.join(directory, "test.sqlite");
const database = db();
after(() => {
  database.close();
});
function req(
  method: string,
  resource: string,
  body: unknown,
  mode = "personal",
  origin = "http://localhost:3013",
) {
  return new NextRequest(
    `http://localhost:3013/api/manage/${resource}?mode=${mode}`,
    {
      method,
      headers: {
        host: "localhost:3013",
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}
const ctx = (resource: string) => ({ params: Promise.resolve({ resource }) });
const transaction = {
  description: "Mercado teste",
  amount: 12345,
  kind: "expense",
  date: "2026-11-10",
  status: "paid",
  groupId: "personal-home",
  category: "Alimentação",
  accountId: null,
};

test("banco cria demonstração isolada dos dados pessoais", () => {
  assert.ok(getData("demo").transactions.length > 0);
  assert.equal(getData("personal").transactions.length, 0);
  assert.equal(getData("personal").groups.length, 5);
  assert.equal(database.pragma("journal_mode", { simple: true }), "wal");
});
test("valores brasileiros mantêm centavos e rejeitam formatos ambíguos", () => {
  assert.equal(parseMoney("1234,56"), 123456);
  assert.equal(parseMoney("0,01"), 1);
  assert.equal(parseMoney("0.29"), 29);
  assert.ok(Number.isNaN(parseMoney("1.234,56")));
  assert.ok(Number.isNaN(parseMoney("-20")));
});
test("lançamento é persistido, validado e isolado por modo", async () => {
  const result = await POST(
    req("POST", "transactions", transaction),
    ctx("transactions"),
  );
  assert.equal(result.status, 201);
  const { id } = await result.json();
  assert.equal(getData("personal").transactions[0].amount, 12345);
  assert.equal(
    (
      await PATCH(
        req("PATCH", "transactions", { ...transaction, id }, "demo"),
        ctx("transactions"),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await PATCH(
        req("PATCH", "transactions", { ...transaction, id, amount: -1 }),
        ctx("transactions"),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        req("POST", "transactions", { ...transaction, groupId: "demo-home" }),
        ctx("transactions"),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        req("POST", "transactions", { ...transaction, date: "2026-02-31" }),
        ctx("transactions"),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await PATCH(
        req("PATCH", "transactions", { ...transaction, id, status: "pending" }),
        ctx("transactions"),
      )
    ).status,
    200,
  );
  assert.equal(
    getData("personal").transactions.find((t) => t.id === id)?.status,
    "pending",
  );
  assert.equal(
    (await DELETE(req("DELETE", "transactions", { id }), ctx("transactions")))
      .status,
    200,
  );
  assert.equal(getData("personal").transactions.length, 0);
});
test("requisições de outro site e payloads inválidos são recusados", async () => {
  assert.equal(
    (
      await POST(
        req(
          "POST",
          "transactions",
          transaction,
          "personal",
          "https://example.com",
        ),
        ctx("transactions"),
      )
    ).status,
    403,
  );
  assert.equal(
    (await PATCH(req("PATCH", "transactions", {}), ctx("transactions"))).status,
    400,
  );
  assert.equal(
    (await POST(req("POST", "transactions", null), ctx("transactions"))).status,
    400,
  );
  const response = GET(new NextRequest("http://localhost/api/data?mode=other"));
  assert.equal(response.status, 400);
  assert.equal(GET(new NextRequest("http://example.com/api/data")).status, 403);
});
test("resumo separa transferências, moedas e grupos", () => {
  const data = getData("personal");
  data.transactions = [
    {
      ...transaction,
      id: "1",
      amount: 100000,
      kind: "income",
      currency: "BRL",
      source: "manual",
    },
    {
      ...transaction,
      id: "2",
      amount: 9900,
      kind: "expense",
      currency: "BRL",
      source: "manual",
    },
    {
      ...transaction,
      id: "3",
      amount: 20000,
      kind: "transfer",
      currency: "BRL",
      source: "manual",
    },
    {
      ...transaction,
      id: "4",
      amount: 999999,
      kind: "expense",
      currency: "USD",
      source: "manual",
    },
  ] as typeof data.transactions;
  assert.equal(summarize(data, "2026-11").balance, 90100);
  assert.equal(summarize(data, "2026-11").expenses, 9900);
  assert.equal(summarize(data, "2026-11", "personal-life").expenses, 0);
});
test("progresso de metas é acumulado sem criar movimento bancário", async () => {
  const result = await POST(
    req("POST", "goals", {
      name: "Reserva teste",
      target: 500000,
      current: 10000,
      deadline: "2027-01-01",
      groupId: "personal-future",
      icon: "shield",
      color: "#2563eb",
    }),
    ctx("goals"),
  );
  assert.equal(result.status, 201);
  const { id } = await result.json();
  assert.equal(
    (
      await PATCH(
        req("PATCH", "goals", { id, contribution: 10001 }),
        ctx("goals"),
      )
    ).status,
    200,
  );
  assert.equal(
    getData("personal").goals.find((g) => g.id === id)?.current,
    20001,
  );
  assert.equal(getData("personal").transactions.length, 0);
  assert.equal(
    (
      await DELETE(
        req("DELETE", "groups", { id: "personal-future" }),
        ctx("groups"),
      )
    ).status,
    400,
  );
});
test("pagamentos de fatura usam tipo transferência", () => {
  assert.equal(
    transactionKind({ type: "CREDIT", operationType: "PAGAMENTO_FATURA" }),
    "transfer",
  );
  assert.equal(transactionKind({ type: "DEBIT" }), "expense");
  assert.equal(
    transactionKind({ type: "CREDIT", operationType: "ESTORNO" }),
    "income",
  );
});
test("sincronização paginada é idempotente, preserva classificação e mantém dados em falhas", async () => {
  const originalFetch = global.fetch;
  process.env.PLUGGY_CLIENT_ID = "test-client";
  process.env.PLUGGY_CLIENT_SECRET = "test-secret";
  const itemId = "10000000-0000-4000-8000-000000000001";
  database
    .prepare(
      "INSERT INTO connections(id,mode,name) VALUES(?,'personal','Banco teste')",
    )
    .run(itemId);
  let failSecondPage = false,
    denyInvestments = false,
    expired = false,
    authCalls = 0;
  const calls: string[] = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    if (url.pathname === "/auth") {
      authCalls++;
      assert.ok(String(init?.body).includes("test-client"));
      return Response.json({ apiKey: "test-api-key" });
    }
    assert.equal(
      (init?.headers as Record<string, string>)["X-API-KEY"],
      "test-api-key",
    );
    if (url.pathname.startsWith("/items/"))
      return Response.json({
        id: itemId,
        status: "UPDATED",
        connector: { name: "MeuPluggy" },
        consentExpiresAt: expired
          ? "2020-01-01T00:00:00Z"
          : "2099-01-01T00:00:00Z",
      });
    if (url.pathname === "/accounts")
      return Response.json({
        page: 1,
        totalPages: 1,
        results: [
          {
            id: "account-test",
            name: "Conta",
            type: "BANK",
            balance: 1234.56,
            currencyCode: "BRL",
          },
        ],
      });
    if (url.pathname === "/transactions") {
      const page = Number(url.searchParams.get("page"));
      if (failSecondPage && page === 2)
        return Response.json({ error: "unavailable" }, { status: 500 });
      return Response.json({
        page,
        totalPages: 2,
        results: [
          {
            id: `remote-${page}`,
            description: `Movimento ${page}`,
            amount: page === 1 ? 12.34 : -22.56,
            date: "2026-11-10T12:00:00Z",
            type: page === 1 ? "CREDIT" : "DEBIT",
            status: "POSTED",
            currencyCode: "BRL",
          },
        ],
      });
    }
    if (url.pathname === "/investments")
      return denyInvestments
        ? Response.json({}, { status: 403 })
        : Response.json({
            page: 1,
            totalPages: 1,
            results: [
              {
                id: "investment-test",
                name: "CDB teste",
                type: "FIXED_INCOME",
                balance: 1200.25,
                amount: 1300,
                currencyCode: "BRL",
              },
            ],
          });
    throw new Error(`Unexpected endpoint ${url.pathname}`);
  }) as typeof fetch;
  try {
    assert.equal((await syncAll())[0].ok, true);
    let data = getData("personal");
    assert.equal(data.transactions.length, 2);
    assert.equal(data.accounts[0].balance, 123456);
    assert.equal(
      data.transactions.find((t) => t.id === "remote-2")?.amount,
      2256,
    );
    assert.equal(data.investments[0].balance, 120025);
    assert.equal(data.investments[0].invested, null);
    database
      .prepare(
        "UPDATE transactions SET group_id='personal-life',category='Minha categoria',kind='transfer',user_categorized=1 WHERE id='remote-2'",
      )
      .run();
    assert.equal((await syncAll())[0].ok, true);
    data = getData("personal");
    assert.equal(data.transactions.length, 2);
    assert.equal(
      data.transactions.find((t) => t.id === "remote-2")?.category,
      "Minha categoria",
    );
    assert.equal(
      data.transactions.find((t) => t.id === "remote-2")?.kind,
      "transfer",
    );
    failSecondPage = true;
    assert.equal((await syncAll())[0].ok, false);
    assert.equal(getData("personal").transactions.length, 2);
    failSecondPage = false;
    denyInvestments = true;
    const partial = (await syncAll())[0];
    assert.equal(partial.ok, true);
    assert.ok(partial.warning);
    assert.equal(getData("personal").investments.length, 1);
    expired = true;
    assert.equal((await syncAll())[0].ok, false);
    assert.equal(getData("personal").accounts.length, 1);
    assert.equal(authCalls, 1);
    assert.ok(calls.some((c) => c.includes("page=2")));
  } finally {
    global.fetch = originalFetch;
    delete process.env.PLUGGY_CLIENT_ID;
    delete process.env.PLUGGY_CLIENT_SECRET;
  }
});
