import { accountChannelLabel, displayInstitution } from "@/lib/accounts";
import { netWorth, shiftMonth } from "@/lib/analytics";
import type { ClaraHelpCard } from "@/lib/clara-agent-help";
import { localDate, monthKey, monthLabel, money } from "@/lib/format";
import type { Account, FinanceData, Transaction } from "@/lib/types";

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

export type ClaraAgentCard =
  | ClaraBiggestExpenseCard
  | ClaraBalancesCard
  | ClaraNetWorthCard
  | ClaraAccountCard
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
    ) ||
    /\bonde\s+(mais\s+)?(gastei|gasta|foi\s+o\s+dinheiro)\b/i.test(message)
  );
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

export function biggestExpenseReply(card: ClaraBiggestExpenseCard) {
  const amount = money(
    card.transaction.amount,
    card.transaction.currency || "BRL",
  );
  return [
    `Achei o maior gasto de ${card.monthLabel}, meu bem:`,
    `${card.transaction.description} — ${amount}.`,
    `Isso foi ${card.sharePercent}% das suas saídas do mês (${money(card.monthExpenseTotal)} no total). Olha o cartão abaixo com o detalhe.`,
  ].join(" ");
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
      ? "sem variação em relação ao mês passado"
      : card.change > 0
        ? `subiu ${money(card.change)} em relação ao mês passado`
        : `baixou ${money(Math.abs(card.change))} em relação ao mês passado`;
  return `Patrimônio estimado: ${money(card.current)} — ${change}. Guarde um tempinho pra olhar com calma.`;
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

/** Keep Transaction type referenced for clarity in consumers. */
export type { Transaction };
