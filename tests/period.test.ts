import test from "node:test";
import assert from "node:assert/strict";
import {
  periodAnchor,
  periodDateBounds,
  periodLabel,
  periodMonthBounds,
  shiftAppPeriod,
  summarizePeriod,
  type AppPeriod,
} from "../src/lib/analytics";
import type { FinanceData } from "../src/lib/types";

const emptyPlan = {
  monthlyLimit: 0,
  fixedCost: 0,
  monthlySavings: 0,
  expectedSalary: 0,
  expectedFreelance: 0,
};

function sampleData(): FinanceData {
  return {
    mode: "personal",

    categories: [],
    categoryRules: [],
    accounts: [],
    investments: [],
    goals: [],
    connections: [],
    recurrings: [],
    plan: emptyPlan,
    plans: {},
    pluggyConfigured: false,
    updatedAt: "2026-11-11",
    transactions: [
      {
        id: "a",
        description: "Outubro",
        amount: 10000,
        currency: "BRL",
        kind: "expense",
        date: "2026-10-05",
        status: "paid",
        category: "Compras",
        accountId: null,
        source: "manual",
        installmentNumber: null,
        installmentTotal: null,
      },
      {
        id: "b",
        description: "Novembro",
        amount: 20000,
        currency: "BRL",
        kind: "expense",
        date: "2026-11-05",
        status: "paid",
        category: "Compras",
        accountId: null,
        source: "manual",
        installmentNumber: null,
        installmentTotal: null,
      },
      {
        id: "c",
        description: "Dezembro",
        amount: 40000,
        currency: "BRL",
        kind: "expense",
        date: "2026-12-05",
        status: "paid",
        category: "Compras",
        accountId: null,
        source: "manual",
        installmentNumber: null,
        installmentTotal: null,
      },
    ],
  };
}

test("periodMonthBounds cobre mês, last3, ano e range", () => {
  assert.deepEqual(periodMonthBounds({ mode: "month", month: "2026-11" }), {
    fromMonth: "2026-11",
    toMonth: "2026-11",
  });
  assert.deepEqual(periodMonthBounds({ mode: "last3", end: "2026-11" }), {
    fromMonth: "2026-09",
    toMonth: "2026-11",
  });
  assert.deepEqual(periodMonthBounds({ mode: "year", year: 2026 }), {
    fromMonth: "2026-01",
    toMonth: "2026-12",
  });
  assert.deepEqual(
    periodMonthBounds({ mode: "range", from: "2026-12", to: "2026-10" }),
    { fromMonth: "2026-10", toMonth: "2026-12" },
  );
});

test("periodAnchor usa mês atual quando está no intervalo", () => {
  const period: AppPeriod = {
    mode: "range",
    from: "2026-09",
    to: "2026-12",
  };
  assert.equal(periodAnchor(period, "2026-11-11"), "2026-11");
  assert.equal(periodAnchor(period, "2027-01-01"), "2026-12");
});

test("periodDateBounds e periodLabel", () => {
  assert.deepEqual(
    periodDateBounds({ mode: "month", month: "2026-10" }, "2026-11-11"),
    { from: "2026-10-01", to: "2026-10-31" },
  );
  assert.equal(
    periodLabel({ mode: "last3", end: "2026-11" }),
    "Últimos 3 meses",
  );
  assert.equal(periodLabel({ mode: "year", year: 2026 }), "2026");
  assert.match(
    periodLabel({ mode: "range", from: "2026-09", to: "2026-11" }),
    /2026/,
  );
});

test("shiftAppPeriod desloca cada modo", () => {
  assert.deepEqual(shiftAppPeriod({ mode: "month", month: "2026-11" }, -1), {
    mode: "month",
    month: "2026-10",
  });
  assert.deepEqual(shiftAppPeriod({ mode: "year", year: 2026 }, 1), {
    mode: "year",
    year: 2027,
  });
  assert.deepEqual(
    shiftAppPeriod({ mode: "range", from: "2026-09", to: "2026-11" }, 1),
    { mode: "range", from: "2026-10", to: "2026-12" },
  );
  assert.deepEqual(shiftAppPeriod({ mode: "last3", end: "2026-11" }, -1), {
    mode: "last3",
    end: "2026-10",
  });
});

test("summarizePeriod agrega range de meses e ancora o flow", () => {
  const data = sampleData();
  const summary = summarizePeriod(
    data,
    { mode: "range", from: "2026-10", to: "2026-11" },
    "all",
    "2026-11-11",
  );
  assert.equal(summary.expenses, 30000);
  assert.equal(summary.anchor, "2026-11");
  assert.equal(summary.records.length, 2);
  assert.ok(summary.flow.length >= 28);
});

test("todo o período inclui todos os lançamentos e mantém âncora no mês atual", () => {
  const period: AppPeriod = { mode: "all" };
  assert.equal(periodDateBounds(period, "2026-11-11"), null);
  assert.equal(periodLabel(period), "Todo o período");
  assert.equal(periodAnchor(period, "2026-11-11"), "2026-11");
  assert.deepEqual(shiftAppPeriod(period, 1), period);
  const summary = summarizePeriod(sampleData(), period, "all", "2026-11-11");
  assert.equal(summary.records.length, 3);
  assert.equal(summary.expenses, 70000);
});
