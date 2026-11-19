import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import type { FinanceData } from "../src/lib/types";
import { planClaraReply, wantsClearChat } from "../src/lib/clara-mock-agent";

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
    {
      id: "tx-4",
      description: "Internet",
      amount: 12_000,
      kind: "expense",
      date: "2026-11-10",
      status: "pending",
      category: "Contas da casa",
      accountId: "acc-1",
      source: "manual",
      currency: "BRL",
      installmentNumber: null,
      installmentTotal: null,
    },
  ],
  categories: [
    {
      id: "cat-1",
      name: "Alimentação",
      color: "#22c55e",
      imageSlug: null,
      sortOrder: 0,
      taxonomyKey: "alimentacao",
    },
    {
      id: "cat-2",
      name: "Moradia",
      color: "#3b82f6",
      imageSlug: null,
      sortOrder: 1,
      taxonomyKey: "moradia",
    },
  ],
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
  goals: [
    {
      id: "goal-1",
      name: "Reserva",
      description: "",
      target: 1_000_000,
      current: 250_000,
      deadline: "2026-12-31",
      icon: "piggy",
      color: "#111111",
      imageSlug: null,
      completed: false,
      category: "all",
      createdAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    },
  ],
  connections: [],
  recurrings: [
    {
      id: "rec-1",
      kind: "expense",
      type: "fixed",
      description: "Aluguel",
      amount: 250_000,
      dayOfMonth: 5,
      frequency: "monthly",
      category: "Moradia",
      accountId: "acc-1",
      installmentCurrent: null,
      installmentTotal: null,
      startDate: "2026-01-01",
      endDate: null,
      source: "manual",
      matchKey: "aluguel",
      ignored: false,
      active: true,
      userEdited: false,
      currency: "BRL",
    },
  ],
  plan: {
    monthlyLimit: 500_000,
    fixedCost: 50_000,
    monthlySavings: 100_000,
    expectedSalary: 800_000,
    expectedFreelance: 0,
  },
  plans: {
    "2026-11": {
      monthlyLimit: 500_000,
      fixedCost: 50_000,
      monthlySavings: 100_000,
      expectedSalary: 800_000,
      expectedFreelance: 0,
    },
  },
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

