"use client";
import { useMemo, useState } from "react";
import {
  MagnifyingGlass,
  X,
  Wallet,
  Check,
  CalendarDots,
  ChartLineUp,
  Stack,
  Bank,
  PencilSimple,
  ArrowUp,
  ArrowDown,
} from "@phosphor-icons/react";
import { ChartCard } from "./ui/chart-card";
import { EmptyState } from "./ui/empty-state";
import { FieldSelect } from "./ui/field-select";
import { FinanceSurface } from "./ui/finance-surface";
import { ShellHeader } from "./ui/surface";
import { Amount, MiniStat, StatusTag } from "./finance-views";
import { CategoryImage, FinanceIcon } from "./finance-icons";
import { TransactionAvatar } from "./transaction-avatar";
import type { FormState } from "./finance-form";
import { formatAccountLabel } from "@/lib/accounts";
import { colorForCategory, imageForCategory } from "@/lib/categorize";
import { compactMoney, dateLabel } from "@/lib/format";
import { recurringCycle, type RecurringInstance } from "@/lib/recurring";

import type { FinanceData } from "@/lib/types";

type RecurringSortColumn =
  | "description"
  | "category"
  | "account"
  | "date"
  | "format"
  | "status"
  | "amount";

type RecurringSort = {
  column: RecurringSortColumn;
  direction: "asc" | "desc";
};

function formatLabel(row: RecurringInstance) {
  if (
    row.type === "installment" &&
    row.installmentCurrent != null &&
    row.installmentTotal != null
  ) {
    return `Parcela ${row.installmentCurrent} de ${row.installmentTotal}`;
  }
  return "Mensal";
}

function accountLabel(
  data: FinanceData,
  accountId: string | null,
) {
  if (!accountId) return "Manual";
  const account = data.accounts.find((item) => item.id === accountId);
  return account
    ? formatAccountLabel(account, data.connections)
    : "Manual";
}

