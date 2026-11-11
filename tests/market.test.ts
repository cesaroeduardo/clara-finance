import test from "node:test";
import assert from "node:assert/strict";
import {
  extractEquityTickers,
  periodStats,
  positionCentsForTicker,
  positionCostForTicker,
  positionReturnPct,
} from "../src/lib/market";
import {
  investmentBucket,
  investmentsOverview,
} from "../src/lib/analytics";

test("extractEquityTickers acha tickers B3 na carteira", () => {
  const tickers = extractEquityTickers([
    {
      name: "CPFE3",
      type: "EQUITY",
      balance: 49170,
      currency: "BRL",
    },
    {
      name: "BBAS3",
      type: "EQUITY",
      balance: 47656,
      currency: "BRL",
    },
    {
      name: "CDB Nubank",
      type: "FIXED_INCOME",
      balance: 100000,
      currency: "BRL",
    },
    {
      name: "VALE3",
      type: "EQUITY",
      balance: 0,
      currency: "BRL",
    },
  ]);
  assert.deepEqual(tickers, ["BBAS3", "CPFE3"]);
});

test("positionCentsForTicker soma a posição do ticker", () => {
  assert.equal(
    positionCentsForTicker(
      [
        { name: "CPFE3", balance: 1000, invested: 800, currency: "BRL" },
        { name: "BBAS3", balance: 500, invested: null, currency: "BRL" },
      ],
      "CPFE3",
    ),
    1000,
  );
});

test("positionCostForTicker e retorno vs custo", () => {
  const rows = [
    { name: "CPFE3", balance: 1200, invested: 1000, currency: "BRL" },
    { name: "BBAS3", balance: 500, invested: null, currency: "BRL" },
  ];
  assert.equal(positionCostForTicker(rows, "CPFE3"), 1000);
  assert.equal(positionCostForTicker(rows, "BBAS3"), null);
  assert.equal(positionReturnPct(1200, 1000), 20);
});

test("periodStats resume altas e baixas", () => {
  const stats = periodStats([
    { date: "2026-11-01", price: 100, changePct: 0, high: 101, low: 99 },
    { date: "2026-11-02", price: 110, changePct: 10, high: 111, low: 100 },
    { date: "2026-11-03", price: 105, changePct: -4.5, high: 110, low: 104 },
  ]);
  assert.equal(stats.high, 110);
  assert.equal(stats.low, 100);
  assert.equal(stats.upDays, 1);
  assert.equal(stats.downDays, 1);
  assert.ok(Math.abs(stats.changePct - 5) < 0.0001);
});

test("investmentBucket e overview por categoria", () => {
  assert.equal(
    investmentBucket({
      id: "1",
      name: "CDB Nu",
      institution: "Nubank",
      type: "FIXED_INCOME",
      balance: 100,
      invested: 90,
      groupId: "g",
      currency: "BRL",
      source: "manual",
    }),
    "caixinhas",
  );
  assert.equal(
    investmentBucket({
      id: "2",
      name: "Tesouro Selic 2031",
      institution: "Nu",
      type: "FIXED_INCOME",
      balance: 100,
      invested: null,
      groupId: "g",
      currency: "BRL",
      source: "pluggy",
    }),
    "tesouro",
  );
  const overview = investmentsOverview([
    {
      id: "a",
      name: "CDB",
      institution: "Nu",
      type: "FIXED_INCOME",
      balance: 80000,
      invested: 70000,
      groupId: "g",
      currency: "BRL",
      source: "manual",
    },
    {
      id: "b",
      name: "Bitcoin",
      institution: "Nu",
      type: "OTHER",
      balance: 20000,
      invested: 18000,
      groupId: "g",
      currency: "BRL",
      source: "manual",
    },
    {
      id: "c",
      name: "CPFE3",
      institution: "Nu",
      type: "EQUITY",
      balance: 10000,
      invested: 9000,
      groupId: "g",
      currency: "BRL",
      source: "pluggy",
    },
  ]);
  assert.equal(overview.total, 110000);
  assert.equal(overview.categories[0].id, "caixinhas");
  assert.equal(overview.gain, 13000);
});
