import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import type { FinanceData } from "../src/lib/types";
import { planClaraReply } from "../src/lib/clara-mock-agent";

const fixtureAccounts: FinanceData = {
  mode: "demo",
  transactions: [
    {
      id: "tx-1",
      description: "Aluguel",
      amount: 250_000,
      kind: "expense",
      date: "2026-11-05",
      status: "paid",
      category: "Moradia",
      accountId: "acc-1",
      source: "manual",
      currency: "BRL",
      installmentNumber: null,
      installmentTotal: null,
    },
    {
      id: "tx-2",
      description: "Mercado",
      amount: 42_050,
      kind: "expense",
      date: "2026-11-08",
      status: "paid",
      category: "Alimentação",
      accountId: "acc-1",
      source: "manual",
      currency: "BRL",
      installmentNumber: null,
      installmentTotal: null,
    },
    {
      id: "tx-3",
      description: "Salário",
      amount: 800_000,
      kind: "income",
      date: "2026-11-01",
      status: "paid",
      category: "Renda",
      accountId: "acc-1",
      source: "manual",
      currency: "BRL",
      installmentNumber: null,
      installmentTotal: null,
    },
  ],
  categories: [],
  categoryRules: [],
  accounts: [
    {
      id: "acc-1",
      name: "Conta corrente",
      institution: "Nubank",
      type: "BANK",
      balance: 150_050,
      availableCreditLimit: null,
      creditLimit: null,
      color: "#111111",
      currency: "BRL",
      itemId: null,
    },
    {
      id: "acc-2",
      name: "Cartão",
      institution: "Nubank",
      type: "CREDIT",
      balance: -20_000,
      availableCreditLimit: 80_000,
      creditLimit: 100_000,
      color: "#222222",
      currency: "BRL",
      itemId: null,
    },
  ],
  investments: [],
  goals: [],
  connections: [],
  recurrings: [],
  plan: {
    monthlyLimit: 0,
    fixedCost: 0,
    monthlySavings: 0,
    expectedSalary: 0,
    expectedFreelance: 0,
  },
  plans: {},
  pluggyConfigured: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("mock lista saldos das contas", () => {
  const result = planClaraReply({
    message: "quanto tenho nas contas?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.match(result.reply, /R\$/);
  assert.equal(result.card?.type, "balances");
  assert.ok(
    result.card?.type === "balances" &&
      result.card.accounts.some((row) => row.name === "Conta corrente"),
  );
  assert.ok(
    result.card?.type === "balances" &&
      result.card.accounts.some((row) => row.institution === "Nubank"),
  );
  assert.equal(result.view, undefined);
  assert.equal(result.steps, undefined);
});

test("mock responde patrimônio com card", () => {
  const result = planClaraReply({
    message: "qual meu patrimônio?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "net-worth");
  assert.match(result.reply, /Patrim[oô]nio/i);
  assert.match(result.reply, /R\$/);
});

test("mock abre Contas e resume saldo", () => {
  const result = planClaraReply({
    message: "abre Contas e mostra o saldo",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.view, "accounts");
  assert.ok(result.steps?.some((step) => step.ref === "Abrir Contas"));
  assert.match(result.reply, /Contas/i);
  assert.match(result.reply, /R\$/);
});

test("mock detalha conta por instituição", () => {
  const result = planClaraReply({
    message: "qual o saldo do Nubank?",
    data: fixtureAccounts,
    currentView: "dashboard",
  });
  assert.match(result.reply, /Nubank/);
  assert.match(result.reply, /Saldo/);
});

test("mock recusa exclusão", () => {
  const result = planClaraReply({
    message: "exclui a conta do Nubank",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.match(result.reply, /não faço sozinha/i);
  assert.equal(result.view, undefined);
  assert.equal(result.steps, undefined);
});

test("mock /help lista perguntas com card", () => {
  const result = planClaraReply({
    message: "/help",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "help");
  assert.ok(
    result.card?.type === "help" &&
      result.card.prompts.some((item) => item.prompt.includes("maior gasto")),
  );
  assert.match(result.reply, /perguntas|atalhos|campo/i);
});

test("mock responde maior gasto do mês com card", () => {
  const result = planClaraReply({
    message: "qual foi o meu maior gasto em novembro de 2026?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.match(result.reply, /Aluguel/);
  assert.equal(result.card?.type, "biggest-expense");
  assert.equal(result.card?.transaction.description, "Aluguel");
  assert.equal(result.card?.transaction.amount, 250_000);
  assert.equal(result.card?.month, "2026-11");
  assert.ok((result.card?.runnersUp.length ?? 0) >= 1);
});

test("resolve mês passado e este mês para insights", async () => {
  const { resolveMonthFromMessage, biggestExpenseInsight } = await import(
    "../src/lib/clara-agent-insights"
  );
  assert.equal(
    resolveMonthFromMessage("maior gasto este mês", "2026-11-14"),
    "2026-11",
  );
  assert.equal(
    resolveMonthFromMessage("maior gasto mês passado", "2026-11-14"),
    "2026-10",
  );
  const card = biggestExpenseInsight(fixtureAccounts, "2026-11");
  assert.equal(card?.transaction.description, "Aluguel");
  assert.equal(card?.sharePercent, 85.6);
});

test("composer da Clara é localizável e preenchível pelo createAgent", async () => {
  const dom = new JSDOM(
    "<!doctype html><html lang='pt-BR'><head></head><body></body></html>",
    { url: "http://localhost", pretendToBeVisual: true },
  );
  const view = dom.window;
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLFieldSetElement",
    "HTMLFormElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "HTMLLabelElement",
    "HTMLButtonElement",
    "Element",
    "Node",
    "Document",
    "ShadowRoot",
    "MutationObserver",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "KeyboardEvent",
    "DOMRect",
    "getComputedStyle",
  ] as const) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: view[key],
    });
  }
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: view.requestAnimationFrame.bind(view),
    cancelAnimationFrame: view.cancelAnimationFrame.bind(view),
  });
  view.HTMLElement.prototype.showPopover = () => {};
  view.HTMLElement.prototype.hidePopover = () => {};
  view.Element.prototype.getAnimations = () => [];
  view.Element.prototype.scrollIntoView = () => {};
  view.Element.prototype.checkVisibility = () => true;
  view.Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  view.document.elementFromPoint = () => null;
  view.document.elementsFromPoint = () => [];
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  view.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  });
  view.document.head.append(
    Object.assign(view.document.createElement("style"), {
      textContent: "[popover] { display: block !important }",
    }),
  );

  const React = await import("react");
  const { render, cleanup, act } = await import("@testing-library/react");
  const { createAgent } = createRequire(`${process.cwd()}/package.json`)(
    "@ui-sdk/react/agent",
  ) as typeof import("@ui-sdk/react/agent");
  const { ClaraAgentView } = await import("../src/components/clara-agent-view");
  const { setClaraChatMessages } = await import("../src/lib/clara-chat-session");
  setClaraChatMessages([]);
  const agent = createAgent();
  try {
    render(
      React.createElement(ClaraAgentView, {
        data: fixtureAccounts,
        currentView: "clara",
        onNavigate: () => {},
      }),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const entries = agent
      .snapshot()
      .filter((entry) => !entry.offPage && entry.component !== "more");
    for (const label of ["Mensagem para a Clara", "Modo voz"]) {
      assert.ok(
        entries.some((entry) => entry.label === label),
        `${label} ausente: ${JSON.stringify(entries.map((entry) => entry.label))}`,
      );
    }
    await act(async () => {
      const result = await agent.act({
        steps: [
          {
            ref: "Mensagem para a Clara",
            action: "setValue",
            args: ["quanto tenho?"],
          },
        ],
      });
      assert.equal(result.ok, true, result.error?.message);
    });
  } catch (error) {
    if (error instanceof AggregateError)
      throw new Error(
        error.errors.map((item) => String(item.stack ?? item)).join("\n"),
      );
    throw error;
  } finally {
    cleanup();
    setClaraChatMessages([]);
    dom.window.close();
  }
});
