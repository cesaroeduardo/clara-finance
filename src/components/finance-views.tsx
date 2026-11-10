"use client";
import { useContext, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Check,
  ChevronRight,
  Circle,
  Download,
  ExternalLink,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sprout,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FinanceIcon, Illustration } from "./finance-icons";
import { PrivacyContext } from "./finance-privacy";
import { LinkChevron } from "./finance-motion";
import type { FormState, Mutate } from "./finance-form";
import type { FinanceData, Goal, Mode, Transaction } from "@/lib/types";
import type { View } from "./finance-app";
import { summarize, filterTransactions } from "@/lib/analytics";
import { dateLabel, localDate, money } from "@/lib/format";
type Props = {
  data: FinanceData;
  month: string;
  group: string;
  query: string;
  setQuery: (value: string) => void;
  openForm: (form: FormState) => void;
  mutate: Mutate;
  navigate: (view: View) => void;
};
const record = (value: object) => value as Record<string, unknown>;
const assetNames: Record<string, string> = {
  shield: "shield",
  plane: "airplane",
  house: "house",
  target: "target",
  car: "target",
};
const investmentTypes: Record<string, string> = {
  FIXED_INCOME: "Renda fixa",
  EQUITY: "Ações",
  ETF: "ETFs",
  MUTUAL_FUND: "Fundos",
  SECURITY: "Previdência",
  COE: "COE",
  OTHER: "Outros",
};
export function Amount({
  value,
  currency = "BRL",
  className = "",
  prefix = "",
}: {
  value: number;
  currency?: string;
  className?: string;
  prefix?: string;
}) {
  const hidden = useContext(PrivacyContext);
  return (
    <span className={`amount ${className}`}>
      {hidden ? "••••••" : prefix + money(value, currency)}
    </span>
  );
}
function CardTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function TextLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link t-learn" onClick={onClick}>
      {children}
      <LinkChevron />
    </button>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Sprout size={25} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function DashboardView(props: Props) {
  const { data, month, group, openForm, navigate } = props;
  const stats = summarize(data, month, group);
  const availablePercent =
    stats.income > 0
      ? Math.max(0, Math.round((stats.balance / stats.income) * 100))
      : 0;
  const totalAllocation = Math.max(stats.income, stats.expenses);
  const expenseWidth = totalAllocation
    ? Math.min(100, (stats.expenses / totalAllocation) * 100)
    : 0;

  const spendingGroups = stats.groups.filter((g) => g.spent > 0);
  const totalGroupSpending = spendingGroups.reduce((n, g) => n + g.spent, 0);
  const stops = spendingGroups.map((g, i) => {
    const start =
      (spendingGroups.slice(0, i).reduce((n, g) => n + g.spent, 0) /
        totalGroupSpending) *
      100;
    return `${g.color} ${start}% ${start + (g.spent / totalGroupSpending) * 100}%`;
  });
  return (
    <div className="dashboard-grid">
      <section className="finance-card balance-card">
        <div className="balance-top">
          <div>
            <div className="balance-label">Saldo previsto</div>
            <div className="balance-value">
              <Amount value={stats.balance} />
            </div>
            <div className="balance-caption">
              <span className={stats.balance >= 0 ? "positive" : "negative"}>
                <ArrowUpRight size={14} />
                {availablePercent}% disponível
              </span>
            </div>
          </div>
          <Illustration name="wallet" className="wallet-art" />
        </div>
        <div className="allocation-track">
          <span style={{ width: `${expenseWidth}%`, background: "#2563eb" }} />
          <span style={{ flex: 1, background: "#19a76f" }} />
        </div>
        <div className="balance-metrics">
          <div>
            <span className="metric-label">
              <i className="dot green" /> Entradas
            </span>
            <strong>
              <Amount value={stats.income} />
            </strong>
          </div>
          <div>
            <span className="metric-label">
              <i className="dot blue" /> Saídas
            </span>
            <strong>
              <Amount value={stats.expenses} />
            </strong>
          </div>
          <div>
            <span className="metric-label">
              <i className="dot green" /> Resultado previsto
            </span>
            <strong>
              <Amount value={stats.balance} />
            </strong>
          </div>
        </div>
      </section>
      <UpcomingCard {...props} />
      <section className="finance-card spending-card">
        <CardTitle
          title="Saídas por grupo"

          action={
            <button
              className="icon-button"
              aria-label="Gerenciar grupos"
              onClick={() => navigate("groups")}
            >
              <MoreHorizontal size={20} />
            </button>
          }
        />
        <div className="spending-overview">
          <div
            className="spending-donut"
            style={{
              background: stops.length
                ? `conic-gradient(${stops.join(",")})`
                : "var(--track)",
            }}
          >
            <div>
              <span>Total de saídas</span>
              <strong>
                <Amount value={stats.expenses} />
              </strong>
            </div>
          </div>
          <div className="spending-legend">
            {spendingGroups.slice(0, 3).map((g) => (
              <div key={g.id}>
                <i style={{ background: g.color }} />
                <span>{g.name}</span>
                <strong>
                  {Math.round((g.spent / (stats.expenses || 1)) * 100)}%
                </strong>
              </div>
            ))}
            {!spendingGroups.length && <p className="muted">Sem saídas</p>}
          </div>
        </div>
        <div className="group-budget-list">
          {stats.groups
            .filter((g) => g.budget > 0 || g.spent > 0)
            .slice(0, 3)
            .map((g) => (
              <div key={g.id}>
                <div className="budget-row">
                  <span>
                    <FinanceIcon name={g.icon} size={14} />
                    {g.name}
                  </span>
                  <span>
                    <Amount value={g.spent} />
                    <small>
                      {" "}
                      / <Amount value={g.budget} />
                    </small>
                  </span>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${Math.min(100, g.budget ? (g.spent / g.budget) * 100 : 100)}%`,
                      background:
                        g.spent > g.budget && g.budget > 0
                          ? "#f59e0b"
                          : g.color,
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
        <div className="card-bottom">
          <TextLink onClick={() => navigate("groups")}>
            Ver meus grupos
          </TextLink>
        </div>
      </section>
      <section className="finance-card cashflow-card">
        <CardTitle title="Fluxo de caixa" subtitle="Acumulado" />
        <div className="chart-legend">
          <span>
            <i className="dot blue" />
            Entradas
          </span>
          <span>
            <i className="dot lightblue" />
            Saídas
          </span>
        </div>
        <div
          className="cashflow-chart"
          role="img"
          aria-label="Gráfico acumulado de entradas e saídas do mês"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={stats.flow}
              margin={{ top: 10, right: 3, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient
                  id="income-gradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--chart-grid)"
                strokeDasharray="3 4"
              />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#9298a3" }}
                ticks={[1, 5, 10, 15, 20, 25, 30].filter(
                  (day) => day <= stats.flow.length,
                )}
                tickFormatter={(v) => String(v).padStart(2, "0")}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#9298a3" }}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                width={54}
              />
              <Tooltip
                formatter={(value, name) => [
                  money(Number(value) * 100),
                  name === "income" ? "Entradas" : "Saídas",
                ]}
                labelFormatter={(value) => `Dia ${value}`}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
              />
              <Area
                dataKey="income"
                type="stepAfter"
                isAnimationActive={false}
                stroke="#2563eb"
                fill="url(#income-gradient)"
                strokeWidth={2.5}
              />
              <Area
                dataKey="expenses"
                type="monotone"
                isAnimationActive={false}
                stroke="#8db2fa"
                fill="transparent"
                strokeDasharray="4 4"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="cashflow-footer">
          <span>
            <span className="small-icon">
              <Wallet size={15} />
            </span>{" "}
            Resultado previsto do mês
          </span>
          <strong className={stats.balance >= 0 ? "positive" : "negative"}>
            <Amount value={stats.balance} />
          </strong>
        </div>
      </section>
      <section className="finance-card investments-summary">
        <div className="investment-summary-top">
          <div>
            <h2>Investimentos</h2>
            <div className="investment-total">
              <Amount value={stats.invested} />
            </div>
          </div>
          <Illustration name="coins" />
        </div>
        <div className="investment-mini-list">
          {stats.investments.slice(0, 3).map((inv, i) => (
            <div key={inv.id}>
              <span>
                <i
                  className="dot"
                  style={{ background: ["#2563eb", "#6d99f2", "#b4ccff"][i] }}
                />
                {inv.name}
              </span>
              <strong>
                <Amount value={inv.balance} />
              </strong>
            </div>
          ))}
        </div>
        <TextLink onClick={() => navigate("investments")}>
          Ver investimentos
        </TextLink>
      </section>
      <section className="finance-card goals-overview">
        <CardTitle
          title="Metas"

          action={
            <TextLink onClick={() => navigate("goals")}>Ver todas</TextLink>
          }
        />
        {stats.goals.length ? (
          <div className="goal-mini-grid">
            {stats.goals.slice(0, 3).map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                compact
                onClick={() =>
                  openForm({
                    resource: "goals",
                    record: record(goal),
                    contribute: true,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <Empty
            title="Nenhuma meta"

            action={
              <Button onClick={() => openForm({ resource: "goals" })}>
                <Plus size={15} />
                Criar meta
              </Button>
            }
          />
        )}
      </section>
      <section className="finance-card recent-card">
        <CardTitle
          title="Últimos lançamentos"

          action={
            <TextLink onClick={() => navigate("transactions")}>
              Ver todos
            </TextLink>
          }
        />
        {stats.records.length ? (
          <TransactionTable
            data={data}
            rows={stats.records.slice(0, 5)}
            openForm={openForm}
            compact
          />
        ) : (
          <Empty
            title="Nenhum lançamento"

            action={
              <Button onClick={() => openForm({ resource: "transactions" })}>
                <Plus size={15} />
                Novo lançamento
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
function UpcomingCard({ data, month, group, openForm, mutate }: Props) {
  const [day, setDay] = useState("all"),
    [busy, setBusy] = useState("");
  const bills = data.transactions
    .filter(
      (t) =>
        t.kind === "expense" &&
        t.status === "pending" &&
        t.currency === "BRL" &&
        t.date.startsWith(month) &&
        (group === "all" || t.groupId === group),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const dates = [...new Set(bills.map((t) => t.date.slice(8, 10)))];
  const filtered =
    day === "all" ? bills : bills.filter((t) => t.date.endsWith(`-${day}`));
  async function markPaid(row: Transaction) {
    if (row.source === "pluggy") {
      openForm({ resource: "transactions", record: record(row) });
      return;
    }
    setBusy(row.id);
    try {
      await mutate("transactions", { ...row, status: "paid" }, "PATCH");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao confirmar.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="finance-card upcoming-card">
      <div className="upcoming-header">
        <div>
          <h2>Contas a pagar</h2>

          <div className="upcoming-total">
            <Amount value={bills.reduce((n, t) => n + t.amount, 0)} />
          </div>
          <p>
            <span className="dot amber" />
            {bills.length} {bills.length === 1 ? "pendente" : "pendentes"}
          </p>
        </div>
        <Illustration name="calendar" />
      </div>
      <div className="due-date-tabs">
        <button
          className={day === "all" ? "selected" : ""}
          onClick={() => setDay("all")}
        >
          Todas<small>•••</small>
        </button>
        {dates.slice(0, 4).map((d) => (
          <button
            key={d}
            className={day === d ? "selected" : ""}
            onClick={() => setDay(d)}
          >
            {d}
            <small>
              {bills
                .filter((t) => t.date.endsWith(`-${d}`))
                .map(() => "•")
                .join("")}
            </small>
          </button>
        ))}
      </div>
      <div className="bill-list">
        {filtered.length ? (
          filtered.slice(0, 5).map((bill) => (
            <div className="bill-row" key={bill.id}>
              <button
                className="bill-check"
                aria-label={
                  bill.source === "manual"
                    ? `Marcar ${bill.description} como confirmado`
                    : `Editar categoria de ${bill.description}`
                }
                disabled={busy === bill.id}
                onClick={() => markPaid(bill)}
              >
                <Circle size={18} />
              </button>
              <div>
                <button
                  onClick={() =>
                    openForm({ resource: "transactions", record: record(bill) })
                  }
                >
                  {bill.description}
                </button>
                <span>
                  {dateLabel(bill.date)}
                  {bill.date < localDate() ? " · Em atraso" : ""}
                </span>
              </div>
              <strong>
                <Amount value={bill.amount} />
              </strong>
            </div>
          ))
        ) : (
          <div className="bills-empty">
            <ShieldCheck size={24} />
            <strong>Nenhuma conta pendente</strong>
          </div>
        )}
      </div>
    </section>
  );
}
function GoalCard({
  goal,
  compact = false,
  onClick,
  onEdit,
}: {
  goal: Goal;
  compact?: boolean;
  onClick: () => void;
  onEdit?: () => void;
}) {
  const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
  return (
    <div className={`goal-card ${compact ? "compact" : ""}`}>
      <div className="goal-card-top">
        <Illustration name={assetNames[goal.icon] || "target"} />
        {onEdit && (
          <button
            className="icon-button"
            aria-label={`Editar ${goal.name}`}
            onClick={onEdit}
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>
      <h3>{goal.name}</h3>
      <div className="goal-amount">
        <Amount value={goal.current} />
        <span>
          {" "}
          de <Amount value={goal.target} />
        </span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percent}%`, background: goal.color }} />
      </div>
      <div className="goal-card-footer">
        <span>{percent}%</span>
        <button
          onClick={onClick}
          aria-label={`Atualizar progresso de ${goal.name}`}
        >
          <Plus size={13} />
          {compact ? "Atualizar" : "Registrar progresso"}
        </button>
      </div>
      {!compact && (
        <div className="goal-deadline">
          Até{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            month: "long",
            year: "numeric",
          }).format(new Date(goal.deadline + "T12:00:00"))}
        </div>
      )}
    </div>
  );
}
function TransactionTable({
  data,
  rows,
  openForm,
  compact = false,
}: {
  data: FinanceData;
  rows: Transaction[];
  openForm: (form: FormState) => void;
  compact?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="transactions-table">
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Grupo</th>
            {!compact && <th>Conta</th>}
            <th>Data</th>
            <th>Situação</th>
            <th className="right">Valor</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const g = data.groups.find((g) => g.id === row.groupId),
              account = data.accounts.find((a) => a.id === row.accountId);
            return (
              <tr key={row.id}>
                <td>
                  <button
                    className="transaction-name"
                    onClick={() =>
                      openForm({
                        resource: "transactions",
                        record: record(row),
                      })
                    }
                  >
                    <span className={`transaction-symbol ${row.kind}`}>
                      {row.kind === "income" ? (
                        <ArrowDownLeft size={17} />
                      ) : row.kind === "transfer" ? (
                        <ArrowLeftRight size={17} />
                      ) : (
                        <FinanceIcon name={g?.icon || "layers"} size={17} />
                      )}
                    </span>
                    <span>
                      <strong>{row.description}</strong>
                      <small>
                        {row.category}
                        {row.source === "pluggy" ? " · Pluggy" : ""}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <span className="group-pill">
                    <i style={{ background: g?.color || "#94a3b8" }} />
                    {g?.name || "Sem grupo"}
                  </span>
                </td>
                {!compact && (
                  <td className="muted">{account?.institution || "Manual"}</td>
                )}
                <td className="table-date">{dateLabel(row.date)}</td>
                <td>
                  <span className={`status-pill ${row.status}`}>
                    {row.status === "paid" ? (
                      <>
                        <Check size={11} />
                        Confirmado
                      </>
                    ) : (
                      <>Pendente</>
                    )}
                  </span>
                </td>
                <td
                  className={`right transaction-amount ${row.kind === "income" ? "positive" : ""}`}
                >
                  <Amount
                    value={row.amount}
                    currency={row.currency}
                    prefix={
                      row.kind === "income"
                        ? "+ "
                        : row.kind === "expense"
                          ? "− "
                          : ""
                    }
                  />
                </td>
                <td>
                  <button
                    className="icon-button row-edit"
                    onClick={() =>
                      openForm({
                        resource: "transactions",
                        record: record(row),
                      })
                    }
                    aria-label={`Editar ${row.description}`}
                  >
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function TransactionsView(props: Props) {
  const { data, month, group, query, setQuery, openForm } = props;
  const [type, setType] = useState("all"),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1);
  const stats = summarize(data, month, group);
  const baseRows = data.transactions.filter(
    (row) =>
      row.date.startsWith(month) && (group === "all" || row.groupId === group),
  );
  const filtered = filterTransactions(baseRows, query, type, status);
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    currentPage = Math.min(page, pages);
  function exportCsv() {
    const safe = (value: string) =>
      `"${(/^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
    const csv =
      "\uFEFF" +
      [
        "Descrição;Valor;Moeda;Tipo;Data;Situação;Grupo;Categoria",
        ...filtered.map((row) =>
          [
            row.description,
            (row.amount / 100).toFixed(2),
            row.currency,
            row.kind,
            row.date,
            row.status,
            data.groups.find((g) => g.id === row.groupId)?.name || "",
            row.category,
          ]
            .map(safe)
            .join(";"),
        ),
      ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `clara-lancamentos-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="summary-grid">
        <MiniStat
          label="Entradas no mês"
          value={stats.income}
          icon={<ArrowDownLeft />}
          color="green"
        />
        <MiniStat
          label="Saídas no mês"
          value={stats.expenses}
          icon={<ArrowUpRight />}
          color="blue"
        />
        <MiniStat
          label="Ainda pendente"
          value={stats.pending}
          icon={<Wallet />}
          color="amber"
        />
      </div>
      <section className="finance-card full-table">
        <CardTitle
          title="Lançamentos"
          subtitle={`${filtered.length} registros`}
          action={
            <Button variant="outline" onClick={exportCsv}>
              <Download size={15} />
              Exportar CSV
            </Button>
          }
        />
        <div className="table-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              id="transaction-search"
              aria-label="Buscar lançamento"
              placeholder="Buscar por descrição ou categoria"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            className="field-select"
            aria-label="Filtrar por tipo"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos os tipos</option>
            <option value="income">Entradas</option>
            <option value="expense">Saídas</option>
            <option value="transfer">Transferências</option>
          </select>
          <select
            className="field-select"
            aria-label="Filtrar por situação"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todas as situações</option>
            <option value="paid">Confirmados</option>
            <option value="pending">Pendentes</option>
          </select>
        </div>
        {filtered.length ? (
          <>
            <TransactionTable
              data={data}
              rows={filtered.slice((currentPage - 1) * 10, currentPage * 10)}
              openForm={openForm}
            />
            <div className="pagination">
              <span>
                {(currentPage - 1) * 10 + 1}–
                {Math.min(currentPage * 10, filtered.length)} de{" "}
                {filtered.length}
              </span>
              <div>
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Anterior
                </Button>
                <span>
                  {currentPage} / {pages}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage === pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title="Nenhum lançamento encontrado"

            action={
              <Button onClick={() => openForm({ resource: "transactions" })}>
                <Plus size={15} />
                Novo lançamento
              </Button>
            }
          />
        )}
      </section>
      <p className="view-footnote">
        Totais em BRL. Transferências não compõem o resultado mensal.
      </p>
    </>
  );
}
function MiniStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="finance-card mini-stat">
      <span className={`stat-icon ${color}`}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>
          <Amount value={value} />
        </strong>
      </div>
    </div>
  );
}
export function InvestmentsView({ data, month, group, openForm }: Props) {
  const stats = summarize(data, month, group);
  const all = data.investments.filter(
    (row) => group === "all" || row.groupId === group,
  );
  const fixed = stats.investments
    .filter((row) => row.type === "FIXED_INCOME")
    .reduce((n, row) => n + row.balance, 0);
  return (
    <>
      <div className="summary-grid">
        <MiniStat
          label="Patrimônio investido · BRL"
          value={stats.invested}
          icon={<Sprout />}
          color="green"
        />
        <MiniStat
          label="Em renda fixa · BRL"
          value={fixed}
          icon={<ShieldCheck />}
          color="blue"
        />
        <MiniStat
          label="Outros investimentos · BRL"
          value={stats.invested - fixed}
          icon={<ArrowUpRight />}
          color="amber"
        />
      </div>
      <section className="finance-card investment-page">
        <CardTitle
          title="Carteira"

          action={
            <Button onClick={() => openForm({ resource: "investments" })}>
              <Plus size={15} />
              Adicionar posição
            </Button>
          }
        />
        {all.length ? (
          <div className="investment-positions">
            {all.map((row, i) => (
              <button
                key={row.id}
                className="investment-position"
                onClick={() =>
                  openForm({ resource: "investments", record: record(row) })
                }
              >
                <span
                  className="position-icon"
                  style={{
                    background: ["#edf3ff", "#edfaf4", "#fff8e9"][i % 3],
                    color: ["#2563eb", "#10a36b", "#d89319"][i % 3],
                  }}
                >
                  <Sprout size={21} />
                </span>
                <div>
                  <h3>{row.name}</h3>
                  <p>
                    {row.institution} <span>·</span>{" "}
                    {investmentTypes[row.type] || row.type}
                  </p>
                </div>
                <span className="group-pill">
                  <i
                    style={{
                      background: data.groups.find((g) => g.id === row.groupId)
                        ?.color,
                    }}
                  />
                  {data.groups.find((g) => g.id === row.groupId)?.name}
                </span>
                <div className="position-value">
                  <Amount value={row.balance} currency={row.currency} />
                  <small>
                    {row.source === "pluggy"
                      ? "Sincronizado pela Pluggy"
                      : "Posição manual"}
                  </small>
                </div>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title="Nenhum investimento"

            action={
              <Button onClick={() => openForm({ resource: "investments" })}>
                Adicionar investimento
              </Button>
            }
          />
        )}
      </section>
      <p className="view-footnote">
        Saldos da última atualização. Totais em BRL.
      </p>
    </>
  );
}
export function GoalsView({ data, group, openForm }: Props) {
  const goals = data.goals.filter(
    (g) => group === "all" || g.groupId === group,
  );
  return (
    <>
      <div className="section-top">
        <span>
          <strong>{goals.length}</strong>{" "}
          {goals.length === 1 ? "meta" : "metas"}
        </span>
        <Button onClick={() => openForm({ resource: "goals" })}>
          <Plus size={16} />
          Nova meta
        </Button>
      </div>
      {goals.length ? (
        <div className="goals-page-grid">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onClick={() =>
                openForm({
                  resource: "goals",
                  record: record(goal),
                  contribute: true,
                })
              }
              onEdit={() =>
                openForm({ resource: "goals", record: record(goal) })
              }
            />
          ))}
        </div>
      ) : (
        <section className="finance-card">
          <Empty
            title="Nenhuma meta"

            action={
              <Button onClick={() => openForm({ resource: "goals" })}>
                Criar meta
              </Button>
            }
          />
        </section>
      )}
    </>
  );
}
export function GroupsView({ data, month, group, openForm }: Props) {
  const stats = summarize(data, month, group);
  return (
    <>
      <div className="section-top">
        <span>{stats.groups.length} grupos</span>
        <Button onClick={() => openForm({ resource: "groups" })}>
          <Plus size={16} />
          Criar grupo
        </Button>
      </div>
      <div className="groups-page-grid">
        {stats.groups.map((g) => {
          const percent = g.budget ? Math.round((g.spent / g.budget) * 100) : 0;
          return (
            <section className="finance-card group-card" key={g.id}>
              <div className="group-card-head">
                <span
                  className="group-large-icon"
                  style={{ background: `${g.color}15`, color: g.color }}
                >
                  <FinanceIcon name={g.icon} size={25} />
                </span>
                <button
                  className="icon-button"
                  aria-label={`Editar grupo ${g.name}`}
                  onClick={() =>
                    openForm({ resource: "groups", record: record(g) })
                  }
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
              <h2>{g.name}</h2>
              <p>
                {
                  data.transactions.filter(
                    (t) => t.groupId === g.id && t.date.startsWith(month),
                  ).length
                }{" "}
                lançamentos neste mês
              </p>
              <div className="group-spent">
                <Amount value={g.spent} />
                <span>em saídas</span>
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: `${Math.min(100, percent)}%`,
                    background: g.color,
                  }}
                />
              </div>
              <div className="group-budget-caption">
                <span>
                  {g.budget ? (
                    <>
                      de <Amount value={g.budget} /> planejados
                    </>
                  ) : (
                    "Sem orçamento definido"
                  )}
                </span>
                <strong>{g.budget ? `${percent}%` : "—"}</strong>
              </div>
              <button
                className="text-link"
                onClick={() =>
                  openForm({ resource: "groups", record: record(g) })
                }
              >
                Editar grupo
                <ChevronRight size={14} />
              </button>
            </section>
          );
        })}
      </div>
      <p className="view-footnote">Orçamentos e saídas do mês selecionado.</p>
    </>
  );
}
export function AccountsView({
  data,
  openForm,
  sync,
  syncing,
  switchMode,
}: Props & {
  sync: () => void;
  syncing: boolean;
  switchMode: (mode: Mode) => void;
}) {
  return (
    <>
      <section className="finance-card connection-toolbar">
        <h2>Open Finance</h2>
        <div className="connect-actions">
          {data.mode === "demo" ? (
            <Button onClick={() => switchMode("personal")}>
              Configurar
              <ArrowUpRight size={15} />
            </Button>
          ) : (
            <Button onClick={() => openForm({ resource: "connections" })}>
              <Plus size={15} />
              Adicionar conexão
            </Button>
          )}
          <a
            href="https://meu.pluggy.ai/api-guide"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Guia
            <ExternalLink size={13} />
          </a>
        </div>
      </section>
      {data.mode === "personal" &&
        (data.connections.length === 0 || !data.pluggyConfigured) && (
          <section className="finance-card setup-card">
            <CardTitle title="Configuração" />
            <div className="setup-steps">
              <div>
                <span>1</span>
                <h3>Conectar bancos</h3>
                <p>Conecte seus bancos no Meu Pluggy.</p>
                <a
                  href="https://meu.pluggy.ai"
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir Meu Pluggy
                  <ExternalLink size={12} />
                </a>
              </div>
              <div>
                <span>2</span>
                <h3>Autorizar MeuPluggy</h3>
                <p>
                  Autorize o conector MeuPluggy no Dashboard e copie os itemIds.
                </p>
                <a
                  href="https://dashboard.pluggy.ai"
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir Dashboard
                  <ExternalLink size={12} />
                </a>
              </div>
              <div>
                <span>3</span>
                <h3>Adicionar conexões</h3>
                <p>
                  Preencha o .env.local, reinicie o app e adicione os itemIds.
                </p>
                <span
                  className={`config-status ${data.pluggyConfigured ? "configured" : ""}`}
                >
                  {data.pluggyConfigured ? (
                    <>
                      <Check size={13} />
                      Credenciais configuradas
                    </>
                  ) : (
                    "Credenciais pendentes"
                  )}
                </span>
              </div>
            </div>
          </section>
        )}
      <div className="accounts-layout">
        <section className="finance-card">
          <CardTitle
            title="Contas"
            subtitle={
              data.mode === "demo" ? undefined : "Saldos da instituição"
            }
          />
          {data.accounts.length ? (
            <div className="bank-account-list">
              {data.accounts.map((account) => (
                <div className="bank-account" key={account.id}>
                  <span
                    className="bank-logo"
                    style={{ background: account.color }}
                  >
                    {account.institution.slice(0, 2).toLowerCase()}
                  </span>
                  <div>
                    <h3>{account.institution}</h3>
                    <p>
                      {account.name} ·{" "}
                      {account.type === "CREDIT"
                        ? "Cartão de crédito"
                        : "Conta bancária"}
                    </p>
                  </div>
                  <strong>
                    <Amount
                      value={account.balance}
                      currency={account.currency}
                    />
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Nenhuma conta" />
          )}
        </section>
        <section className="finance-card">
          <CardTitle
            title="Conexões"

            action={
              <button
                className="icon-button"
                aria-label="Sincronizar conexões"
                onClick={sync}
                disabled={syncing}
              >
                <RefreshCw
                  size={17}
                  className={syncing ? "animate-spin" : ""}
                />
              </button>
            }
          />
          {data.connections.length ? (
            <div className="connections-list">
              {data.connections.map((connection) => (
                <div className="connection-item" key={connection.id}>
                  <div>
                    <Landmark size={19} />
                    <h3>{connection.name}</h3>
                    <span
                      className={`status-pill ${connection.status === "UPDATED" ? "paid" : "pending"}`}
                    >
                      {connection.status === "UPDATED"
                        ? "Atualizado"
                        : connection.status === "ERROR"
                          ? "Requer atenção"
                          : "Aguardando"}
                    </span>
                  </div>
                  <p>
                    {connection.lastSync
                      ? `Última leitura: ${new Date(connection.lastSync).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                      : "Ainda não sincronizado"}
                  </p>
                  {connection.consentExpiresAt && (
                    <p>
                      Autorização até {dateLabel(connection.consentExpiresAt)}
                    </p>
                  )}
                  {connection.error && (
                    <p className="connection-error">{connection.error}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title={
                data.mode === "demo" ? "Modo demonstração" : "Nenhuma conexão"
              }
              description="Adicione o itemId fornecido pela sua aplicação Pluggy."
              action={
                data.mode === "personal" ? (
                  <Button
                    variant="outline"
                    onClick={() => openForm({ resource: "connections" })}
                  >
                    <Plus size={15} />
                    Adicionar conexão
                  </Button>
                ) : undefined
              }
            />
          )}
        </section>
      </div>
      <p className="view-footnote">
        Sincronização bancária a cada 24 h. Até 5 conexões pessoais.
      </p>
    </>
  );
}
