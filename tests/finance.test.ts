import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { db, getData } from "../src/lib/db";
import { POST, PATCH, DELETE } from "../src/app/api/manage/[resource]/route";
import { GET } from "../src/app/api/data/route";
import { netWorth, summarize } from "../src/lib/analytics";
import { localDate, parseMoney } from "../src/lib/format";
import { categorizeTransaction } from "../src/lib/categorize";
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
test("patrimônio soma contas e investimentos e reconstrói a variação do mês", () => {
  const today = localDate();
  const month = today.slice(0, 7);
  const previous = new Date(`${month}-15T12:00:00`);
  previous.setMonth(previous.getMonth() - 1);
  const prev = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
  const wealth = netWorth(
    {
      mode: "personal",
      accounts: [
        {
          id: "a1",
          name: "Conta",
          institution: "Banco",
          type: "BANK",
          balance: 100000,
          availableCreditLimit: null,
          creditLimit: null,
          color: "#000",
          currency: "BRL",
          itemId: null,
        },
        {
          id: "a2",
          name: "Cartão",
          institution: "Banco",
          type: "CREDIT",
          balance: -20000,
          availableCreditLimit: 80000,
          creditLimit: 100000,
          color: "#000",
          currency: "BRL",
          itemId: null,
        },
        {
          id: "usd",
          name: "Dólar",
          institution: "Banco",
          type: "BANK",
          balance: 99999,
          availableCreditLimit: null,
          creditLimit: null,
          color: "#000",
          currency: "USD",
          itemId: null,
        },
      ],
      investments: [
        {
          id: "i1",
          name: "CDB",
          institution: "Banco",
          type: "FIXED_INCOME",
          balance: 50000,
          invested: 45000,
          groupId: "personal-future",
          currency: "BRL",
          source: "manual",
        },
      ],
      transactions: [
        {
          id: "t1",
          description: "Salário",
          amount: 30000,
          kind: "income",
          date: `${month}-05`,
          status: "paid",
          groupId: "personal-work",
          category: "Salário",
          accountId: "a1",
          source: "manual",
          currency: "BRL",
        },
        {
          id: "t2",
          description: "Mercado",
          amount: 5000,
          kind: "expense",
          date: `${month}-08`,
          status: "paid",
          groupId: "personal-home",
          category: "Alimentação",
          accountId: "a1",
          source: "manual",
          currency: "BRL",
        },
        {
          id: "t3",
          description: "Aplicação",
          amount: 10000,
          kind: "transfer",
          date: `${month}-09`,
          status: "paid",
          groupId: "personal-future",
          category: "Investimento",
          accountId: "a1",
          source: "manual",
          currency: "BRL",
        },
        {
          id: "t4",
          description: "Renda antiga",
          amount: 8000,
          kind: "income",
          date: `${prev}-20`,
          status: "paid",
          groupId: "personal-work",
          category: "Salário",
          accountId: "a1",
          source: "manual",
          currency: "BRL",
        },
      ],
      groups: [],
      goals: [],
      connections: [],
      pluggyConfigured: false,
      updatedAt: today,
    },
    3,
  );
  assert.equal(wealth.current, 130000);
  assert.equal(wealth.change, 25000);
  assert.equal(wealth.series.length, 3);
  assert.equal(wealth.series.at(-1)?.value, 130000);
  assert.equal(wealth.series.at(-2)?.value, 105000);
  assert.equal(wealth.empty, false);
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
test("taxonomia local classifica descrição em categoria e grupo", () => {
  assert.deepEqual(categorizeTransaction({ description: "Uber* Trip" }), {
    category: "Transporte",
    groupId: "personal-life",
  });
  assert.deepEqual(categorizeTransaction({ description: "fornecedor local" }), {
    category: "Alimentação",
    groupId: "personal-home",
  });
  assert.deepEqual(
    categorizeTransaction({
      description: "Pagamento efetuado|UNIFIQUE TELECOMUNICACOES S A",
    }),
    { category: "Contas da casa", groupId: "personal-home" },
  );
  assert.deepEqual(
    categorizeTransaction({ description: "IOF de compra internacional" }),
    { category: "Taxas", groupId: "personal-other" },
  );
  assert.deepEqual(categorizeTransaction({ description: "Aplicação RDB" }), {
    category: "Investimentos",
    groupId: "personal-future",
  });
  assert.deepEqual(
    categorizeTransaction({
      description: "Pagamento de fatura",
      kind: "transfer",
    }),
    { category: "Transferências", groupId: "personal-other" },
  );
  assert.deepEqual(
    categorizeTransaction({ description: "Lançamento sem regra" }),
    { category: "Sem categoria", groupId: "personal-other" },
  );
});
test("fatura, aplicação e resgate usam tipo transferência", () => {
  assert.equal(
    transactionKind({
      type: "CREDIT",
      operationType: "PAGAMENTO_FATURA",
      description: "",
    }),
    "transfer",
  );
  assert.equal(
    transactionKind({
      type: "DEBIT",
      description: "Pagamento de fatura",
    }),
    "transfer",
  );
  assert.equal(
    transactionKind({
      type: "DEBIT",
      operationType: "APLICACAO_FINANCEIRA",
      description: "Aplicação Tesouro Selic",
    }),
    "transfer",
  );
  assert.equal(
    transactionKind({
      type: "CREDIT",
      operationType: "RESGATE_APLIC_FINANCEIRA",
      description: "",
    }),
    "transfer",
  );
  assert.equal(
    transactionKind({
      type: "DEBIT",
      operationType: "OUTROS",
      description: "Aplicação Nu Investimentos",
    }),
    "transfer",
  );
  assert.equal(
    transactionKind({ type: "DEBIT", description: "Aplicação RDB" }),
    "transfer",
  );
  assert.equal(
    transactionKind({ type: "CREDIT", description: "Resgate RDB" }),
    "transfer",
  );
  assert.equal(
    transactionKind({
      type: "DEBIT",
      description: "Compra de Renda Variável",
    }),
    "transfer",
  );
  assert.equal(
    transactionKind({ type: "DEBIT", description: "Compra de criptomoedas" }),
    "transfer",
  );
  assert.equal(
    transactionKind({ type: "CREDIT", description: "Resgate de Cashback" }),
    "income",
  );
  assert.equal(
    transactionKind({
      type: "DEBIT",
      operationType: "",
      description: "Mercado Extra",
    }),
    "expense",
  );
  assert.equal(
    transactionKind({
      type: "CREDIT",
      operationType: "ESTORNO",
      description: "",
    }),
    "income",
  );
  assert.equal(
    transactionKind({
      type: "CREDIT",
      operationType: "RENDIMENTO_APLIC_FINANCEIRA",
      description: "",
    }),
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
    if (url.pathname === "/v2/transactions") {
      const after = url.searchParams.get("after");
      if (failSecondPage && after)
        return Response.json({ error: "unavailable" }, { status: 500 });
      if (!after)
        return Response.json({
          next: `?accountId=${url.searchParams.get("accountId")}&after=page-2`,
          results: [
            {
              id: "remote-1",
              description: "Movimento 1",
              amount: 12.34,
              date: "2026-11-10T12:00:00Z",
              type: "CREDIT",
              status: "POSTED",
              currencyCode: "BRL",
            },
          ],
        });
      return Response.json({
        next: null,
        results: [
          {
            id: "remote-2",
            description: "Uber* Trip",
            amount: -22.56,
            date: "2026-11-10T12:00:00Z",
            type: "DEBIT",
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
    const uber = data.transactions.find((t) => t.id === "remote-2");
    assert.equal(uber?.amount, 2256);
    assert.equal(uber?.category, "Transporte");
    assert.equal(uber?.groupId, "personal-life");
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
    assert.ok(calls.some((c) => c.includes("/v2/transactions")));
    assert.ok(calls.some((c) => c.includes("after=page-2")));
  } finally {
    global.fetch = originalFetch;
    delete process.env.PLUGGY_CLIENT_ID;
    delete process.env.PLUGGY_CLIENT_SECRET;
  }
});
