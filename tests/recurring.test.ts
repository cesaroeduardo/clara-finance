import test from "node:test";
import assert from "node:assert/strict";
import {
  detectRecurrings,
  normalizeMatchKey,
  parseInstallment,
  recurringCycle,
} from "../src/lib/recurring";
import type { FinanceData, Transaction } from "../src/lib/types";

function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, "id" | "description" | "amount" | "kind" | "date">,
): Transaction {
  return {
    status: "paid",
    category: "Moradia",
    accountId: "demo-nubank",
    source: "manual",
    currency: "BRL",
    installmentNumber: null,
    installmentTotal: null,
    ...partial,
  };
}

test("normaliza chave de recorrência removendo parcela e ruído", () => {
  assert.equal(normalizeMatchKey("iPhone 14 11/12"), "iphone 14");
  assert.equal(normalizeMatchKey("PARC 03/10 TokStok Sofá"), "tokstok sofa");
  assert.equal(normalizeMatchKey("Netflix"), "netflix");
});

test("parseia parcela por descrição e por metadata", () => {
  assert.deepEqual(parseInstallment("Compra 11/12"), {
    current: 11,
    total: 12,
  });
  assert.deepEqual(parseInstallment("Sem parcela", 2, 6), {
    current: 2,
    total: 6,
  });
  assert.equal(parseInstallment("Avulso"), null);
  assert.equal(parseInstallment("Compra 13/12"), null);
});

test("detecta contas fixas e parcelas a partir dos lançamentos", () => {
  const rows = [
    tx({
      id: "1",
      description: "Aluguel",
      amount: 180000,
      kind: "expense",
      date: "2026-10-02",
    }),
    tx({
      id: "2",
      description: "Aluguel",
      amount: 180000,
      kind: "expense",
      date: "2026-11-02",
    }),
    tx({
      id: "3",
      description: "iPhone 14 10/12",
      amount: 40000,
      kind: "expense",
      date: "2026-10-06",
      category: "Compras",
      installmentNumber: 10,
      installmentTotal: 12,
    }),
    tx({
      id: "4",
      description: "iPhone 14 11/12",
      amount: 40000,
      kind: "expense",
      date: "2026-11-06",
      category: "Compras",
      installmentNumber: 11,
      installmentTotal: 12,
    }),
    tx({
      id: "5",
      description: "Café avulso",
      amount: 1500,
      kind: "expense",
      date: "2026-11-08",
      category: "Restaurantes",
    }),
  ];
  const detected = detectRecurrings(rows);
  const fixed = detected.find(
    (row) => row.type === "fixed" && row.matchKey === "aluguel",
  );
  const installment = detected.find(
    (row) => row.type === "installment" && row.matchKey === "iphone 14",
  );
  assert.ok(fixed);
  assert.equal(fixed?.amount, 180000);
  assert.equal(fixed?.dayOfMonth, 2);
  assert.ok(installment);
  assert.equal(installment?.installmentCurrent, 11);
  assert.equal(installment?.installmentTotal, 12);
  assert.equal(
    detected.some((row) => row.matchKey.includes("cafe")),
    false,
  );
});

test("ignora assinaturas antigas, anuais e estornos", () => {
  const rows = [
    tx({
      id: "n1",
      description: "Netflix.Com",
      amount: 5990,
      kind: "expense",
      date: "2026-01-30",
      category: "Assinaturas",
    }),
    tx({
      id: "n2",
      description: "Netflix.Com",
      amount: 5990,
      kind: "expense",
      date: "2026-02-28",
      category: "Assinaturas",
    }),
    tx({
      id: "s1",
      description: "Dm*Spotify",
      amount: 3190,
      kind: "expense",
      date: "2026-04-03",
      category: "Assinaturas",
    }),
    tx({
      id: "s2",
      description: "Dm*Spotify",
      amount: 3190,
      kind: "expense",
      date: "2026-05-03",
      category: "Assinaturas",
    }),
    tx({
      id: "s3",
      description: "EBW*Spotify Pre",
      amount: 23900,
      kind: "expense",
      date: "2026-08-19",
      category: "Assinaturas",
    }),
    tx({
      id: "a1",
      description: "Spotify Anual",
      amount: 23900,
      kind: "expense",
      date: "2025-08-19",
      category: "Assinaturas",
    }),
    tx({
      id: "a2",
      description: "Spotify Anual",
      amount: 23900,
      kind: "expense",
      date: "2026-08-19",
      category: "Assinaturas",
    }),
    tx({
      id: "iof1",
      description: "IOF de volta de Ultramock",
      amount: 120,
      kind: "income",
      date: "2026-10-15",
      category: "Outros",
    }),
    tx({
      id: "iof2",
      description: "IOF de volta de Ultramock",
      amount: 120,
      kind: "income",
      date: "2026-11-15",
      category: "Outros",
    }),
  ];
  const detected = detectRecurrings(rows);
  assert.equal(
    detected.some((row) => row.matchKey.includes("netflix")),
    false,
  );
  assert.equal(
    detected.some((row) => row.matchKey === "dm spotify"),
    false,
  );
  assert.equal(
    detected.some((row) => row.matchKey.includes("spotify anual")),
    false,
  );
  assert.equal(
    detected.some((row) => row.matchKey.includes("iof")),
    false,
  );
});

