import type { FinanceData, Transaction } from "./types";
import { localDate } from "./format";

function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-15T12:00:00`);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthEnd(month: string, today = localDate()) {
  if (month === today.slice(0, 7)) return today;
  const lastDay = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

/** Contas + investimentos em BRL, com série reconstruída pelos lançamentos pagos. */
export function netWorth(data: FinanceData, months = 6) {
  const accounts = data.accounts.filter((row) => row.currency === "BRL");
  const investments = data.investments.filter((row) => row.currency === "BRL");
  const current =
    accounts.reduce((total, row) => total + row.balance, 0) +
    investments.reduce((total, row) => total + row.balance, 0);
  const today = localDate();
  const currentMonth = today.slice(0, 7);
  const cashflows = data.transactions.filter(
    (row) =>
      row.currency === "BRL" &&
      row.status === "paid" &&
      (row.kind === "income" || row.kind === "expense"),
  );
  const series = Array.from({ length: months }, (_, index) => {
    const month = shiftMonth(currentMonth, index - (months - 1));
    const end = monthEnd(month, today);
    const after = cashflows
      .filter((row) => row.date > end)
      .reduce(
        (total, row) =>
          total + (row.kind === "income" ? row.amount : -row.amount),
        0,
      );
    return { month, value: current - after };
  });
  const previous = series.at(-2)?.value ?? current;
  return {
    current,
    change: current - previous,
    series,
    empty: accounts.length === 0 && investments.length === 0,
  };
}

export function summarize(data: FinanceData, month: string, groupId = "all") {
  const records = data.transactions.filter(
    (row) =>
      row.currency === "BRL" &&
      row.date.startsWith(month) &&
      (groupId === "all" || row.groupId === groupId),
  );
  const sum = (kind: string, status?: string) =>
    records
      .filter((row) => row.kind === kind && (!status || row.status === status))
      .reduce((total, row) => total + row.amount, 0);
  const income = sum("income"),
    expenses = sum("expense"),
    transfers = sum("transfer");
  const groups = data.groups
    .map((group) => ({
      ...group,
      spent: records
        .filter((row) => row.groupId === group.id && row.kind === "expense")
        .reduce((total, row) => total + row.amount, 0),
    }))
    .filter((group) => groupId === "all" || groupId === group.id);
  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const flow = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const until = records.filter((row) => row.date <= date);
    return {
      day: i + 1,
      income:
        until
          .filter((row) => row.kind === "income")
          .reduce((n, row) => n + row.amount, 0) / 100,
      expenses:
        until
          .filter((row) => row.kind === "expense")
          .reduce((n, row) => n + row.amount, 0) / 100,
    };
  });
  const investments = data.investments.filter(
    (row) =>
      row.currency === "BRL" && (groupId === "all" || row.groupId === groupId),
  );
  return {
    records,
    income,
    expenses,
    transfers,
    balance: income - expenses,
    pending: sum("expense", "pending"),
    paid: sum("expense", "paid"),
    groups,
    flow,
    investments,
    invested: investments.reduce((n, row) => n + row.balance, 0),
    goals: data.goals.filter(
      (row) => groupId === "all" || row.groupId === groupId,
    ),
  };
}
export function filterTransactions(
  rows: Transaction[],
  query: string,
  type: string,
  status: string,
) {
  const text = query.toLocaleLowerCase("pt-BR");
  return rows.filter(
    (row) =>
      (type === "all" || row.kind === type) &&
      (status === "all" || row.status === status) &&
      `${row.description} ${row.category}`
        .toLocaleLowerCase("pt-BR")
        .includes(text),
  );
}
