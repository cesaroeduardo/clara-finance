import type { FinanceData, PlanSettings, Transaction } from "./types";
import { localDate, money, parseMoney } from "./format";

export type TransactionPeriod = "month" | "last3" | "all" | "custom";

const emptyPlan = (): PlanSettings => ({
  monthlyLimit: 0,
  fixedCost: 0,
  monthlySavings: 0,
  expectedSalary: 0,
  expectedFreelance: 0,
});

/** Plano do mês; se não houver, herda o último mês anterior salvo. */
export function planForMonth(
  data: Pick<FinanceData, "plan" | "plans">,
  month: string,
): PlanSettings {
  const plans = data.plans || {};
  if (plans[month]) return plans[month];
  const previous = Object.keys(plans)
    .filter((key) => key < month)
    .sort()
    .at(-1);
  if (previous) return plans[previous]!;
  return data.plan || emptyPlan();
}

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

export function matchesCategoryFilter(
  category: string | null | undefined,
  filter: string,
) {
  if (filter === "all") return true;
  return (category || "Sem categoria") === filter;
}

export function summarize(data: FinanceData, month: string, category = "all") {
  const records = data.transactions.filter(
    (row) =>
      row.currency === "BRL" &&
      row.date.startsWith(month) &&
      matchesCategoryFilter(row.category, category),
  );
  const sum = (kind: string, status?: string) =>
    records
      .filter((row) => row.kind === kind && (!status || row.status === status))
      .reduce((total, row) => total + row.amount, 0);
  const income = sum("income"),
    expenses = sum("expense"),
    transfers = sum("transfer");
  const groups = data.groups.map((group) => ({
    ...group,
    spent: records
      .filter((row) => row.groupId === group.id && row.kind === "expense")
      .reduce((total, row) => total + row.amount, 0),
  }));
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
  const investments = data.investments.filter((row) => row.currency === "BRL");
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
    goals: data.goals,
  };
}

export type InvestmentBucket =
  | "caixinhas"
  | "tesouro"
  | "cripto"
  | "bolsa"
  | "fundos";

export const investmentBucketMeta: Record<
  InvestmentBucket,
  { label: string; color: string }
> = {
  caixinhas: { label: "Caixinhas", color: "#8b5cf6" },
  tesouro: { label: "Tesouro Direto", color: "#38bdf8" },
  cripto: { label: "Criptomoedas", color: "#ec4899" },
  bolsa: { label: "Bolsa de valores", color: "#a3e635" },
  fundos: { label: "Fundos", color: "#f59e0b" },
};

export function investmentBucket(
  row: FinanceData["investments"][number],
): InvestmentBucket {
  const name = row.name.toUpperCase();
  if (row.type === "EQUITY" || row.type === "ETF") return "bolsa";
  if (/BTC|BITCOIN|CRIPTO/.test(name)) return "cripto";
  if (/TESOURO/.test(name)) return "tesouro";
  if (row.type === "MUTUAL_FUND") return "fundos";
  return "caixinhas";
}