test("resume o ciclo com totais, pendências e projeção de 6 meses", () => {
  const data: FinanceData = {
    mode: "demo",
    categories: [],
    categoryRules: [],
    accounts: [
      {
        id: "demo-nubank",
        name: "Conta principal",
        institution: "Nubank",
        type: "BANK",
        balance: 100000,
        availableCreditLimit: null,
        creditLimit: null,
        color: "#820ad1",
        currency: "BRL",
        itemId: null,
      },
    ],
    transactions: [
      tx({
        id: "rent-paid",
        description: "Aluguel",
        amount: 180000,
        kind: "expense",
        date: "2026-11-02",
        status: "paid",
      }),
      tx({
        id: "net-pending",
        description: "Internet fibra",
        amount: 12990,
        kind: "expense",
        date: "2026-11-15",
        status: "pending",
        category: "Contas da casa",
      }),
      tx({
        id: "salary",
        description: "Salário",
        amount: 500000,
        kind: "income",
        date: "2026-11-05",
        category: "Salário",
        status: "paid",
      }),
    ],
    investments: [],
    goals: [],
    connections: [],
    recurrings: [
      {
        id: "r-rent",
        kind: "expense",
        type: "fixed",
        description: "Aluguel",
        amount: 180000,
        dayOfMonth: 2,
        frequency: "monthly",
        category: "Moradia",
        accountId: "demo-nubank",
        installmentCurrent: null,
        installmentTotal: null,
        startDate: "2026-01-02",
        endDate: null,
        source: "detected",
        matchKey: "aluguel",
        ignored: false,
        active: true,
        userEdited: false,
        currency: "BRL",
      },
      {
        id: "r-net",
        kind: "expense",
        type: "fixed",
        description: "Internet fibra",
        amount: 12990,
        dayOfMonth: 15,
        frequency: "monthly",
        category: "Contas da casa",
        accountId: "demo-nubank",
        installmentCurrent: null,
        installmentTotal: null,
        startDate: "2026-01-15",
        endDate: null,
        source: "detected",
        matchKey: "internet fibra",
        ignored: false,
        active: true,
        userEdited: false,
        currency: "BRL",
      },
      {
        id: "r-phone",
        kind: "expense",
        type: "installment",
        description: "iPhone 14",
        amount: 40000,
        dayOfMonth: 6,
        frequency: "monthly",
        category: "Compras",
        accountId: "demo-nubank",
        installmentCurrent: 11,
        installmentTotal: 12,
        startDate: "2026-01-06",
        endDate: "2026-12-06",
        source: "detected",
        matchKey: "iphone 14",
        ignored: false,
        active: true,
        userEdited: false,
        currency: "BRL",
      },
      {
        id: "r-salary",
        kind: "income",
        type: "fixed",
        description: "Salário",
        amount: 500000,
        dayOfMonth: 5,
        frequency: "monthly",
        category: "Salário",
        accountId: "demo-nubank",
        installmentCurrent: null,
        installmentTotal: null,
        startDate: "2026-01-05",
        endDate: null,
        source: "detected",
        matchKey: "salario",
        ignored: false,
        active: true,
        userEdited: false,
        currency: "BRL",
      },
    ],
    plan: {
      monthlyLimit: 0,
      fixedCost: 0,
      monthlySavings: 0,
      expectedSalary: 0,
      expectedFreelance: 0,
    },
    plans: {},
    pluggyConfigured: false,
    updatedAt: new Date().toISOString(),
  };

  const summary = recurringCycle(data, "2026-11", "expense");
  assert.equal(summary.fixedTotal, 192990);
  assert.equal(summary.installmentTotal, 40000);
  assert.equal(summary.total, 232990);
  assert.equal(summary.remaining, 52990);
  assert.equal(summary.remainingCount, 2);
  assert.equal(summary.nextCycles.length, 6);
  assert.equal(summary.nextCycles[0]?.current, true);
  assert.equal(summary.nextCycles[0]?.month, "2026-11");
  assert.equal(summary.nextCycles[1]?.installments, 40000);
  assert.equal(summary.nextCycles[2]?.installments, 0);
  assert.ok(summary.forecast > 0);
});
