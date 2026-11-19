import { accountChannelLabel, displayInstitution } from "@/lib/accounts";
import {
  matchesCategoryFilter,
  netWorth,
  periodDateBounds,
  periodLabel,
  planForMonth,
  shiftMonth,
  spendingPace,
  summarize,
  summarizePeriod,
  type AppPeriod,
  inPeriod,
} from "@/lib/analytics";
import type { ClaraHelpCard } from "@/lib/clara-agent-help";
import { localDate, monthKey, monthLabel, money } from "@/lib/format";
import { recurringCycle } from "@/lib/recurring";
import type { Account, FinanceData, Goal, Transaction } from "@/lib/types";

export type ClaraBiggestExpenseCard = {
  type: "biggest-expense";
  month: string;
  monthLabel: string;
  transaction: {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
    accountName: string | null;
    currency: string;
  };
  monthExpenseTotal: number;
  sharePercent: number;
  expenseCount: number;
  runnersUp: {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
  }[];
};

export type ClaraBalancesCard = {
  type: "balances";
  total: number;
  currency: string;
  accounts: {
    id: string;
    name: string;
    institution: string;
    channel: string;
    balance: number;
    currency: string;
  }[];
};

export type ClaraNetWorthCard = {
  type: "net-worth";
  current: number;
  change: number;
  accountsTotal: number;
  investmentsTotal: number;
  empty: boolean;
};

export type ClaraAccountCard = {
  type: "account";
  id: string;
  name: string;
  institution: string;
  channel: string;
  balance: number;
  currency: string;
  creditLimit: number | null;
  availableCreditLimit: number | null;
};

export type ClaraPaceCard = {
  type: "pace";
  month: string;
  monthLabel: string;
  dailyAllowance: number;
  remaining: number;
  spentToDate: number;
  monthlyLimit: number;
  limitUsedPercent: number;
  openInvoices: number;
  projectedEndSpend: number;
  daysLeft: number;
  empty: boolean;
};

export type ClaraPeriodSummaryCard = {
  type: "period-summary";
  periodLabel: string;
  income: number;
  expenses: number;
  balance: number;
  pending: number;
  paid: number;
  transactionCount: number;
};

export type ClaraPendingBillsCard = {
  type: "pending-bills";
  periodLabel: string;
  total: number;
  count: number;
  bills: {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
  }[];
};

export type ClaraRecurringsCard = {
  type: "recurrings";
  month: string;
  monthLabel: string;
  total: number;
  fixedTotal: number;
  installmentTotal: number;
  remaining: number;
  remainingCount: number;
  topItems: {
    id: string;
    description: string;
    amount: number;
    type: "fixed" | "installment";
  }[];
};

export type ClaraCategorySpendCard = {
  type: "category-spend";
  month: string;
  monthLabel: string;
  total: number;
  focusCategory: string | null;
  focusAmount: number | null;
  categories: {
    name: string;
    amount: number;
    sharePercent: number;
  }[];
};

export type ClaraGoalsCard = {
  type: "goals";
  activeCount: number;
  completedCount: number;
  goals: {
    id: string;
    name: string;
    current: number;
    target: number;
    remaining: number;
    percent: number;
    deadline: string;
    completed: boolean;
  }[];
};

export type ClaraAgentCard =
  | ClaraBiggestExpenseCard
  | ClaraBalancesCard
  | ClaraNetWorthCard
  | ClaraAccountCard
  | ClaraPaceCard
  | ClaraPeriodSummaryCard
  | ClaraPendingBillsCard
  | ClaraRecurringsCard
  | ClaraCategorySpendCard
  | ClaraGoalsCard
  | ClaraHelpCard;

const MONTH_NAMES: { pattern: RegExp; index: number }[] = [
  { pattern: /\bjan(?:eiro)?\b/i, index: 1 },
  { pattern: /\bfev(?:ereiro)?\b/i, index: 2 },
  { pattern: /\bmar(?:[cç]o)?\b/i, index: 3 },
  { pattern: /\babr(?:il)?\b/i, index: 4 },
  { pattern: /\bmai(?:o)?\b/i, index: 5 },
  { pattern: /\bjun(?:ho)?\b/i, index: 6 },
  { pattern: /\bjul(?:ho)?\b/i, index: 7 },
  { pattern: /\bago(?:sto)?\b/i, index: 8 },
  { pattern: /\bset(?:embro)?\b/i, index: 9 },
  { pattern: /\bout(?:ubro)?\b/i, index: 10 },
  { pattern: /\bnov(?:embro)?\b/i, index: 11 },
  { pattern: /\bdez(?:embro)?\b/i, index: 12 },
];

