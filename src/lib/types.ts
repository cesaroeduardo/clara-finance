export type Mode = "demo" | "personal";
export type TransactionKind = "income" | "expense" | "transfer";
export type Transaction = {
  id: string;
  description: string;
  amount: number;
  kind: TransactionKind;
  date: string;
  status: "paid" | "pending";

  category: string;
  accountId: string | null;
  source: "manual" | "pluggy";
  currency: string;
  installmentNumber: number | null;
  installmentTotal: number | null;
};
export type RecurringKind = "income" | "expense";
export type RecurringType = "fixed" | "installment";
export type Recurring = {
  id: string;
  kind: RecurringKind;
  type: RecurringType;
  description: string;
  amount: number;
  dayOfMonth: number;
  frequency: "monthly";
  category: string;

  accountId: string | null;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  startDate: string | null;
  endDate: string | null;
  source: "detected" | "manual";
  matchKey: string;
  ignored: boolean;
  active: boolean;
  userEdited: boolean;
  currency: string;
};
export type Category = {
  id: string;
  name: string;
  color: string;
  imageSlug: string | null;
  sortOrder: number;
  taxonomyKey?: string | null;
};
export type CategoryRule = {
  id: string;
  categoryId: string;
  category: string;
  match: string;
  operator: "contains" | "equals";

  priority: number;
  active: boolean;
};
export type Account = {
  id: string;
  name: string;
  institution: string;
  type: string;
  balance: number;
  availableCreditLimit: number | null;
  creditLimit: number | null;
  color: string;
  currency: string;
  itemId: string | null;
};
export type Investment = {
  id: string;
  name: string;
  institution: string;
  type: string;
  balance: number;
  invested: number | null;

  currency: string;
  source: string;
};
export type Goal = {
  createdAt: string | null;
  completedAt: string | null;
  category: string;
  description: string;
  imageSlug: string | null;
  completed: boolean;
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  icon: string;
  color: string;
};
export type Connection = {
  id: string;
  name: string;
  status: string;
  lastSync: string | null;
  error: string | null;
  consentExpiresAt: string | null;
};
export type PlanSettings = {
  monthlyLimit: number;
  fixedCost: number;
  monthlySavings: number;
  expectedSalary: number;
  expectedFreelance: number;
};
export type FinanceData = {
  merchantAssets?: { match: string; src: string }[];
  mode: Mode;
  transactions: Transaction[];

  categories: Category[];
  categoryRules: CategoryRule[];
  accounts: Account[];
  investments: Investment[];
  goals: Goal[];
  connections: Connection[];
  recurrings: Recurring[];
  /** Plano resolvido do mês civil atual (legado / fallback). */
  plan: PlanSettings;
  /** Planejamentos salvos por mês `YYYY-MM`. */
  plans: Record<string, PlanSettings>;
  pluggyConfigured: boolean;
  updatedAt: string;
};