export function investmentsOverview(
  investments: FinanceData["investments"],
  options?: {
    period?: "month" | "all";
    monthGainById?: Record<string, number>;
  },
) {
  const period = options?.period || "all";
  const monthGainById = options?.monthGainById || {};
  const rows = investments.filter(
    (row) => row.currency === "BRL" && row.balance > 0,
  );
  const total = rows.reduce((sum, row) => sum + row.balance, 0);
  const order: InvestmentBucket[] = [
    "caixinhas",
    "tesouro",
    "fundos",
    "cripto",
    "bolsa",
  ];
  const categories = order
    .map((id) => {
      const items = rows.filter((row) => investmentBucket(row) === id);
      if (!items.length) return null;
      const balance = items.reduce((sum, row) => sum + row.balance, 0);
      let gain: number | null = null;
      if (period === "month") {
        let monthGain = 0;
        let known = false;
        for (const item of items) {
          if (monthGainById[item.id] == null) continue;
          monthGain += monthGainById[item.id];
          known = true;
        }
        gain = known ? monthGain : null;
      } else {
        const measured = items.filter(
          (row) => row.invested != null && row.invested > 0,
        );
        if (measured.length) {
          const cost = measured.reduce(
            (sum, row) => sum + (row.invested as number),
            0,
          );
          const measuredBalance = measured.reduce(
            (sum, row) => sum + row.balance,
            0,
          );
          gain = measuredBalance - cost;
        }
      }
      return {
        id,
        ...investmentBucketMeta[id],
        balance,
        gain,
        share: total > 0 ? (balance / total) * 100 : 0,
        count: items.length,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => b.balance - a.balance);

  const gains = categories
    .map((row) => row.gain)
    .filter((value): value is number => value != null);
  const gain = gains.length ? gains.reduce((sum, value) => sum + value, 0) : null;

  return {
    total,
    gain,
    categories,
    count: rows.length,
    empty: rows.length === 0,
  };
}

export function periodBounds(
  period: TransactionPeriod,
  month: string,
  customFrom = "",
  customTo = "",
  today = localDate(),
): { from?: string; to?: string } | null {
  if (period === "all") return null;
  if (period === "month") {
    return { from: `${month}-01`, to: monthEnd(month, today) };
  }
  if (period === "last3") {
    const endMonth = today.slice(0, 7);
    return { from: `${shiftMonth(endMonth, -2)}-01`, to: today };
  }
  return {
    from: customFrom || undefined,
    to: customTo || undefined,
  };
}

export function inPeriod(
  date: string,
  bounds: { from?: string; to?: string } | null,
) {
  if (!bounds) return true;
  if (bounds.from && date < bounds.from) return false;
  if (bounds.to && date > bounds.to) return false;
  return true;
}

function matchesTransactionQuery(row: Transaction, query: string) {
  const text = query.trim().toLocaleLowerCase("pt-BR");
  if (!text) return true;
  if (
    `${row.description} ${row.category}`
      .toLocaleLowerCase("pt-BR")
      .includes(text)
  ) {
    return true;
  }
  const amountFixed = (row.amount / 100).toFixed(2);
  const amountBr = amountFixed.replace(".", ",");
  const amountMoney = money(row.amount).toLocaleLowerCase("pt-BR");
  const compactQuery = text.replace(/\s/g, "");
  if (
    amountFixed.includes(text) ||
    amountBr.includes(text) ||
    amountMoney.includes(compactQuery)
  ) {
    return true;
  }
  const parsed = parseMoney(text);
  return !Number.isNaN(parsed) && row.amount === parsed;
}

export function filterTransactions(
  rows: Transaction[],
  query: string,
  type: string,
  status: string,
  category = "all",
) {
  return rows.filter(
    (row) =>
      (type === "all" || row.kind === type) &&
      (status === "all" || row.status === status) &&
      (category === "all" ||
        (row.category || "Sem categoria") === category) &&
      matchesTransactionQuery(row, query),
  );
}

function expenseByCategoryUntil(
  data: FinanceData,
  month: string,
  throughDay: number,
  category: string,
) {
  const cutoff = `${month}-${String(throughDay).padStart(2, "0")}`;
  const totals = new Map<string, number>();
  for (const row of data.transactions) {
    if (
      row.currency !== "BRL" ||
      row.kind !== "expense" ||
      !row.date.startsWith(month) ||
      row.date > cutoff ||
      !matchesCategoryFilter(row.category, category)
    ) {
      continue;
    }
    const key = row.category || "Sem categoria";
    totals.set(key, (totals.get(key) || 0) + row.amount);
  }
  return totals;
}

function creditAccountIds(data: FinanceData) {
  return new Set(
    data.accounts
      .filter((row) => row.type === "CREDIT" && row.currency === "BRL")
      .map((row) => row.id),
  );
}

function cardMonthExpenses(
  data: FinanceData,
  accountId: string,
  month: string,
  category: string,
  pendingOnly = false,
) {
  return data.transactions
    .filter(
      (row) =>
        row.accountId === accountId &&
        row.currency === "BRL" &&
        row.kind === "expense" &&
        row.date.startsWith(month) &&
        matchesCategoryFilter(row.category, category) &&
        (!pendingOnly || row.status === "pending"),
    )
    .reduce((total, row) => total + row.amount, 0);
}

/**
 * Fatura aberta conta no mês corrente (vence no início do próximo).
 * Mês atual: saldo do cartão (ou pendências). Passado: lançamentos do mês.
 */
function openCreditInvoices(
  data: FinanceData,
  month: string,
  category: string,
  isCurrent: boolean,
  isPast: boolean,
) {
  return data.accounts
    .filter((row) => row.type === "CREDIT" && row.currency === "BRL")
    .reduce((total, card) => {
      const pending = cardMonthExpenses(data, card.id, month, category, true);
      const closed = cardMonthExpenses(data, card.id, month, category, false);
      if (category !== "all") {
        return total + (isCurrent ? pending || closed : closed);
      }
      if (isCurrent) return total + (Math.abs(card.balance) || pending);
      if (isPast) return total + closed;
      return total + pending;
    }, 0);
}

const HOUSE_CATEGORY = "Contas da casa";
const FOOD_CATEGORY = "Alimentação";
const CNPJ_INCOME_PATTERN =
  /45\.?\s*548\.?\s*809|eduardo\s+de\s+cesaro\s+amarante/i;

export function isCnpjIncome(description: string) {
  return CNPJ_INCOME_PATTERN.test(description);
}

export function cnpjSalaryThreshold(expectedSalary: number) {
  return Math.max(700_000, Math.round(Math.max(0, expectedSalary) * 0.8));
}

function sumCategoryUntil(
  rows: { category: string; date: string; amount: number }[],
  category: string,
  until: string,
) {
  return rows
    .filter((row) => row.category === category && row.date <= until)
    .reduce((total, row) => total + row.amount, 0);
}

/** Ritmo ideal vs real: teto − Contas da casa − max(reserva comida, Alimentação) − demais. */
export function spendingPace(
  data: FinanceData,
  month: string,
  category = "all",
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
      matchesCategoryFilter(row.category, category),
  );
  const incomeMonth = records
    .filter((row) => row.kind === "income")
    .reduce((total, row) => total + row.amount, 0);
  const creditIds = creditAccountIds(data);
  const cashExpenses = records.filter(
    (row) =>
      row.kind === "expense" &&
      (!row.accountId || !creditIds.has(row.accountId)),
  );
  const openInvoices = openCreditInvoices(
    data,
    month,
    category,
    isCurrent,
    isPast,
  );
  const cashSpentToDate = cashExpenses
    .filter((row) => row.date <= cutoff && row.status === "paid")
    .reduce((total, row) => total + row.amount, 0);
  const paidCashExpenses = cashExpenses.filter((row) => row.status === "paid");
  const houseSpent = sumCategoryUntil(paidCashExpenses, HOUSE_CATEGORY, cutoff);
  const foodSpent = sumCategoryUntil(paidCashExpenses, FOOD_CATEGORY, cutoff);
  const foodReserve = Math.max(0, data.plan.fixedCost);
  // Reserva só “segura” o que ainda pode gastar; não entra como gasto no ritmo.
  const foodHold = Math.max(0, foodReserve - foodSpent);
  const foodBlock = foodSpent;
  // Gasto no ritmo = o que já saiu do banco (pago) + fatura aberta do cartão.
  const spentToDate = cashSpentToDate + openInvoices;
  const otherSpent = spentToDate - houseSpent - foodSpent;
  const rawSpent = spentToDate;

  const fixedCost = foodReserve;
  const monthlySavings = Math.max(0, data.plan.monthlySavings);
  const typedTeto = Math.max(0, data.plan.monthlyLimit);

  const expectedSalary = Math.max(0, data.plan.expectedSalary || 0);
  const expectedFreelance = Math.max(0, data.plan.expectedFreelance || 0);
  const salaryFloor = cnpjSalaryThreshold(expectedSalary);
  let salaryReceived = 0;
  let freelanceReceived = 0;
  for (const row of records) {
    if (row.kind !== "income" || row.currency !== "BRL") continue;
    if (!isCnpjIncome(row.description)) continue;
    if (row.amount >= salaryFloor) salaryReceived += row.amount;
    else freelanceReceived += row.amount;
  }
  const forecastSalary = Math.max(expectedSalary, salaryReceived);
  const forecastFreelance = Math.max(expectedFreelance, freelanceReceived);
  const forecastIncome = forecastSalary + forecastFreelance;
  // Visor original: limite = renda (já entrada / prevista) − guardar.
  const incomeSignal = forecastIncome > 0 ? forecastIncome : incomeMonth;
  const incomeBasedLimit = Math.max(0, incomeSignal - monthlySavings);
  const monthlyLimit =
    incomeBasedLimit > 0
      ? incomeBasedLimit
      : typedTeto;
  const remaining = monthlyLimit - spentToDate - foodHold;
  const daysLeft =
    isCurrent
      ? Math.max(1, daysInMonth - todayDay + 1)
      : isPast
        ? 1
        : daysInMonth;
  const dailyAllowance = Math.round(remaining / daysLeft);
  const avgDailyCash = cashSpentToDate / Math.max(1, todayDay);
  const projectedRaw =
    openInvoices + Math.round(avgDailyCash * daysInMonth);
  const projectedEndSpend = projectedRaw + foodHold;
  const projectedSurplus = monthlyLimit - projectedEndSpend;
  const projectedSurplus3m =
    (projectedSurplus + monthlySavings) * 3;
  const paceDelta = Math.round(
    (monthlyLimit * todayDay) / daysInMonth - spentToDate,
  );

  const series = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const ideal = (monthlyLimit * day) / daysInMonth / 100;
    const known = day <= todayDay;
    const cashThrough = paidCashExpenses
      .filter((row) => row.date <= date)
      .reduce((total, row) => total + row.amount, 0);
    const paceThrough = cashThrough + openInvoices;
    const actualCents = known ? paceThrough : null;
    const forecastCents =
      isCurrent && day >= todayDay
        ? openInvoices + Math.round(avgDailyCash * day)
        : isPast
          ? null
          : day >= todayDay
            ? openInvoices + Math.round(avgDailyCash * day)
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
    category,
  );
  const previousCats = expenseByCategoryUntil(
    data,
    previousMonth,
    compareDay,
    category,
  );
  let categoryShift: { category: string; delta: number } | null = null;
  const categories = new Set([...currentCats.keys(), ...previousCats.keys()]);
  for (const categoryName of categories) {
    const delta =
      (currentCats.get(categoryName) || 0) -
      (previousCats.get(categoryName) || 0);
    if (
      !categoryShift ||
      Math.abs(delta) > Math.abs(categoryShift.delta)
    ) {
      categoryShift = { category: categoryName, delta };
    }
  }
  const notableShift =
    categoryShift && categoryShift.delta !== 0 ? categoryShift : null;

  const limitUsedPercent =
    monthlyLimit > 0
      ? Math.min(999, Math.round((spentToDate / monthlyLimit) * 100))
      : 0;

  const forecastResult = forecastIncome - spentToDate - monthlySavings;

  return {
    incomeMonth,
    monthlyLimit,
    fixedCost,
    foodReserve,
    foodHold,
    monthlySavings,
    expectedSalary,
    expectedFreelance,
    salaryReceived,
    freelanceReceived,
    forecastSalary,
    forecastFreelance,
    forecastIncome,
    forecastResult,
    spentToDate,
    cashSpentToDate,
    openInvoices,
    houseSpent,
    foodSpent,
    foodBlock,
    otherSpent,
    remaining,
    daysLeft,
    dailyAllowance,
    paceDelta,
    todayDay,
    daysInMonth,
    series,
    projectedEndSpend,
    projectedSurplus,
    projectedSurplus3m,
    limitUsedPercent,
    categoryShift: notableShift as {
      category: string;
      delta: number;
    } | null,
    typedTeto,
    incomeBasedLimit,
    empty: monthlyLimit <= 0,
  };
}
