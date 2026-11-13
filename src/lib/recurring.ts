import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { monthKey } from "./format";
import type {
  Account,
  FinanceData,
  Mode,
  Recurring,
  RecurringKind,
  RecurringType,
  Transaction,
} from "./types";

/** Última cobrança precisa estar neste intervalo (mês atual incluso). */
const ACTIVE_LOOKBACK_MONTHS = 2;

export type DetectedRecurring = {
  kind: RecurringKind;
  type: RecurringType;
  description: string;
  amount: number;
  dayOfMonth: number;
  category: string;

  accountId: string | null;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  startDate: string | null;
  endDate: string | null;
  matchKey: string;
  currency: string;
};

export type RecurringInstance = {
  recurringId: string;
  description: string;
  category: string;

  accountId: string | null;
  amount: number;
  date: string;
  status: "paid" | "pending";
  type: RecurringType;
  kind: RecurringKind;
  frequency: "monthly";
  installmentCurrent: number | null;
  installmentTotal: number | null;
  transactionId: string | null;
};

export type RecurringAccountShare = {
  accountId: string | null;
  name: string;
  color: string;
  amount: number;
  share: number;
};

export type RecurringCyclePoint = {
  month: string;
  label: string;
  fixed: number;
  installments: number;
  total: number;
  current: boolean;
};

export type RecurringCycleSummary = {
  kind: RecurringKind;
  month: string;
  remaining: number;
  remainingCount: number;
  fixedTotal: number;
  installmentTotal: number;
  total: number;
  forecast: number;
  forecastDeltaPct: number | null;
  byAccount: RecurringAccountShare[];
  nextCycles: RecurringCyclePoint[];
  fixed: RecurringInstance[];
  installments: RecurringInstance[];
};

const installmentPattern = /(?:parc(?:ela)?\.?\s*)?(\d{1,3})\s*\/\s*(\d{1,3})/i;

