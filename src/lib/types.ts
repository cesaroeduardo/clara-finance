export type Mode = "demo" | "personal";
export type TransactionKind = "income" | "expense" | "transfer";
export type Transaction = {
  id: string;
  description: string;
  amount: number;
  kind: TransactionKind;
  date: string;
  status: "paid" | "pending";
  groupId: string;
  category: string;
  accountId: string | null;
  source: "manual" | "pluggy";
  currency: string;
};
export type Group = {
  id: string;
  name: string;
  color: string;
  icon: string;
  budget: number;
};
export type Account = {
  id: string;
  name: string;
  institution: string;
  type: string;
  balance: number;
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
  groupId: string;
  currency: string;
  source: string;
};
export type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  groupId: string;
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
export type FinanceData = {
  mode: Mode;
  transactions: Transaction[];
  groups: Group[];
  accounts: Account[];
  investments: Investment[];
  goals: Goal[];
  connections: Connection[];
  pluggyConfigured: boolean;
  updatedAt: string;
};