test("mock entende quero ir pra Metas com passo UI SDK", () => {
  const result = planClaraReply({
    message: "quero ir pra metas",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.view, "goals");
  assert.deepEqual(result.steps, [
    { ref: "Abrir Metas", action: "press" },
  ]);
  assert.match(result.reply, /Metas/i);
});

test("mock entende quero ir pra Lançamentos com passo UI SDK", () => {
  const result = planClaraReply({
    message: "quero ir pra lançamentos",
    data: fixtureAccounts,
    currentView: "dashboard",
  });
  assert.equal(result.view, "transactions");
  assert.deepEqual(result.steps, [
    { ref: "Abrir Lançamentos", action: "press" },
  ]);
  assert.match(result.reply, /Lan[cç]amentos/i);
});

test("mock entende me leva pra Visão geral", () => {
  const result = planClaraReply({
    message: "me leva pra visão geral",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.view, "dashboard");
  assert.ok(
    result.steps?.some(
      (step) => step.ref === "Abrir Visão geral" && step.action === "press",
    ),
  );
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

test("wantsClearChat reconhece limpar o chat", () => {
  assert.equal(wantsClearChat("limpa o chat"), true);
  assert.equal(wantsClearChat("Limpar o chat"), true);
  assert.equal(wantsClearChat("limpar conversa"), true);
  assert.equal(wantsClearChat("/clear"), true);
  assert.equal(wantsClearChat("limpa o campo da mensagem"), false);
  assert.equal(wantsClearChat("quanto tenho nas contas?"), false);
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

test("mock responde ritmo do mês", () => {
  const result = planClaraReply({
    message: "posso gastar quanto hoje?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "pace");
  assert.match(result.reply, /por dia|ritmo|limite/i);
  assert.ok(result.card?.type === "pace" && result.card.monthlyLimit > 0);
});

test("mock responde resumo do período", () => {
  const result = planClaraReply({
    message: "como foi o mês de novembro de 2026?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "period-summary");
  assert.match(result.reply, /entradas|saídas|Resumo/i);
  assert.ok(
    result.card?.type === "period-summary" && result.card.income === 800_000,
  );
});

test("mock lista contas a pagar", () => {
  const result = planClaraReply({
    message: "o que vence em novembro de 2026?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "pending-bills");
  assert.match(result.reply, /Internet|a pagar/i);
  assert.ok(
    result.card?.type === "pending-bills" &&
      result.card.bills.some((row) => row.description === "Internet"),
  );
});

test("mock resume recorrentes do ciclo", () => {
  const result = planClaraReply({
    message: "quanto sai fixo em novembro de 2026?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "recurrings");
  assert.match(result.reply, /recorrentes|fixos|Aluguel/i);
  assert.ok(
    result.card?.type === "recurrings" && result.card.fixedTotal === 250_000,
  );
});

test("mock resume gasto por categoria", () => {
  const result = planClaraReply({
    message: "onde gastei mais em novembro de 2026?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "category-spend");
  assert.match(result.reply, /Moradia|categoria/i);
  assert.ok(
    result.card?.type === "category-spend" &&
      result.card.categories[0]?.name === "Moradia",
  );
});

test("mock detalha gasto em categoria nomeada", () => {
  const result = planClaraReply({
    message: "quanto gastei em Alimentação em novembro de 2026?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "category-spend");
  assert.match(result.reply, /a gente tem que comer bem/i);
  assert.ok(
    result.card?.type === "category-spend" &&
      result.card.focusCategory === "Alimentação" &&
      result.card.focusAmount === 42_050,
  );
});

test("mock inclui frase de efeito quando o maior gasto é Alimentação", () => {
  const data: FinanceData = {
    ...fixtureAccounts,
    transactions: [
      {
        id: "tx-food",
        description: "Carrefour",
        amount: 300_000,
        kind: "expense",
        date: "2026-11-09",
        status: "paid",
        category: "Alimentação",
        accountId: "acc-1",
        source: "manual",
        currency: "BRL",
        installmentNumber: null,
        installmentTotal: null,
      },
      {
        id: "tx-rent-small",
        description: "Aluguel",
        amount: 110_000,
        kind: "expense",
        date: "2026-11-02",
        status: "paid",
        category: "Contas da casa",
        accountId: "acc-1",
        source: "manual",
        currency: "BRL",
        installmentNumber: null,
        installmentTotal: null,
      },
    ],
  };
  const result = planClaraReply({
    message: "qual foi o meu maior gasto em novembro de 2026?",
    data,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "biggest-expense");
  assert.equal(result.card?.transaction.category, "Alimentação");
  assert.match(result.reply, /a gente tem que comer bem/i);
});

test("mock inclui frase de efeito quando o maior gasto é Compras", () => {
  const data: FinanceData = {
    ...fixtureAccounts,
    transactions: [
      {
        id: "tx-shop",
        description: "Amazon",
        amount: 280_000,
        kind: "expense",
        date: "2026-11-12",
        status: "paid",
        category: "Compras",
        accountId: "acc-1",
        source: "manual",
        currency: "BRL",
        installmentNumber: null,
        installmentTotal: null,
      },
    ],
  };
  const result = planClaraReply({
    message: "qual foi o meu maior gasto em novembro de 2026?",
    data,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "biggest-expense");
  assert.equal(result.card?.transaction.category, "Compras");
  assert.match(result.reply, /nossas coisinhas/i);
});

test("mock responde progresso das metas", () => {
  const result = planClaraReply({
    message: "como vão as metas?",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.card?.type, "goals");
  assert.match(result.reply, /Reserva|meta/i);
  assert.ok(
    result.card?.type === "goals" &&
      result.card.goals.some((row) => row.name === "Reserva"),
  );
});

test("mock conclui meta pelo nome com navegação e ação", () => {
  const result = planClaraReply({
    message: "conclui a meta Reserva",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.view, "goals");
  assert.deepEqual(result.steps, [
    { ref: "Abrir Metas", action: "press" },
  ]);
  assert.equal(result.action?.type, "complete-goal");
  assert.equal(result.action?.goalId, "goal-1");
  assert.match(result.reply, /Reserva|orgulh|Metas/i);
});

test("mock conclui meta sem press na sidebar se já está em Metas", () => {
  const result = planClaraReply({
    message: "conclui a meta Reserva",
    data: fixtureAccounts,
    currentView: "goals",
  });
  assert.equal(result.view, "goals");
  assert.equal(result.steps, undefined);
  assert.equal(result.action?.type, "complete-goal");
  assert.equal(result.action?.goalId, "goal-1");
});

test("mock pede o nome se a meta não for encontrada", () => {
  const result = planClaraReply({
    message: "conclui a meta Viagem",
    data: fixtureAccounts,
    currentView: "clara",
  });
  assert.equal(result.action, undefined);
  assert.match(result.reply, /Qual meta|nome/i);
});

test("mock entende consegui bater a meta do nome", () => {
  const data = {
    ...fixtureAccounts,
    goals: [
      {
        ...fixtureAccounts.goals[0]!,
        id: "goal-gta",
        name: "GTA VI",
      },
    ],
  };
  const result = planClaraReply({
    message: "Vó, consegui bater a meta do GTA VI",
    data,
    currentView: "clara",
  });
  assert.equal(result.view, "goals");
  assert.equal(result.action?.type, "complete-goal");
  assert.equal(result.action?.goalId, "goal-gta");
  assert.match(result.reply, /GTA VI|orgulh|Metas/i);
});

test("mock entende consegui a viagem sem dizer meta", () => {
  const data = {
    ...fixtureAccounts,
    goals: [
      {
        ...fixtureAccounts.goals[0]!,
        id: "goal-europa",
        name: "Viagem na Europa",
      },
    ],
  };
  const result = planClaraReply({
    message: "Consegui a viagem na europa vó",
    data,
    currentView: "clara",
  });
  assert.equal(result.view, "goals");
  assert.equal(result.action?.type, "complete-goal");
  assert.equal(result.action?.goalId, "goal-europa");
  assert.match(result.reply, /Viagem na Europa|orgulh|Metas/i);
});

test("mock desfaz última conclusão de meta", () => {
  const result = planClaraReply({
    message: "desfazer",
    data: fixtureAccounts,
    currentView: "clara",
    lastUndo: {
      type: "complete-goal",
      goalId: "goal-1",
      label: "Reserva",
    },
  });
  assert.equal(result.action?.type, "undo");
  assert.equal(result.view, "goals");
  assert.match(result.reply, /desfazer|Reserva/i);
});

test("mock avisa quando não há ação pra desfazer", () => {
  const result = planClaraReply({
    message: "desfazer",
    data: fixtureAccounts,
    currentView: "clara",
    lastUndo: null,
  });
  assert.equal(result.action, undefined);
  assert.match(result.reply, /nada pra desfazer/i);
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
  assert.equal(card?.sharePercent, 82.2);
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
        mutate: async () => {},
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