function monthFromDate(date: string) {
  return date.slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-15T12:00:00`);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon, 0).getDate();
}

function dueDate(month: string, dayOfMonth: number) {
  const day = Math.min(Math.max(dayOfMonth, 1), daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function modeDay(days: number[]) {
  const counts = new Map<number, number>();
  for (const day of days) counts.set(day, (counts.get(day) || 0) + 1);
  let best = days[0] || 1;
  let bestCount = 0;
  for (const [day, count] of counts) {
    if (count > bestCount || (count === bestCount && day < best)) {
      best = day;
      bestCount = count;
    }
  }
  return best;
}

function shortMonth(month: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(`${month}-15T12:00:00`))
    .replace(".", "");
}

export function normalizeMatchKey(description: string) {
  return description
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(installmentPattern, " ")
    .replace(
      /\b(?:parc(?:ela)?s?|compra|pagamento|debito|credito|fatura)\b/gi,
      " ",
    )
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isRecurringNoise(description: string) {
  const key = normalizeMatchKey(description);
  return (
    /\biof\b/.test(key) ||
    /\bde volta\b/.test(key) ||
    /\bestorno\b/.test(key) ||
    /\bcashback\b/.test(key)
  );
}

function isRecentlyActive(latestMonth: string, referenceMonth = monthKey()) {
  const cutoff = shiftMonth(referenceMonth, -ACTIVE_LOOKBACK_MONTHS);
  return latestMonth >= cutoff;
}

function isMonthlyCadence(months: Iterable<string>) {
  const sorted = [...new Set(months)].sort();
  if (sorted.length < 2) return false;
  const gaps = [];
  for (let index = 1; index < sorted.length; index++)
    gaps.push(monthsBetween(sorted[index - 1], sorted[index]));
  return median(gaps) <= 1;
}

export function parseInstallment(
  description: string,
  number?: number | null,
  total?: number | null,
) {
  if (
    number != null &&
    total != null &&
    Number.isInteger(number) &&
    Number.isInteger(total) &&
    number >= 1 &&
    total >= 2 &&
    number <= total
  )
    return { current: number, total };
  const match = description.match(installmentPattern);
  if (!match) return null;
  const current = Number(match[1]);
  const parsedTotal = Number(match[2]);
  if (
    !Number.isInteger(current) ||
    !Number.isInteger(parsedTotal) ||
    current < 1 ||
    parsedTotal < 2 ||
    current > parsedTotal
  )
    return null;
  return { current, total: parsedTotal };
}

export function recurringStableId(
  mode: Mode,
  kind: RecurringKind,
  type: RecurringType,
  matchKey: string,
  installmentTotal?: number | null,
) {
  const digest = createHash("sha1")
    .update(
      `${mode}|${kind}|${type}|${matchKey}|${installmentTotal ?? "fixed"}`,
    )
    .digest("hex")
    .slice(0, 20);
  return `rec-${digest}`;
}

function candidateTransactions(transactions: Transaction[]) {
  return transactions.filter(
    (row) => row.kind === "income" || row.kind === "expense",
  );
}

function detectInstallments(transactions: Transaction[]): DetectedRecurring[] {
  const groups = new Map<
    string,
    {
      rows: Transaction[];
      installment: { current: number; total: number };
      key: string;
      kind: RecurringKind;
    }
  >();
  for (const row of candidateTransactions(transactions)) {
    if (isRecurringNoise(row.description)) continue;
    const installment = parseInstallment(
      row.description,
      row.installmentNumber,
      row.installmentTotal,
    );
    if (!installment) continue;
    const key = normalizeMatchKey(row.description);
    if (!key) continue;
    const mapKey = `${row.kind}|${key}|${installment.total}`;
    const entry = groups.get(mapKey);
    if (entry) entry.rows.push(row);
    else
      groups.set(mapKey, {
        rows: [row],
        installment,
        key,
        kind: row.kind as RecurringKind,
      });
  }
  const detected: DetectedRecurring[] = [];
  for (const group of groups.values()) {
    const latest = [...group.rows].sort((a, b) =>
      b.date.localeCompare(a.date),
    )[0];
    if (!isRecentlyActive(monthFromDate(latest.date))) continue;
    const installment = parseInstallment(
      latest.description,
      latest.installmentNumber,
      latest.installmentTotal,
    );
    if (!installment) continue;
    if (installment.current >= installment.total) continue;
    const amounts = group.rows.map((row) => row.amount);
    const amount = median(amounts);
    const dayOfMonth = Number(latest.date.slice(8, 10));
    const latestMonth = monthFromDate(latest.date);
    const startMonth = shiftMonth(latestMonth, -(installment.current - 1));
    const endMonth = shiftMonth(
      latestMonth,
      installment.total - installment.current,
    );
    detected.push({
      kind: group.kind,
      type: "installment",
      description:
        latest.description.replace(installmentPattern, "").trim() ||
        latest.description,
      amount,
      dayOfMonth,
      category: latest.category,

      accountId: latest.accountId,
      installmentCurrent: installment.current,
      installmentTotal: installment.total,
      startDate: dueDate(startMonth, dayOfMonth),
      endDate: dueDate(endMonth, dayOfMonth),
      matchKey: group.key,
      currency: latest.currency || "BRL",
    });
  }
  return detected;
}

function detectFixed(transactions: Transaction[]): DetectedRecurring[] {
  const installmentKeys = new Set(
    detectInstallments(transactions).map(
      (row) => `${row.kind}|${row.matchKey}`,
    ),
  );
  const groups = new Map<string, Transaction[]>();
  for (const row of candidateTransactions(transactions)) {
    if (isRecurringNoise(row.description)) continue;
    const installment = parseInstallment(
      row.description,
      row.installmentNumber,
      row.installmentTotal,
    );
    if (installment) continue;
    const key = normalizeMatchKey(row.description);
    if (!key || key.length < 3) continue;
    if (installmentKeys.has(`${row.kind}|${key}`)) continue;
    const mapKey = `${row.kind}|${key}`;
    const list = groups.get(mapKey);
    if (list) list.push(row);
    else groups.set(mapKey, [row]);
  }
  const detected: DetectedRecurring[] = [];
  for (const [mapKey, rows] of groups) {
    const months = new Set(rows.map((row) => monthFromDate(row.date)));
    if (months.size < 2) continue;
    if (!isMonthlyCadence(months)) continue;
    const latest = [...rows].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!isRecentlyActive(monthFromDate(latest.date))) continue;
    const amounts = rows.map((row) => row.amount);
    const amount = median(amounts);
    if (!amount) continue;
    const varianceOk = amounts.every(
      (value) => Math.abs(value - amount) / amount <= 0.15,
    );
    if (!varianceOk) continue;
    const days = rows.map((row) => Number(row.date.slice(8, 10)));
    const dayOfMonth = modeDay(days);
    const dayOk = days.every((day) => Math.abs(day - dayOfMonth) <= 3);
    if (!dayOk) continue;
    const [kind] = mapKey.split("|") as [RecurringKind];
    detected.push({
      kind,
      type: "fixed",
      description: latest.description,
      amount,
      dayOfMonth,
      category: latest.category,

      accountId: latest.accountId,
      installmentCurrent: null,
      installmentTotal: null,
      startDate: [...rows].sort((a, b) => a.date.localeCompare(b.date))[0].date,
      endDate: null,
      matchKey: normalizeMatchKey(latest.description),
      currency: latest.currency || "BRL",
    });
  }
  return detected;
}

export function detectRecurrings(transactions: Transaction[]) {
  return [...detectInstallments(transactions), ...detectFixed(transactions)];
}

function mapRecurringRow(row: Record<string, unknown>): Recurring {
  return {
    id: String(row.id),
    kind: row.kind as RecurringKind,
    type: row.type as RecurringType,
    description: String(row.description),
    amount: Number(row.amount),
    dayOfMonth: Number(row.day_of_month),
    frequency: "monthly",
    category: String(row.category),

    accountId: (row.account_id as string | null) ?? null,
    installmentCurrent:
      row.installment_current == null ? null : Number(row.installment_current),
    installmentTotal:
      row.installment_total == null ? null : Number(row.installment_total),
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
    source: row.source as "detected" | "manual",
    matchKey: String(row.match_key),
    ignored: Boolean(row.ignored),
    active: Boolean(row.active),
    userEdited: Boolean(row.user_edited),
    currency: String(row.currency || "BRL"),
  };
}

export function listRecurrings(database: Database.Database, mode: Mode) {
  const rows = database
    .prepare(
      `SELECT id,kind,type,description,amount,day_of_month,frequency,category,
              account_id,installment_current,installment_total,start_date,end_date,source,
              match_key,ignored,active,user_edited,currency
       FROM recurrings WHERE mode=? ORDER BY day_of_month, description`,
    )
    .all(mode) as Record<string, unknown>[];
  return rows.map(mapRecurringRow);
}

export function reconcileRecurrings(database: Database.Database, mode: Mode) {
  const transactions = database
    .prepare(
      `SELECT id,description,amount,kind,date,status,category,
              account_id AS accountId,source,currency,
              installment_number AS installmentNumber,
              installment_total AS installmentTotal
       FROM transactions WHERE mode=?`,
    )
    .all(mode) as Transaction[];
  const detected = detectRecurrings(transactions);
  const existing = listRecurrings(database, mode);
  const byKey = new Map(
    existing.map((row) => [
      `${row.kind}|${row.type}|${row.matchKey}|${row.installmentTotal ?? ""}`,
      row,
    ]),
  );
  const seen = new Set<string>();
  const insert = database.prepare(
    `INSERT INTO recurrings(id,mode,kind,type,description,amount,day_of_month,frequency,category,account_id,installment_current,installment_total,start_date,end_date,source,match_key,ignored,active,user_edited,currency) VALUES(?,?,?,?,?,?,?,'monthly',?,?,?,?,?,?,'detected',?,0,1,0,?)`,
  );
  const update = database.prepare(
    `UPDATE recurrings SET description=?,amount=?,day_of_month=?,category=?,account_id=?,
      installment_current=?,installment_total=?,start_date=?,end_date=?,active=1
     WHERE id=? AND mode=? AND source='detected' AND user_edited=0 AND ignored=0`,
  );
  const deactivate = database.prepare(
    `UPDATE recurrings SET active=0 WHERE id=? AND mode=? AND source='detected' AND user_edited=0 AND ignored=0`,
  );

  database.transaction(() => {
    for (const row of detected) {
      const key = `${row.kind}|${row.type}|${row.matchKey}|${row.installmentTotal ?? ""}`;
      seen.add(key);
      const current = byKey.get(key);
      if (current?.ignored) continue;
      if (current?.userEdited) continue;
      if (current) {
        update.run(
          row.description,
          row.amount,
          row.dayOfMonth,
          row.category,

          row.accountId,
          row.installmentCurrent,
          row.installmentTotal,
          row.startDate,
          row.endDate,
          current.id,
          mode,
        );
        continue;
      }
      const id = recurringStableId(
        mode,
        row.kind,
        row.type,
        row.matchKey,
        row.installmentTotal,
      );
      insert.run(
        id,
        mode,
        row.kind,
        row.type,
        row.description,
        row.amount,
        row.dayOfMonth,
        row.category,

        row.accountId,
        row.installmentCurrent,
        row.installmentTotal,
        row.startDate,
        row.endDate,
        row.matchKey,
        row.currency,
      );
    }
    for (const row of existing) {
      if (row.source !== "detected" || row.userEdited || row.ignored) continue;
      const key = `${row.kind}|${row.type}|${row.matchKey}|${row.installmentTotal ?? ""}`;
      if (!seen.has(key)) deactivate.run(row.id, mode);
    }
  })();
}

function matchesCategory(categoryFilter: string, category: string) {
  if (categoryFilter === "all") return true;
  return (category || "Sem categoria") === categoryFilter;
}

function findMatch(
  recurring: Recurring,
  transactions: Transaction[],
  month: string,
  expectedInstallment: number | null,
) {
  const candidates = transactions.filter((row) => {
    if (row.kind !== recurring.kind) return false;
    if (monthFromDate(row.date) !== month) return false;
    if (normalizeMatchKey(row.description) !== recurring.matchKey) return false;
    if (
      Math.abs(row.amount - recurring.amount) / Math.max(recurring.amount, 1) >
      0.2
    )
      return false;
    if (expectedInstallment == null) return true;
    const parsed = parseInstallment(
      row.description,
      row.installmentNumber,
      row.installmentTotal,
    );
    return !parsed || parsed.current === expectedInstallment;
  });
  return [...candidates].sort((a, b) => {
    if (a.status !== b.status) return a.status === "paid" ? -1 : 1;
    return b.date.localeCompare(a.date);
  })[0];
}

function installmentForMonth(recurring: Recurring, month: string) {
  if (recurring.type !== "installment") return null;
  const total = recurring.installmentTotal;
  if (total == null) return null;
  if (recurring.startDate) {
    const index = monthsBetween(monthFromDate(recurring.startDate), month) + 1;
    if (index < 1 || index > total) return null;
    return index;
  }
  const current = recurring.installmentCurrent;
  if (current == null || current > total) return null;
  return current;
}

function buildInstances(
  data: FinanceData,
  month: string,
  kind: RecurringKind,
  category: string,
): RecurringInstance[] {
  const items: RecurringInstance[] = [];
  for (const recurring of data.recurrings) {
    if (!recurring.active || recurring.ignored) continue;
    if (recurring.kind !== kind) continue;
    if (!matchesCategory(category, recurring.category)) continue;
    if (recurring.endDate && monthFromDate(recurring.endDate) < month) continue;
    if (recurring.startDate && monthFromDate(recurring.startDate) > month)
      continue;

    let installmentCurrent: number | null = null;
    if (recurring.type === "installment") {
      installmentCurrent = installmentForMonth(recurring, month);
      if (installmentCurrent == null) continue;
    }

    const matched = findMatch(
      recurring,
      data.transactions,
      month,
      installmentCurrent,
    );
    const date = matched?.date || dueDate(month, recurring.dayOfMonth);
    items.push({
      recurringId: recurring.id,
      description: recurring.description,
      category: recurring.category,

      accountId: matched?.accountId ?? recurring.accountId,
      amount: matched?.amount ?? recurring.amount,
      date,
      status: matched?.status ?? "pending",
      type: recurring.type,
      kind: recurring.kind,
      frequency: "monthly",
      installmentCurrent,
      installmentTotal: recurring.installmentTotal,
      transactionId: matched?.id ?? null,
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function totalsFor(items: RecurringInstance[]) {
  const fixed = items.filter((row) => row.type === "fixed");
  const installments = items.filter((row) => row.type === "installment");
  const fixedTotal = fixed.reduce((sum, row) => sum + row.amount, 0);
  const installmentTotal = installments.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  return {
    fixed,
    installments,
    fixedTotal,
    installmentTotal,
    total: fixedTotal + installmentTotal,
  };
}

function accountShares(
  items: RecurringInstance[],
  accounts: Account[],
): RecurringAccountShare[] {
  const total = items.reduce((sum, row) => sum + row.amount, 0);
  if (!total) return [];
  const map = new Map<string | null, number>();
  for (const row of items)
    map.set(row.accountId, (map.get(row.accountId) || 0) + row.amount);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  return [...map.entries()]
    .map(([accountId, amount]) => {
      const account = accountId ? accountById.get(accountId) : undefined;
      return {
        accountId,
        name: account?.name || "Outros",
        color: account?.color || "#94a3b8",
        amount,
        share: amount / total,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function recurringCycle(
  data: FinanceData,
  month: string,
  kind: RecurringKind,
  category = "all",
): RecurringCycleSummary {
  const items = buildInstances(data, month, kind, category);
  const { fixed, installments, fixedTotal, installmentTotal, total } =
    totalsFor(items);
  const remainingItems = items.filter((row) => row.status !== "paid");
  const remaining = remainingItems.reduce((sum, row) => sum + row.amount, 0);

  const income = totalsFor(
    buildInstances(data, month, "income", category),
  ).total;
  const expense = totalsFor(
    buildInstances(data, month, "expense", category),
  ).total;
  const forecast = income - expense;
  const prevMonth = shiftMonth(month, -1);
  const prevIncome = totalsFor(
    buildInstances(data, prevMonth, "income", category),
  ).total;
  const prevExpense = totalsFor(
    buildInstances(data, prevMonth, "expense", category),
  ).total;
  const prevForecast = prevIncome - prevExpense;
  const forecastDeltaPct =
    prevForecast === 0
      ? null
      : ((forecast - prevForecast) / Math.abs(prevForecast)) * 100;

  const nextCycles: RecurringCyclePoint[] = [];
  for (let index = 0; index < 6; index++) {
    const cycleMonth = shiftMonth(month, index);
    const cycleItems = buildInstances(data, cycleMonth, kind, category);
    const cycleTotals = totalsFor(cycleItems);
    nextCycles.push({
      month: cycleMonth,
      label: shortMonth(cycleMonth),
      fixed: cycleTotals.fixedTotal,
      installments: cycleTotals.installmentTotal,
      total: cycleTotals.total,
      current: index === 0,
    });
  }

  return {
    kind,
    month,
    remaining:
      kind === "expense"
        ? remaining
        : remainingItems.reduce((sum, row) => sum + row.amount, 0),
    remainingCount: remainingItems.length,
    fixedTotal,
    installmentTotal,
    total,
    forecast,
    forecastDeltaPct,
    byAccount: accountShares(items, data.accounts),
    nextCycles,
    fixed,
    installments,
  };
}

export function newManualRecurringId() {
  return randomUUID();
}
