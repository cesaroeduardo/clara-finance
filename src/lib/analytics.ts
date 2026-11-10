import type { FinanceData, Transaction } from "./types";
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