function RecurringTable({
  data,
  rows,
  sort,
  onSort,
  onEdit,
}: {
  data: FinanceData;
  rows: RecurringInstance[];
  sort: RecurringSort;
  onSort: (column: RecurringSortColumn) => void;
  onEdit: (id: string) => void;
}) {
  const columns: [RecurringSortColumn, string][] = [
    ["description", "Descrição"],
    ["category", "Categoria"],
    ["account", "Conta"],
    ["date", "Data"],
    ["format", "Formato"],
    ["status", "Situação"],
    ["amount", "Valor"],
  ];

  return (
    <div className="table-scroll transactions-responsive">
      <div className="transaction-mobile-sort">
        <FieldSelect
          aria-label="Ordenar recorrências"
          value={sort.column}
          onValueChange={(column) => onSort(column as RecurringSortColumn)}
          options={columns.map(([value, label]) => ({ value, label }))}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={
            sort.direction === "asc"
              ? "Ordenar decrescente"
              : "Ordenar crescente"
          }
          onClick={() => onSort(sort.column)}
        >
          {sort.direction === "asc" ? (
            <ArrowUp size={16} />
          ) : (
            <ArrowDown size={16} />
          )}
        </button>
      </div>
      <table className="transactions-table">
        <thead>
          <tr>
            {columns.map(([column, label]) => {
              const active = sort.column === column;
              return (
                <th
                  key={column}
                  scope="col"
                  className={column === "amount" ? "right" : undefined}
                  aria-sort={
                    active
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="table-sort"
                    onClick={() => onSort(column)}
                    aria-label={`Ordenar por ${label.toLocaleLowerCase("pt-BR")}: ${active && sort.direction === "asc" ? "decrescente" : "crescente"}`}
                  >
                    {label}
                    {active &&
                      (sort.direction === "desc" ? (
                        <ArrowDown size={11} weight="bold" />
                      ) : (
                        <ArrowUp size={11} weight="bold" />
                      ))}
                  </button>
                </th>
              );
            })}
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const categoryName = row.category || "Sem categoria";
            const categoryImage = imageForCategory(
              categoryName,
              data.categories,
            );
            const categoryColor = colorForCategory(
              categoryName,
              0,
              data.categories,
            );
            const paid = row.status === "paid";
            return (
              <tr key={`${row.recurringId}-${row.date}`}>
                <td className="transaction-desc">
                  <button
                    type="button"
                    className="transaction-name"
                    onClick={() => onEdit(row.recurringId)}
                    title={row.description}
                  >
                    <TransactionAvatar
                      transaction={{
                        description: row.description,
                        category: row.category,
                      }}
                      categories={data.categories}
                    />
                    <span className="transaction-name-text">
                      <strong>{row.description}</strong>
                    </span>
                  </button>
                </td>
                <td
                  className="transaction-category-cell"
                  data-label="Categoria"
                >
                  <span className="transaction-category">
                    <span
                      className={`transaction-category-icon${categoryImage ? " has-image" : ""}`}
                      style={{
                        color: categoryColor,
                        background: `color-mix(in srgb, ${categoryColor} 16%, transparent)`,
                      }}
                    >
                      {categoryImage ? (
                        <CategoryImage name={categoryImage} size={28} />
                      ) : (
                        <FinanceIcon name="layers" size={15} />
                      )}
                    </span>
                    <strong>{categoryName}</strong>
                  </span>
                </td>
                <td
                  className="muted transaction-account-cell"
                  data-label="Conta"
                >
                  {accountLabel(data, row.accountId)}
                </td>
                <td className="table-date" data-label="Data">
                  {dateLabel(row.date, { year: true })}
                </td>
                <td className="muted" data-label="Formato">
                  {formatLabel(row)}
                </td>
                <td className="transaction-status-cell" data-label="Situação">
                  <StatusTag tone={paid ? "success" : "warning"}>
                    {paid ? "Pago" : "A pagar"}
                  </StatusTag>
                </td>
                <td className="right transaction-amount">
                  <Amount value={row.amount} prefix="− " />
                </td>
                <td className="transaction-actions-cell">
                  <button
                    type="button"
                    className="icon-button row-edit"
                    onClick={() => onEdit(row.recurringId)}
                    aria-label={`Editar ${row.description}`}
                  >
                    <PencilSimple size={14} />
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

export function RecurringView({
  data,
  month,
  category,
  openForm,
}: {
  data: FinanceData;
  month: string;
  category: string;
  openForm: (form: FormState) => void;
}) {
  const summary = useMemo(
    () => recurringCycle(data, month, "expense", category),
    [data, month, category],
  );
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RecurringSort>({
    column: "date",
    direction: "asc",
  });
  const items = [...summary.fixed, ...summary.installments];
  const visibleItems = items
    .filter(
      (row) =>
        (status === "all" || row.status === status) &&
        (type === "all" || row.type === type) &&
        `${row.description} ${row.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.trim().toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) => {
      const value = (row: RecurringInstance): string | number => {
        switch (sort.column) {
          case "description":
            return row.description;
          case "category":
            return row.category || "Sem categoria";
          case "account":
            return accountLabel(data, row.accountId);
          case "date":
            return row.date;
          case "format":
            return formatLabel(row);
          case "status":
            return row.status === "paid" ? "Pago" : "A pagar";
          case "amount":
            return row.amount;
        }
      };
      const left = value(a);
      const right = value(b);
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "pt-BR", {
              sensitivity: "base",
              numeric: true,
            });
      return (
        (sort.direction === "asc" ? comparison : -comparison) ||
        a.recurringId.localeCompare(b.recurringId) ||
        a.date.localeCompare(b.date)
      );
    });

  const editRecurring = (id: string) => {
    const row = data.recurrings.find((item) => item.id === id);
    if (!row) return;
    openForm({ resource: "recurrings", record: { ...row } });
  };

  const toggleSort = (column: RecurringSortColumn) => {
    setSort((current) => ({
      column,
      direction:
        current.column === column && current.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  return (
    <div className="recurring-page">
      <div className="summary-grid">
        <MiniStat
          label="A pagar no mês"
          value={summary.remaining}
          icon={Wallet}
          detail={`${summary.remainingCount} ${summary.remainingCount === 1 ? "pendente" : "pendentes"}`}
        />
        <MiniStat
          label="Pago no mês"
          value={summary.total - summary.remaining}
          icon={Check}
          detail={`${items.length - summary.remainingCount} ${items.length - summary.remainingCount === 1 ? "pago" : "pagos"}`}
        />
        <MiniStat
          label="Total do mês"
          value={summary.total}
          icon={CalendarDots}
          detail={`${summary.fixed.length} fixas · ${summary.installments.length} parcelas`}
        />
      </div>
      <div className="recurring-workspace">
        <div className="recurring-agenda">
          <FinanceSurface
            render={<section />}
            className="finance-card full-table recurring-list-card"
            header={
              <ShellHeader
                as="h2"
                icon={CalendarDots}
                title="Recorrências do mês"
                subtitle={`${visibleItems.length} ${visibleItems.length === 1 ? "item" : "itens"}`}
              />
            }
          >
            <div className="table-filters">
              <label className="search-field">
                <MagnifyingGlass size={17} />
                <input
                  aria-label="Buscar recorrência"
                  placeholder="Buscar descrição ou categoria"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search ? (
                  <button
                    type="button"
                    className="search-field-clear"
                    aria-label="Limpar busca"
                    onClick={() => setSearch("")}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </label>
              <FieldSelect
                aria-label="Status da recorrência"
                value={status}
                onValueChange={setStatus}
                options={[
                  { value: "all", label: "Todos os status" },
                  { value: "pending", label: "A pagar" },
                  { value: "paid", label: "Pagos" },
                ]}
              />
              <FieldSelect
                aria-label="Formato da recorrência"
                value={type}
                onValueChange={setType}
                options={[
                  { value: "all", label: "Fixas e parcelas" },
                  { value: "fixed", label: "Fixas" },
                  { value: "installment", label: "Parcelas" },
                ]}
              />
            </div>
            {visibleItems.length ? (
              <RecurringTable
                data={data}
                rows={visibleItems}
                sort={sort}
                onSort={toggleSort}
                onEdit={editRecurring}
              />
            ) : (
              <EmptyState
                icon={CalendarDots}
                title="Nenhuma recorrência encontrada"
                description="Ajuste os filtros ou cadastre uma nova recorrência."
                className="empty-state"
              />
            )}
          </FinanceSurface>
        </div>
        <aside className="recurring-sidebar">
          <FinanceSurface
            render={<section />}
            className="finance-card recurring-chart-card"
            header={
              <ShellHeader
                as="h2"
                icon={ChartLineUp}
                title="Projeção de 6 meses"
                aside={
                  <div className="recurring-legend">
                    <span>
                      <i className="is-installment" /> Parcelas
                    </span>
                    <span>
                      <i className="is-fixed" /> Contas fixas
                    </span>
                  </div>
                }
              />
            }
          >
            <div className="recurring-chart">
              <ChartCard
                embedded
                type="area"
                legend={false}
                height={220}
                title="Projeção de recorrências por mês"
                format={compactMoney}
                data={{
                  labels: summary.nextCycles.map((point) => point.label),
                  series: [
                    {
                      id: "installments",
                      label: "Parcelas",
                      values: summary.nextCycles.map(
                        (point) => point.installments,
                      ),
                      color: "var(--chart-2)",
                    },
                    {
                      id: "fixed",
                      label: "Contas fixas",
                      values: summary.nextCycles.map((point) => point.fixed),
                      color: "var(--chart-1)",
                    },
                  ],
                }}
              />
            </div>
          </FinanceSurface>

          <FinanceSurface
            render={<section />}
            className="finance-card recurring-panel recurring-totals-card"
            header={
              <ShellHeader as="h2" icon={Stack} title="Composição do mês" />
            }
          >
            <div className="recurring-panel-body">
              <div className="recurring-total-row">
                <span>Fixas</span>
                <Amount value={summary.fixedTotal} />
              </div>
              <div className="recurring-total-row">
                <span>Parcelas</span>
                <Amount value={summary.installmentTotal} />
              </div>
            </div>
          </FinanceSurface>

          <FinanceSurface
            render={<section />}
            className="finance-card recurring-panel"
            header={<ShellHeader as="h2" icon={Bank} title="Por conta" />}
          >
            <div className="recurring-panel-body">
              {!summary.byAccount.length ? (
                <EmptyState
                  icon={Bank}
                  title="Nenhuma conta neste mês"
                  compact
                  className="recurring-empty-state"
                />
              ) : (
                <div className="recurring-account-list">
                  {summary.byAccount.map((item) => (
                    <div
                      className="recurring-total-row"
                      key={item.accountId || "outros"}
                    >
                      <span>{item.name}</span>
                      <Amount value={item.amount} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FinanceSurface>
        </aside>
      </div>
    </div>
  );
}
