import test from "node:test";
import assert from "node:assert/strict";
import { cardInvoiceAmount, spendingPace } from "../src/lib/analytics";
import type { FinanceData, Transaction } from "../src/lib/types";

const today = "2026-11-13";

function movement(overrides: Partial<Transaction>): Transaction {
  return {
    id: "purchase",
    description: "Compra no cartão",
    amount: 141979,
    kind: "expense",
    date: "2026-11-10",
    status: "pending",
    category: "Compras",
    accountId: "card",
    source: "pluggy",
    currency: "BRL",
    installmentNumber: null,
    installmentTotal: null,
    ...overrides,
  };
}

function sampleData(): FinanceData {
  return {
    mode: "personal",
    accounts: [
      {
        id: "card",
        name: "Cartão",
        institution: "Banco",
        type: "CREDIT",
        balance: 185472,
        availableCreditLimit: null,
        creditLimit: null,
        color: "#000000",
        currency: "BRL",
        itemId: "connection",
      },
    ],
    transactions: [
      movement({}),
      movement({ id: "fee", amount: 2570, category: "Taxas" }),
      movement({
        id: "refund",
        amount: 2570,
        kind: "income",
        category: "Taxas",
      }),
      movement({ id: "payment", amount: 642420, kind: "transfer" }),
      movement({ id: "closed", amount: 33333, status: "paid" }),
      movement({
        id: "installment-2",
        date: "2026-12-09",
        amount: 7026,
        installmentNumber: 2,
        installmentTotal: 3,
      }),
      movement({
        id: "installment-3",
        date: "2027-01-09",
        amount: 7026,
        installmentNumber: 3,
        installmentTotal: 3,
      }),
      movement({ id: "other-account", date: "2026-12-01", accountId: "other" }),
      movement({ id: "foreign", date: "2026-12-01", currency: "USD" }),
      movement({ id: "future-transfer", date: "2026-12-01", kind: "transfer" }),
    ],

    categories: [],
    categoryRules: [],
    investments: [],
    goals: [],
    connections: [],
    recurrings: [],
    plan: {
      monthlyLimit: 700000,
      fixedCost: 0,
      monthlySavings: 0,
      expectedSalary: 700000,
      expectedFreelance: 0,
    },
    plans: {},
    pluggyConfigured: true,
    updatedAt: today,
  };
}

test("fatura aberta retira parcelas futuras e mantém compras ainda ausentes da lista", () => {
  const data = sampleData();
  assert.equal(
    cardInvoiceAmount(data, "card", "2026-11", "all", today),
    171420,
  );
  assert.equal(cardInvoiceAmount(data, "card", "2026-12", "all", today), 7026);
  assert.equal(cardInvoiceAmount(data, "card", "2027-01", "all", today), 7026);
  const pace = spendingPace(data, "2026-11", "all", today);
  assert.equal(pace.openInvoices, 171420);
  assert.equal(pace.spentToDate, 171420);
  assert.equal(pace.remaining, 528580);
});

test("filtro de categoria abate estornos e exclui faturas já fechadas", () => {
  const data = sampleData();
  assert.equal(
    cardInvoiceAmount(data, "card", "2026-11", "Compras", today),
    141979,
  );
  assert.equal(cardInvoiceAmount(data, "card", "2026-11", "Taxas", today), 0);
  assert.equal(spendingPace(data, "2026-11", "Taxas", today).openInvoices, 0);
});

test("consulta de outro mês usa seus lançamentos sem reutilizar o saldo atual", () => {
  const data = sampleData();
  data.transactions.push(
    movement({
      id: "past-charge",
      date: "2026-10-05",
      amount: 10000,
      status: "paid",
    }),
    movement({
      id: "past-refund",
      date: "2026-10-06",
      amount: 250,
      kind: "income",
      status: "paid",
    }),
    movement({
      id: "future-refund",
      date: "2026-12-09",
      amount: 26,
      kind: "income",
    }),
  );
  assert.equal(cardInvoiceAmount(data, "card", "2026-10", "all", today), 9750);
  assert.equal(cardInvoiceAmount(data, "card", "2026-12", "all", today), 7000);
  assert.equal(spendingPace(data, "2026-12", "all", today).openInvoices, 7000);
});

test("lançamento manual futuro não é descontado do saldo da integração", () => {
  const data = sampleData();
  data.transactions.push(
    movement({
      id: "manual",
      date: "2026-12-15",
      amount: 1000,
      source: "manual",
    }),
  );
  assert.equal(
    cardInvoiceAmount(data, "card", "2026-11", "all", today),
    171420,
  );
  assert.equal(cardInvoiceAmount(data, "card", "2026-12", "all", today), 8026);
});

test("saldo zerado ou comprometido apenas com parcelas futuras não reabre cobranças", () => {
  const data = sampleData();
  data.accounts[0].balance = 14052;
  assert.equal(cardInvoiceAmount(data, "card", "2026-11", "all", today), 0);
  data.accounts[0].balance = 0;
  assert.equal(cardInvoiceAmount(data, "card", "2026-11", "all", today), 0);
});

test("cartão sem integração calcula pendências líquidas do mês", () => {
  const data = sampleData();
  data.accounts[0].itemId = null;
  assert.equal(
    cardInvoiceAmount(data, "card", "2026-11", "all", today),
    141979,
  );
  assert.equal(cardInvoiceAmount(data, "missing", "2026-11", "all", today), 0);
});
