"use client";
import { useMemo, useState } from "react";
import { ChartCard } from "./ui/chart-card";
import { FieldSelect } from "./ui/field-select";
import {
  MagnifyingGlass,
  X,
  Wallet,
  Check,
  CalendarDots,
} from "@phosphor-icons/react";
import { Amount, MiniStat } from "./finance-views";
import { CategoryImage, FinanceIcon } from "./finance-icons";
import { MotionSegmentedControl } from "./finance-motion";
import { MerchantLogo, useMerchantLogoUrl } from "./merchant-logo";
import type { FormState } from "./finance-form";
import { recurringCycle, type RecurringInstance } from "@/lib/recurring";
import { colorForCategory, imageForCategory } from "@/lib/categorize";
import { compactMoney } from "@/lib/format";

import type { FinanceData, RecurringKind } from "@/lib/types";

function weekdayDateLabel(date: string) {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date.slice(0, 10)}T12:00:00`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function groupByDate(items: RecurringInstance[]) {
  const map = new Map<string, RecurringInstance[]>();
  for (const item of items) {
    const list = map.get(item.date);
    if (list) list.push(item);
    else map.set(item.date, [item]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function RecurringList({
  title,
  items,
  categories,
  onEdit,
}: {
  title: string;
  items: RecurringInstance[];
  categories: FinanceData["categories"];
  onEdit: (id: string) => void;
}) {
  const merchantLogoUrl = useMerchantLogoUrl();
  const groups = groupByDate(items);
  return (
    <section className="finance-card recurring-list-card">
      <div className="card-heading">
        <div>
          <h2>
            {title} ({items.length})
          </h2>
        </div>
      </div>
      {!items.length ? (
        <p className="muted recurring-empty">Nenhuma recorrência encontrada.</p>
      ) : (
        <div className="recurring-list">
          {groups.map(([date, rows]) => (
            <div key={date} className="recurring-day-group">
              <p className="recurring-day-label">{weekdayDateLabel(date)}</p>
              {rows.map((row) => {
                const image = imageForCategory(row.category, categories);
                const color = colorForCategory(row.category, 0, categories);
                const hasMerchantLogo = Boolean(
                  merchantLogoUrl(row.description),
                );
                return (
                  <button
                    key={`${row.recurringId}-${row.date}`}
                    type="button"
                    className="recurring-row"
                    onClick={() => onEdit(row.recurringId)}
                  >
                    <span
                      className={`recurring-icon${hasMerchantLogo || image ? " has-image" : ""}${hasMerchantLogo ? " has-merchant" : ""}`}
                      style={{
                        background: `color-mix(in srgb, ${color} 16%, transparent)`,
                        color,
                      }}
                    >
                      {hasMerchantLogo ? (
                        <MerchantLogo description={row.description} size={28} />
                      ) : image ? (
                        <CategoryImage name={image} size={28} />
                      ) : (
                        <FinanceIcon name="layers" size={16} />
                      )}
                    </span>
                    <span className="recurring-row-main">
                      <strong>{row.description}</strong>
                      <small>
                        {row.category} ·{" "}
                        {row.type === "installment" &&
                        row.installmentCurrent != null &&
                        row.installmentTotal != null
                          ? `Parcela ${row.installmentCurrent} de ${row.installmentTotal}`
                          : "Mensal"}
                      </small>
                    </span>
                    <span className="recurring-row-value">
                      <span className="recurring-amount-line">
                        <Amount value={row.amount} />
                      </span>
                      <small
                        className={`recurring-state ${row.status === "paid" ? "is-paid" : ""}`}
                      >
                        {row.status === "paid"
                          ? row.kind === "income"
                            ? "Recebido"
                            : "Pago"
                          : row.kind === "income"
                            ? "A receber"
                            : "A pagar"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
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
  const [kind, setKind] = useState<RecurringKind>("expense");
  const summary = useMemo(
    () => recurringCycle(data, month, kind, category),
    [data, month, kind, category],
  );
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const items = [...summary.fixed, ...summary.installments];
  const visibleItems = items.filter(
    (row) =>
      (status === "all" || row.status === status) &&
      (type === "all" || row.type === type) &&
      `${row.description} ${row.category}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );

  const editRecurring = (id: string) => {
    const row = data.recurrings.find((item) => item.id === id);
    if (!row) return;
    openForm({ resource: "recurrings", record: { ...row } });
  };

  return (
    <div className="recurring-page">
      <div className="section-top recurring-filters">
        <MotionSegmentedControl
          label="Tipo de recorrência"
          value={kind}
          onChange={(value) => setKind(value as RecurringKind)}
          options={[
            ["expense", "Despesas"],
            ["income", "Receitas"],
          ]}
        />
      </div>

      <div className="summary-grid">
        <MiniStat
          label={kind === "expense" ? "A pagar no mês" : "A receber no mês"}
          value={summary.remaining}
          icon={<Wallet />}
          color="amber"
          detail={`${summary.remainingCount} ${summary.remainingCount === 1 ? "pendente" : "pendentes"}`}
        />
        <MiniStat
          label={kind === "expense" ? "Pago no mês" : "Recebido no mês"}
          value={summary.total - summary.remaining}
          icon={<Check />}
          color="green"
          detail={`${items.length - summary.remainingCount} ${kind === "expense" ? "pagos" : "recebidos"}`}
        />
        <MiniStat
          label="Total do mês"
          value={summary.total}
          icon={<CalendarDots />}
          color="neutral"
          detail={`${summary.fixed.length} fixas · ${summary.installments.length} parcelas`}
        />
      </div>
      <div className="recurring-workspace">
        <div className="recurring-agenda">
          <div className="recurring-toolbar">
            <label className="search-field">
              <MagnifyingGlass size={17} />
              <input
                aria-label="Buscar recorrência"
                placeholder="Buscar recorrência"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="search-field-clear"
                  aria-label="Limpar busca"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <FieldSelect
              aria-label="Status da recorrência"
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "Todos os status" },
                {
                  value: "pending",
                  label: kind === "expense" ? "A pagar" : "A receber",
                },
                {
                  value: "paid",
                  label: kind === "expense" ? "Pagos" : "Recebidos",
                },
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
          <RecurringList
            title="Recorrências do mês"
            items={visibleItems}
            categories={data.categories}
            onEdit={editRecurring}
          />
        </div>
        <aside className="recurring-sidebar">
          <section className="finance-card recurring-chart-card">
            <div className="card-heading">
              <div>
                <h2>Projeção de 6 meses</h2>
              </div>
              <div className="recurring-legend">
                <span>
                  <i className="is-installment" /> Parcelas
                </span>
                <span>
                  <i className="is-fixed" /> Contas fixas
                </span>
              </div>
            </div>
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
          </section>

          <section className="finance-card recurring-panel recurring-totals-card">
            <h2 className="recurring-support-title">Composição do mês</h2>
            <div className="recurring-total-row">
              <span>Fixas</span>
              <Amount value={summary.fixedTotal} />
            </div>
            <div className="recurring-total-row">
              <span>Parcelas</span>
              <Amount value={summary.installmentTotal} />
            </div>
          </section>
          <section className="finance-card recurring-panel">
            <h2 className="recurring-support-title">Por conta</h2>
            {!summary.byAccount.length ? (
              <p className="muted recurring-empty">Nenhuma conta neste mês.</p>
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
          </section>
        </aside>
      </div>
    </div>
  );
}
