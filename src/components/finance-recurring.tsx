"use client";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Amount } from "./finance-views";
import { CategoryImage, FinanceIcon } from "./finance-icons";
import { MotionSegmentedControl } from "./finance-motion";
import { MerchantLogo } from "./merchant-logo";
import type { FormState } from "./finance-form";
import {
  recurringCycle,
  type RecurringInstance,
} from "@/lib/recurring";
import { colorForCategory, imageForCategory } from "@/lib/categorize";
import { compactMoney } from "@/lib/format";
import { merchantLogoUrl } from "@/lib/merchants";
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
  onEdit,
}: {
  title: string;
  items: RecurringInstance[];
  onEdit: (id: string) => void;
}) {
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
        <p className="muted recurring-empty">Nenhuma cobrança neste ciclo.</p>
      ) : (
        <div className="recurring-list">
          {groups.map(([date, rows]) => (
            <div key={date} className="recurring-day-group">
              <p className="recurring-day-label">{weekdayDateLabel(date)}</p>
              {rows.map((row) => {
                const image = imageForCategory(row.category);
                const color = colorForCategory(row.category);
                const hasMerchantLogo = Boolean(merchantLogoUrl(row.description));
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
                    <small>{row.category}</small>
                  </span>
                  <span className="recurring-row-value">
                    <span className="recurring-amount-line">
                      <span
                        className={`recurring-status ${row.status === "paid" ? "is-paid" : "is-pending"}`}
                        aria-label={
                          row.status === "paid" ? "Pago" : "Pendente"
                        }
                      />
                      <Amount value={row.amount} />
                    </span>
                    <small>
                      {row.type === "installment" &&
                      row.installmentCurrent != null &&
                      row.installmentTotal != null
                        ? `${row.installmentCurrent}/${row.installmentTotal}`
                        : "Mensal"}
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
  const insight =
    kind === "expense"
      ? summary.remainingCount === 0
        ? "Nenhuma cobrança pendente neste ciclo."
        : summary.remainingCount === 1
          ? "Ainda falta uma cobrança neste ciclo."
          : `Ainda faltam ${summary.remainingCount} cobranças neste ciclo.`
      : summary.remainingCount === 0
        ? "Todas as receitas previstas já entraram."
        : summary.remainingCount === 1
          ? "Ainda falta uma receita neste ciclo."
          : `Ainda faltam ${summary.remainingCount} receitas neste ciclo.`;

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

      <div className="recurring-layout">
        <aside className="recurring-sidebar">
          <section className="finance-card recurring-panel recurring-remaining-card">
            <p className="muted">
              {kind === "expense"
                ? "Falta pagar neste ciclo"
                : "Falta receber neste ciclo"}
            </p>
            <Amount value={summary.remaining} motion="reel" className="recurring-remaining-value" />
            <div className="recurring-insight">
              <p>{insight}</p>
            </div>
          </section>

          <section className="finance-card recurring-panel recurring-totals-card">
            <div className="recurring-total-row">
              <span>Parcelas</span>
              <Amount value={summary.installmentTotal} />
            </div>
            <div className="recurring-total-row">
              <span>Contas fixas</span>
              <Amount value={summary.fixedTotal} />
            </div>
            <div className="recurring-total-row is-strong">
              <span>Total</span>
              <Amount value={summary.total} />
            </div>
          </section>

          <section className="finance-card recurring-panel">
            <p className="muted">Saldo previsto</p>
            <Amount
              value={summary.forecast}
              className={
                summary.forecast >= 0
                  ? "recurring-forecast-positive"
                  : "recurring-forecast-negative"
              }
              motion="reel"
            />
            {summary.forecastDeltaPct != null && (
              <p className="muted recurring-delta">
                {summary.forecastDeltaPct >= 0 ? "+" : ""}
                {summary.forecastDeltaPct.toFixed(1)}% vs ciclo anterior
              </p>
            )}
          </section>

          <section className="finance-card recurring-panel">
            <p className="muted">
              {kind === "expense" ? "Gasto por conta" : "Receita por conta"}
            </p>
            {!summary.byAccount.length ? (
              <p className="muted recurring-empty">Sem distribuição.</p>
            ) : (
              <div className="recurring-account-list">
                {summary.byAccount.map((item) => (
                  <div key={item.accountId || "outros"} className="recurring-account-row">
                    <div className="recurring-account-meta">
                      <span
                        className="recurring-account-dot"
                        style={{ background: item.color }}
                      />
                      <span>{item.name}</span>
                      <small>
                        {compactMoney(item.amount)} ·{" "}
                        {(item.share * 100).toFixed(1)}%
                      </small>
                    </div>
                    <div className="recurring-account-track">
                      <span
                        style={{
                          width: `${Math.max(item.share * 100, 2)}%`,
                          background: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <div className="recurring-main">
          <section className="finance-card recurring-chart-card">
            <div className="card-heading">
              <div>
                <h2>Próximos 6 ciclos</h2>
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
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summary.nextCycles} barCategoryGap="28%">
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0]?.payload as {
                        label: string;
                        fixed: number;
                        installments: number;
                        total: number;
                      };
                      return (
                        <div className="recurring-tooltip">
                          <strong>{point.label}</strong>
                          <p>Parcelas: {compactMoney(point.installments)}</p>
                          <p>Contas fixas: {compactMoney(point.fixed)}</p>
                          <p>Total: {compactMoney(point.total)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="installments"
                    stackId="cycle"
                    fill="var(--warning)"
                    radius={[0, 0, 0, 0]}
                    fillOpacity={0.85}
                  />
                  <Bar
                    dataKey="fixed"
                    stackId="cycle"
                    fill="var(--foreground)"
                    radius={[4, 4, 0, 0]}
                    fillOpacity={0.9}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="recurring-lists">
            <RecurringList
              title="Contas fixas"
              items={summary.fixed}
              onEdit={editRecurring}
            />
            <RecurringList
              title="Parcelas"
              items={summary.installments}
              onEdit={editRecurring}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
