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

export function matchesGroupFilter(groupId: string, filter: string) {
  if (filter === "all") return true;
  if (filter === "ungrouped") return !groupId;
  return groupId === filter;
}

export function summarize(data: FinanceData, month: string, groupId = "all") {
  const records = data.transactions.filter(
    (row) =>
      row.currency === "BRL" &&
      row.date.startsWith(month) &&
      matchesGroupFilter(row.groupId, groupId),
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
    .filter((group) => matchesGroupFilter(group.id, groupId));
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
      row.currency === "BRL" && matchesGroupFilter(row.groupId, groupId),
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
    goals: data.goals.filter((row) =>
      matchesGroupFilter(row.groupId, groupId),
    ),
  };
}

export function filterTransactions(
  rows: Transaction[],
  query: string,
  type: string,
  status: string,
  category = "all",
) {
  const text = query.toLocaleLowerCase("pt-BR");
  return rows.filter(
    (row) =>
      (type === "all" || row.kind === type) &&
      (status === "all" || row.status === status) &&
      (category === "all" ||
        (row.category || "Sem categoria") === category) &&
      `${row.description} ${row.category}`
        .toLocaleLowerCase("pt-BR")
        .includes(text),
  );
}

function monthsUntilDeadline(deadline: string, from: string) {
  const months =
    (Number(deadline.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    (Number(deadline.slice(5, 7)) - Number(from.slice(5, 7)));
  return Math.max(1, months);
}

function expenseByCategoryUntil(
  data: FinanceData,
  month: string,
  throughDay: number,
  groupId: string,
) {
  const cutoff = `${month}-${String(throughDay).padStart(2, "0")}`;
  const totals = new Map<string, number>();
  for (const row of data.transactions) {
    if (
      row.currency !== "BRL" ||
      row.kind !== "expense" ||
      !row.date.startsWith(month) ||
      row.date > cutoff ||
      !matchesGroupFilter(row.groupId, groupId)
    ) {
      continue;
    }
    const key = row.category || "Sem categoria";
    totals.set(key, (totals.get(key) || 0) + row.amount);
  }
  return totals;
}

/** Ritmo ideal vs real: limite = renda do mês − aporte estimado das metas. */
export function spendingPace(
  data: FinanceData,
  month: string,
  groupId = "all",
) {
  const today = localDate();
  const currentMonth = today.slice(0, 7);
  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const todayDay =
    month === currentMonth
      ? Number(today.slice(8, 10))
      : month < currentMonth
        ? daysInMonth
        : 1;
  const cutoff =
    month === currentMonth
      ? today
      : month < currentMonth
        ? `${month}-${String(daysInMonth).padStart(2, "0")}`
        : `${month}-01`;
  const isCurrent = month === currentMonth;
  const isPast = month < currentMonth;

  const records = data.transactions.filter(
    (row) =>
      row.currency === "BRL" &&
      row.date.startsWith(month) &&
      matchesGroupFilter(row.groupId, groupId),
  );
  const incomeMonth = records
    .filter((row) => row.kind === "income")
    .reduce((total, row) => total + row.amount, 0);
  const expenses = records.filter((row) => row.kind === "expense");
  const spentToDate = expenses
    .filter((row) => row.date <= cutoff)
    .reduce((total, row) => total + row.amount, 0);

  const savingsNeed = data.goals
    .filter(
      (goal) =>
        matchesGroupFilter(goal.groupId, groupId) &&
        goal.current < goal.target,
    )
    .reduce((total, goal) => {
      const remaining = Math.max(0, goal.target - goal.current);
      return (
        total +
        Math.round(remaining / monthsUntilDeadline(goal.deadline, today))
      );
    }, 0);

  const monthlyLimit = Math.max(0, incomeMonth - savingsNeed);
  const remaining = monthlyLimit - spentToDate;
  const daysLeft =
    isCurrent
      ? Math.max(1, daysInMonth - todayDay + 1)
      : isPast
        ? 1
        : daysInMonth;
  const dailyAllowance = Math.round(remaining / daysLeft);
  const avgDailySpend = spentToDate / Math.max(1, todayDay);
  const projectedEndSpend = Math.round(avgDailySpend * daysInMonth);
  const projectedSurplus = monthlyLimit - projectedEndSpend;
  const paceDelta = Math.round(
    (monthlyLimit * todayDay) / daysInMonth - spentToDate,
  );

  const series = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const ideal = (monthlyLimit * day) / daysInMonth / 100;
    const known = day <= todayDay;
    const actualCents = known
      ? expenses
          .filter((row) => row.date <= date)
          .reduce((total, row) => total + row.amount, 0)
      : null;
    const forecastCents =
      isCurrent && day >= todayDay
        ? Math.round(avgDailySpend * day)
        : isPast
          ? null
          : day >= todayDay
            ? Math.round(avgDailySpend * day)
            : null;
    const actual = actualCents == null ? null : actualCents / 100;
    const forecast = forecastCents == null ? null : forecastCents / 100;
    const track = actual ?? forecast;
    return { day, ideal, actual, forecast, track };
  });

  const previousMonth = shiftMonth(month, -1);
  const previousDays = new Date(
    Number(previousMonth.slice(0, 4)),
    Number(previousMonth.slice(5, 7)),
    0,
  ).getDate();
  const compareDay = Math.min(todayDay, previousDays);
  const currentCats = expenseByCategoryUntil(
    data,
    month,
    compareDay,
    groupId,
  );
  const previousCats = expenseByCategoryUntil(
    data,
    previousMonth,
    compareDay,
    groupId,
  );
  let categoryShift: { category: string; delta: number } | null = null;
  const categories = new Set([...currentCats.keys(), ...previousCats.keys()]);
  for (const category of categories) {
    const delta =
      (currentCats.get(category) || 0) - (previousCats.get(category) || 0);
    if (
      !categoryShift ||
      Math.abs(delta) > Math.abs(categoryShift.delta)
    ) {
      categoryShift = { category, delta };
    }
  }
  const notableShift =
    categoryShift && categoryShift.delta !== 0 ? categoryShift : null;

  const limitUsedPercent =
    monthlyLimit > 0
      ? Math.min(999, Math.round((spentToDate / monthlyLimit) * 100))
      : 0;

  return {
    incomeMonth,
    savingsNeed,
    monthlyLimit,
    spentToDate,
    remaining,
    daysLeft,
    dailyAllowance,
    paceDelta,
    todayDay,
    daysInMonth,
    series,
    projectedEndSpend,
    projectedSurplus,
    projectedSurplus3m: projectedSurplus * 3,
    limitUsedPercent,
    categoryShift: notableShift as {
      category: string;
      delta: number;
    } | null,
    empty: incomeMonth <= 0,
  };
}