/** Resolve YYYY-MM a partir de “este mês”, “mês passado”, “novembro/2025”, etc. */
export function resolveMonthFromMessage(
  message: string,
  today = localDate(),
): string {
  const current = today.slice(0, 7);
  const text = message
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");

  if (
    /\b(este|esse|atual)\s+mes\b/.test(text) ||
    /\bmes\s+(atual|corrente)\b/.test(text) ||
    /\bneste\s+mes\b/.test(text)
  ) {
    return current;
  }

  if (/\bmes\s+passado\b/.test(text) || /\bmes\s+anterior\b/.test(text)) {
    return shiftMonth(current, -1);
  }

  const iso = text.match(/\b(20\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}`;

  const slash = text.match(/\b(\d{1,2})[\/\-.](20\d{2})\b/);
  if (slash) {
    const month = Number(slash[1]);
    if (month >= 1 && month <= 12) {
      return `${slash[2]}-${String(month).padStart(2, "0")}`;
    }
  }

  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : current.slice(0, 4);
  for (const entry of MONTH_NAMES) {
    if (entry.pattern.test(message)) {
      return `${year}-${String(entry.index).padStart(2, "0")}`;
    }
  }

  return current;
}

export function wantsBiggestExpense(message: string) {
  return (
    /\b(maior|mais\s+alto|mais\s+cara|mais\s+caro|principal)\b.*\b(gasto|despesa|sa[ií]da|compra|pagamento)\b/i.test(
      message,
    ) ||
    /\b(gasto|despesa|sa[ií]da)\b.*\b(maior|mais\s+alto|mais\s+cara|mais\s+caro)\b/i.test(
      message,
    )
  );
}

export function resolvePeriodFromMessage(
  message: string,
  today = localDate(),
): AppPeriod {
  const text = message
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
  if (
    /\b(ultimos?|ultimas?)\s+3\s+meses\b/.test(text) ||
    /\b3\s+meses\b/.test(text) ||
    /\btrimestre\b/.test(text)
  ) {
    return { mode: "last3", end: today.slice(0, 7) };
  }
  if (/\beste\s+ano\b/.test(text) || /\bano\s+(atual|corrente)\b/.test(text)) {
    return { mode: "year", year: Number(today.slice(0, 4)) };
  }
  return { mode: "month", month: resolveMonthFromMessage(message, today) };
}

export function wantsPace(message: string) {
  return (
    /\b(posso\s+gastar|quanto\s+(posso|ainda\s+posso)\s+gastar|gasto\s+diario|por\s+dia|ritmo|or[cç]amento|limite\s+do\s+m[eê]s|ainda\s+(tenho|resta)\s+(pra|para)\s+gastar)\b/i.test(
      message,
    ) ||
    /\bcomo\s+est[aá]\s+(o\s+)?(or[cç]amento|ritmo|limite)\b/i.test(message)
  );
}

export function wantsPeriodSummary(message: string) {
  return (
    /\b(como\s+foi|resumo|fechamento|balan[cç]o)\b.*\b(m[eê]s|per[ií]odo|trimestre|ano)\b/i.test(
      message,
    ) ||
    /\b(resumo|fechamento|balan[cç]o)\s+(do|da|de)\b/i.test(message) ||
    /\b(entradas?\s+e\s+sa[ií]das?|receita\s+e\s+despesa)\b/i.test(message) ||
    /\bcomo\s+(foi|est[aá]|andam)\s+(as\s+)?finan[cç]as\b/i.test(message)
  );
}

export function wantsPendingBills(message: string) {
  return (
    /\b(contas?\s+a\s+pagar|pend[eê]ncias?|o\s+que\s+vence|o\s+que\s+falta\s+pagar|a\s+pagar)\b/i.test(
      message,
    ) ||
    /\b(despesas?|contas?)\s+pendentes?\b/i.test(message)
  );
}

export function wantsRecurrings(message: string) {
  return (
    (/\b(recorrentes?|fixos?|assinaturas?|parcelas?)\b/i.test(message) &&
      /\b(quanto|sai|saem|total|ciclo|m[eê]s|lista|mostra|mostre)\b/i.test(
        message,
      )) ||
    /\bquanto\s+sai\s+fixo\b/i.test(message) ||
    /\bgastos?\s+fixos?\b/i.test(message)
  );
}

export function wantsCategorySpend(message: string) {
  return (
    /\bonde\s+(mais\s+)?(gastei|gasta|foi\s+o\s+dinheiro)\b/i.test(message) ||
    /\b(gasto|gastos|despesa|despesas)\s+por\s+categoria\b/i.test(message) ||
    /\b(distribui[cç][aã]o|ranking)\s+(de\s+)?(gastos?|despesas?|categorias?)\b/i.test(
      message,
    ) ||
    /\bquanto\s+(gastei|gasta|foi)\s+(em|com|na|no|nas|nos)\b/i.test(message) ||
    /\bgastei\s+(em|com|na|no)\b/i.test(message)
  );
}

export function wantsGoals(message: string) {
  if (
    /\b(abre|abra|abrir|ir\s+(?:pra|para)|vai\s+(?:pra|para)|quero\s+ir|me\s+leva)\b/i.test(
      message,
    )
  ) {
    return false;
  }
  if (wantsCompleteGoal(message)) return false;
  return (
    (/\b(metas?|objetivos?)\b/i.test(message) &&
      /\b(como|v[aã]o|andam|progresso|status|faltam?|falta|lista)\b/i.test(
        message,
      )) ||
    /\bcomo\s+v[aã]o\s+as\s+metas\b/i.test(message) ||
    /\bprogresso\s+das?\s+metas\b/i.test(message)
  );
}

/** Concluir / comemorar uma meta pelo nome. */
export function wantsCompleteGoal(message: string) {
  return (
    /\b(conclui(?:r|a)?|completar?|completei|completou|finalizei|finaliza|alcancei|atingi|atingiu)\b/i.test(
      message,
    ) ||
    // “Consegui a viagem…” / “consegui a meta…” — o nome da meta fecha o match.
    /\bconsegui\b/i.test(message) ||
    /\b(bater|bateu|bati|batemos)\b.*\b(meta|objetivo)\b/i.test(message) ||
    /\b(meta|objetivo)\b.*\b(bater|bateu|bati|batemos)\b/i.test(message) ||
    /\b(fechei|fechou|cheguei\s+na|chegou\s+na)\b.*\b(meta|objetivo)\b/i.test(
      message,
    ) ||
    /\bmarcar?\s+(?:a\s+)?(?:meta\s+)?como\s+conclu[ií]da\b/i.test(message) ||
    /\bmeta\s+conclu[ií]da\b/i.test(message) ||
    (/\b(parab[eé]ns|comemor[ae]|comemorar|parabeniz[aeo]?)\b/i.test(message) &&
      /\b(meta|objetivo)\b/i.test(message))
  );
}

const GOAL_FOCUS_STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "na",
  "no",
  "nas",
  "nos",
  "em",
  "e",
  "vo",
  "vó",
  "clara",
  "meta",
  "metas",
  "objetivo",
  "objetivos",
  "consegui",
  "completei",
  "conclui",
  "bater",
  "bateu",
  "bati",
]);

function goalFocusFromMessage(needle: string) {
  const afterMeta = needle.match(
    /\b(?:meta|objetivo)\s+(?:do|da|de|dos|das)?\s*(.+)$/i,
  );
  if (afterMeta?.[1]) return afterMeta[1].trim();

  const afterConsegui = needle.match(
    /\bconsegui\s+(?:a|o|as|os|uma|um)?\s*(.+)$/i,
  );
  if (afterConsegui?.[1]) {
    return afterConsegui[1]
      .replace(/\b(vo|vó|clara)\b.*$/i, "")
      .trim();
  }

  return needle.trim();
}

export function resolveGoalFromMessage(
  message: string,
  data: FinanceData,
): Goal | null {
  const needle = normalizeText(message);
  const focus = goalFocusFromMessage(needle);
  const focusTokens = focus
    .split(/\s+/)
    .filter((token) => token.length > 1 && !GOAL_FOCUS_STOPWORDS.has(token));

  let best: { goal: Goal; score: number } | null = null;
  for (const goal of data.goals) {
    const key = normalizeText(goal.name);
    if (key.length < 2) continue;
    const keyTokens = key.split(/\s+/).filter((token) => token.length > 1);
    const inFull = needle.includes(key);
    const inFocus =
      focus.includes(key) ||
      (focus.length >= 3 && key.includes(focus)) ||
      (focusTokens.length > 0 &&
        keyTokens.every((token) => focusTokens.includes(token)));
    if (!inFull && !inFocus) continue;
    let score = key.length + (goal.completed ? 0 : 10);
    if (inFocus) score += 5;
    if (focus === key || focusTokens.join(" ") === keyTokens.join(" ")) {
      score += 20;
    }
    if (!best || score > best.score) best = { goal, score };
  }
  return best?.goal ?? null;
}

export function completeGoalReply(goal: Goal) {
  return `Que orgulho, meu bem! Vou abrir Metas e concluir “${goal.name}” pra gente comemorar juntos.`;
}

export function completeGoalAlreadyReply(goal: Goal) {
  return `A meta “${goal.name}” já está concluída, meu bem. Continua assim.`;
}

export function completeGoalMissingReply() {
  return "Qual meta você quer concluir? Diz o nome pra eu achar certinho.";
}

function monthEndBound(month: string, today = localDate()) {
  if (month === today.slice(0, 7)) return today;
  const lastDay = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function expensesInMonth(data: FinanceData, month: string) {
  const from = `${month}-01`;
  const to = monthEndBound(month);
  return data.transactions
    .filter(
      (row) =>
        row.kind === "expense" &&
        row.date >= from &&
        row.date <= to &&
        row.currency === "BRL",
    )
    .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date));
}

function accountName(
  accountId: string | null,
  accounts: Account[],
): string | null {
  if (!accountId) return null;
  return accounts.find((row) => row.id === accountId)?.name ?? null;
}

export function biggestExpenseInsight(
  data: FinanceData,
  month = monthKey(),
): ClaraBiggestExpenseCard | null {
  const rows = expensesInMonth(data, month);
  const top = rows[0];
  if (!top) return null;

  const monthExpenseTotal = rows.reduce((sum, row) => sum + row.amount, 0);
  const sharePercent =
    monthExpenseTotal > 0
      ? Math.round((top.amount / monthExpenseTotal) * 1000) / 10
      : 0;

  return {
    type: "biggest-expense",
    month,
    monthLabel: monthLabel(month),
    transaction: {
      id: top.id,
      description: top.description,
      amount: top.amount,
      date: top.date,
      category: top.category || "Sem categoria",
      accountName: accountName(top.accountId, data.accounts),
      currency: top.currency || "BRL",
    },
    monthExpenseTotal,
    sharePercent,
    expenseCount: rows.length,
    runnersUp: rows.slice(1, 3).map((row) => ({
      id: row.id,
      description: row.description,
      amount: row.amount,
      date: row.date,
      category: row.category || "Sem categoria",
    })),
  };
}

function categoryCatchphrase(category: string) {
  if (category === "Alimentação") {
    return "Mas é isso aí, a gente tem que comer bem.";
  }
  if (category === "Compras") {
    return "O importante é a gente ter nossas coisinhas.";
  }
  return null;
}

export function biggestExpenseReply(card: ClaraBiggestExpenseCard) {
  const amount = money(
    card.transaction.amount,
    card.transaction.currency || "BRL",
  );
  const parts = [
    `Achei o maior gasto de ${card.monthLabel}, meu bem:`,
    `${card.transaction.description}: ${amount}.`,
    `Isso foi ${card.sharePercent}% das suas saídas do mês (${money(card.monthExpenseTotal)} no total). Olha o cartão abaixo com o detalhe.`,
  ];
  const phrase = categoryCatchphrase(card.transaction.category);
  if (phrase) parts.push(phrase);
  return parts.join(" ");
}

export function emptyBiggestExpenseReply(month: string) {
  return `Nesse período (${monthLabel(month)}) ainda não vejo nenhuma saída registrada, meu bem. Quando houver lançamentos, eu te mostro o maior gasto.`;
}

export function balancesInsight(data: FinanceData): ClaraBalancesCard | null {
  if (!data.accounts.length) return null;
  const accounts = data.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    institution: displayInstitution(account, data.connections),
    channel: accountChannelLabel(account),
    balance: account.balance,
    currency: account.currency || "BRL",
  }));
  const total = accounts
    .filter((row) => row.currency === "BRL")
    .reduce((sum, row) => sum + row.balance, 0);
  return {
    type: "balances",
    total,
    currency: "BRL",
    accounts,
  };
}

export function balancesReply(card: ClaraBalancesCard) {
  return `Olha os saldos com carinho, meu bem. Somando as contas em real: ${money(card.total, card.currency)}.`;
}

export function emptyBalancesReply() {
  return "Ainda não vejo nenhuma conta por aqui, meu bem. Conecte um banco em Contas e eu te ajudo.";
}

export function netWorthInsight(data: FinanceData): ClaraNetWorthCard {
  const worth = netWorth(data);
  const accountsTotal = data.accounts
    .filter((row) => row.currency === "BRL")
    .reduce((sum, row) => sum + row.balance, 0);
  const investmentsTotal = data.investments
    .filter((row) => row.currency === "BRL")
    .reduce((sum, row) => sum + row.balance, 0);
  return {
    type: "net-worth",
    current: worth.current,
    change: worth.change,
    accountsTotal,
    investmentsTotal,
    empty: worth.empty,
  };
}

export function netWorthCardReply(card: ClaraNetWorthCard) {
  if (card.empty) {
    return "Ainda não tenho saldos nem investimentos pra somar, meu bem. Quando tiver, eu te mostro certinho.";
  }
  const change =
    card.change === 0
      ? "Sem variação em relação ao mês passado"
      : card.change > 0
        ? `Subiu ${money(card.change)} em relação ao mês passado`
        : `Baixou ${money(Math.abs(card.change))} em relação ao mês passado`;
  return `Patrimônio estimado: ${money(card.current)}. ${change}. Guarde um tempinho pra olhar com calma.`;
}

export function accountInsight(
  account: Account,
  connections: FinanceData["connections"],
): ClaraAccountCard {
  return {
    type: "account",
    id: account.id,
    name: account.name,
    institution: displayInstitution(account, connections),
    channel: accountChannelLabel(account),
    balance: account.balance,
    currency: account.currency || "BRL",
    creditLimit: account.creditLimit,
    availableCreditLimit: account.availableCreditLimit,
  };
}

export function accountCardReply(card: ClaraAccountCard) {
  return `Achei ${card.name} · ${card.institution}. Saldo: ${money(card.balance, card.currency)}.`;
}

function withPlanForMonth(data: FinanceData, month: string): FinanceData {
  return { ...data, plan: planForMonth(data, month) };
}

export function paceInsight(
  data: FinanceData,
  month = monthKey(),
): ClaraPaceCard {
  const scoped = withPlanForMonth(data, month);
  const pace = spendingPace(scoped, month);
  return {
    type: "pace",
    month,
    monthLabel: monthLabel(month),
    dailyAllowance: pace.dailyAllowance,
    remaining: pace.remaining,
    spentToDate: pace.spentToDate,
    monthlyLimit: pace.monthlyLimit,
    limitUsedPercent: pace.limitUsedPercent,
    openInvoices: pace.openInvoices,
    projectedEndSpend: pace.projectedEndSpend,
    daysLeft: pace.daysLeft,
    empty: pace.empty,
  };
}

export function paceReply(card: ClaraPaceCard) {
  if (card.empty) {
    return `Ainda não tem limite definido pra ${card.monthLabel}, meu bem. Ajuste o plano na Visão geral e eu te digo quanto pode gastar por dia.`;
  }
  const daily =
    card.dailyAllowance >= 0
      ? money(card.dailyAllowance)
      : `−${money(Math.abs(card.dailyAllowance))}`;
  return [
    `Ritmo de ${card.monthLabel}: você pode gastar cerca de ${daily} por dia.`,
    `Já usou ${card.limitUsedPercent}% do limite (${money(card.spentToDate)} de ${money(card.monthlyLimit)}).`,
    `Restam ${card.daysLeft} dia(s) no mês.`,
  ].join(" ");
}

export function periodSummaryInsight(
  data: FinanceData,
  period: AppPeriod,
): ClaraPeriodSummaryCard {
  const month =
    period.mode === "month" ? period.month : monthKey();
  const scoped = withPlanForMonth(data, month);
  const stats =
    period.mode === "month"
      ? summarize(scoped, period.month)
      : summarizePeriod(scoped, period);
  return {
    type: "period-summary",
    periodLabel: periodLabel(period),
    income: stats.income,
    expenses: stats.expenses,
    balance: stats.balance,
    pending: stats.pending,
    paid: stats.paid,
    transactionCount: stats.records.length,
  };
}

export function periodSummaryReply(card: ClaraPeriodSummaryCard) {
  const result =
    card.balance >= 0
      ? `Sobrou ${money(card.balance)}`
      : `Faltou ${money(Math.abs(card.balance))}`;
  return [
    `Resumo de ${card.periodLabel}: entradas ${money(card.income)}, saídas ${money(card.expenses)}. ${result}.`,
    card.pending > 0
      ? `Ainda há ${money(card.pending)} pendente.`
      : "Nada pendente nesse período.",
  ].join(" ");
}

export function pendingBillsInsight(
  data: FinanceData,
  period: AppPeriod,
): ClaraPendingBillsCard {
  const bounds = periodDateBounds(period);
  const bills = data.transactions
    .filter(
      (row) =>
        row.kind === "expense" &&
        row.status === "pending" &&
        row.source !== "pluggy" &&
        row.currency === "BRL" &&
        inPeriod(row.date, bounds),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = bills.reduce((sum, row) => sum + row.amount, 0);
  return {
    type: "pending-bills",
    periodLabel: periodLabel(period),
    total,
    count: bills.length,
    bills: bills.slice(0, 5).map((row) => ({
      id: row.id,
      description: row.description,
      amount: row.amount,
      date: row.date,
      category: row.category || "Sem categoria",
    })),
  };
}

export function pendingBillsReply(card: ClaraPendingBillsCard) {
  if (card.count === 0) {
    return `Não vejo contas a pagar pendentes em ${card.periodLabel}, meu bem.`;
  }
  return `Tem ${card.count} conta(s) a pagar em ${card.periodLabel}, somando ${money(card.total)}. Olha a lista no cartão.`;
}

export function recurringsInsight(
  data: FinanceData,
  month = monthKey(),
): ClaraRecurringsCard {
  const cycle = recurringCycle(data, month, "expense");
  const topItems = [...cycle.fixed, ...cycle.installments]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((row) => ({
      id: row.recurringId,
      description: row.description,
      amount: row.amount,
      type: row.type,
    }));
  return {
    type: "recurrings",
    month,
    monthLabel: monthLabel(month),
    total: cycle.total,
    fixedTotal: cycle.fixedTotal,
    installmentTotal: cycle.installmentTotal,
    remaining: cycle.remaining,
    remainingCount: cycle.remainingCount,
    topItems,
  };
}

export function recurringsReply(card: ClaraRecurringsCard) {
  if (card.total <= 0 && card.topItems.length === 0) {
    return `Não achei recorrentes de saída em ${card.monthLabel}, meu bem.`;
  }
  return [
    `Em ${card.monthLabel}, o ciclo de recorrentes soma ${money(card.total)}`,
    `(fixos ${money(card.fixedTotal)}, parcelas ${money(card.installmentTotal)}).`,
    card.remainingCount > 0
      ? `Ainda faltam ${card.remainingCount} item(ns), ${money(card.remaining)}.`
      : "Tudo do ciclo já está quitado.",
  ].join(" ");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export function resolveCategoryFromMessage(
  message: string,
  data: FinanceData,
): string | null {
  const needle = normalizeText(message);
  const names = new Set<string>();
  for (const row of data.categories) {
    if (row.name.trim()) names.add(row.name);
  }
  for (const row of data.transactions) {
    if (row.category?.trim()) names.add(row.category);
  }
  let best: { name: string; score: number } | null = null;
  for (const name of names) {
    const key = normalizeText(name);
    if (key.length < 3) continue;
    if (!needle.includes(key)) continue;
    const score = key.length;
    if (!best || score > best.score) best = { name, score };
  }
  return best?.name ?? null;
}

export function categorySpendInsight(
  data: FinanceData,
  month = monthKey(),
  focusCategory: string | null = null,
): ClaraCategorySpendCard {
  const from = `${month}-01`;
  const to = monthEndBound(month);
  const totals = new Map<string, number>();
  for (const row of data.transactions) {
    if (
      row.kind !== "expense" ||
      row.currency !== "BRL" ||
      row.date < from ||
      row.date > to
    ) {
      continue;
    }
    if (
      focusCategory &&
      !matchesCategoryFilter(row.category, focusCategory)
    ) {
      continue;
    }
    const name = row.category || "Sem categoria";
    totals.set(name, (totals.get(name) || 0) + row.amount);
  }
  const categories = [...totals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const total = categories.reduce((sum, row) => sum + row.amount, 0);
  const ranked = categories.slice(0, 5).map((row) => ({
    name: row.name,
    amount: row.amount,
    sharePercent:
      total > 0 ? Math.round((row.amount / total) * 1000) / 10 : 0,
  }));
  const focusAmount = focusCategory
    ? (totals.get(focusCategory) ?? 0)
    : null;
  return {
    type: "category-spend",
    month,
    monthLabel: monthLabel(month),
    total: focusCategory ? (focusAmount ?? 0) : total,
    focusCategory,
    focusAmount,
    categories: ranked,
  };
}

export function categorySpendReply(card: ClaraCategorySpendCard) {
  if (card.focusCategory) {
    if (!card.focusAmount) {
      return `Em ${card.monthLabel} não vejo gastos em ${card.focusCategory}, meu bem.`;
    }
    const base = `Em ${card.monthLabel}, ${card.focusCategory} somou ${money(card.focusAmount)}.`;
    const phrase = categoryCatchphrase(card.focusCategory);
    return phrase ? `${base} ${phrase}` : base;
  }
  if (card.categories.length === 0) {
    return `Em ${card.monthLabel} ainda não tem gastos por categoria pra eu mostrar.`;
  }
  const top = card.categories[0]!;
  const base = [
    `Em ${card.monthLabel}, o maior bloco foi ${top.name} (${money(top.amount)}, ${top.sharePercent}% das saídas).`,
    `Total categorizado: ${money(card.total)}.`,
  ].join(" ");
  const phrase = categoryCatchphrase(top.name);
  return phrase ? `${base} ${phrase}` : base;
}

export function goalsInsight(data: FinanceData): ClaraGoalsCard {
  const goals = [...data.goals]
    .sort((a, b) => Number(a.completed) - Number(b.completed))
    .map((goal) => {
      const remaining = Math.max(0, goal.target - goal.current);
      const percent =
        goal.target > 0
          ? Math.min(100, Math.round((goal.current / goal.target) * 100))
          : 0;
      return {
        id: goal.id,
        name: goal.name,
        current: goal.current,
        target: goal.target,
        remaining,
        percent,
        deadline: goal.deadline,
        completed: goal.completed,
      };
    });
  return {
    type: "goals",
    activeCount: goals.filter((row) => !row.completed).length,
    completedCount: goals.filter((row) => row.completed).length,
    goals: goals.slice(0, 6),
  };
}

export function goalsReply(card: ClaraGoalsCard) {
  if (card.goals.length === 0) {
    return "Ainda não tem metas cadastradas, meu bem. Crie uma em Metas e eu acompanho com você.";
  }
  const active = card.goals.filter((row) => !row.completed);
  if (active.length === 0) {
    return `Todas as ${card.completedCount} meta(s) estão concluídas. Que orgulho.`;
  }
  const top = active[0]!;
  return [
    `Você tem ${card.activeCount} meta(s) em andamento.`,
    `${top.name} está em ${top.percent}% (${money(top.current)} de ${money(top.target)}).`,
  ].join(" ");
}

/** Keep Transaction type referenced for clarity in consumers. */
export type { Transaction };
