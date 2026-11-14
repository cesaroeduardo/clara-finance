"use client";
import { Switch, SwitchThumb } from "@/components/ui/switch";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { ShellHeader } from "@/components/ui/surface";
import { FinanceSurface } from "@/components/ui/finance-surface";
import { StatCard } from "@/components/ui/stat-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { GoalContextMenu } from "./goal-context-menu";
import { GoalDescription } from "./goal-description";
import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowSquareOut,
  ArrowUp,
  ArrowUpRight,
  ArrowsClockwise,
  Bank,
  CalendarDots,
  CaretLeft,
  CaretRight,
  Check,
  CreditCard,
  ChartPieSlice,
  DownloadSimple,
  Info,
  MagnifyingGlass,
  PencilSimple,
  Plant,
  Plus,
  ShieldCheck,
  Wallet,
  X,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CategoryMark, categoryFieldOptions } from "@/components/category-mark";
import {
  CategoryRulesTable,
  type CategoryViewState,
} from "./category-rules-editor";
import { FieldSelect } from "@/components/ui/field-select";
import { CategoryImage, FinanceIcon, Illustration } from "./finance-icons";
import { InstitutionLogo } from "./institution-logo";
import { TransactionAvatar } from "./transaction-avatar";
import { MerchantLogo, useMerchantLogoUrl } from "./merchant-logo";
import { MarketTickers } from "./market-tickers";
import { PrivacyContext, PrivateValue } from "./finance-privacy";
import {
  AnimatedLabel,
  LinkChevron,
  MotionSegmentedControl,
  SpinningAmount,
} from "./finance-motion";
import type { FormState, Mutate } from "./finance-form";
import type {
  Account,
  Category,
  FinanceData,
  Goal,
  Transaction,
} from "@/lib/types";
import type { View } from "./finance-app";
import {
  cardInvoiceAmount,
  filterTransactions,
  inPeriod,
  investmentBucket,
  investmentsOverview,
  matchesCategoryFilter,
  netWorth,
  periodDateBounds,
  planForMonth,
  spendingPace,
  summarize,
  summarizePeriod,
  type AppPeriod,
} from "@/lib/analytics";
import type { MarketQuote } from "@/lib/market";
import { extractEquityTickers } from "@/lib/market";
import {
  accountChannelLabel,
  displayInstitution,
  formatAccountLabel,
} from "@/lib/accounts";
import { colorForCategory, imageForCategory } from "@/lib/categorize";

import {
  compactMoney,
  dateLabel,
  localDate,
  money,
  monthLabel,
} from "@/lib/format";
import { AnimatePresence, m, useReducedMotion } from "motion/react";

function shiftMonthKey(month: string, delta: number) {
  const date = new Date(`${month}-15T12:00:00`);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(`${month}-15T12:00:00`))
    .replace(".", "");
}

function donutPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function donutSlicePath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  startPct: number,
  endPct: number,
) {
  const start = startPct * 3.6;
  const end = Math.min(endPct * 3.6, start + 359.999);
  const large = end - start > 180 ? 1 : 0;
  const a = donutPoint(cx, cy, outer, start);
  const b = donutPoint(cx, cy, outer, end);
  const c = donutPoint(cx, cy, inner, end);
  const d = donutPoint(cx, cy, inner, start);
  return [
    `M ${a.x} ${a.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y}`,
    "Z",
  ].join(" ");
}

type TransactionFilters = {
  category?: string;
  type?: string;
};

type Props = {
  data: FinanceData;
  month: string;
  period: AppPeriod;
  category: string;
  setCategory: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  txType: string;
  setTxType: (value: string) => void;
  openForm: (form: FormState) => void;
  mutate: Mutate;
  navigate: (view: View) => void;
  openTransactions: (filters?: TransactionFilters) => void;
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
  motion = "none",
}: {
  value: number;
  currency?: string;
  className?: string;
  prefix?: string;
  motion?: "none" | "reel";
}) {
  const hidden = useContext(PrivacyContext);
  if (hidden)
    return <span className={`amount ${className}`.trim()}>••••••</span>;
  if (motion === "reel") {
    return (
      <SpinningAmount
        value={value}
        currency={currency}
        prefix={prefix}
        className={className}
      />
    );
  }
  return (
    <span className={`amount ${className}`.trim()}>
      {prefix + money(value, currency)}
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
function StatusGlyph({ tone }: { tone: "success" | "warning" | "muted" }) {
  if (tone === "muted") {
    return (
      <svg className="status-glyph" viewBox="0 0 16 16" aria-hidden>
        <circle
          cx="8"
          cy="8"
          r="6.25"
          fill="none"
          stroke="currentColor"
          strokeDasharray="2.2 2.1"
          strokeWidth="1.25"
        />
      </svg>
    );
  }
  return (
    <svg className="status-glyph" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path
        d="M4 9.4 6.3 7.1 8.1 8.7 12 4.7"
        fill="none"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusTag({
  tone,
  children,
}: {
  tone: "success" | "warning" | "muted";
  children: React.ReactNode;
}) {
  const className =
    tone === "success"
      ? "status-pill paid"
      : tone === "muted"
        ? "status-pill muted"
        : "status-pill";
  return (
    <StatusPill
      size="sm"
      tone={
        tone === "success"
          ? "positive"
          : tone === "warning"
            ? "warning"
            : "neutral"
      }
      className={className}
    >
      <StatusGlyph tone={tone} />
      {children}
    </StatusPill>
  );
}

function GrowthTag({
  value,
  children,
}: {
  value: number;
  children: React.ReactNode;
}) {
  const down = value < 0;
  return (
    <StatusPill
      size="sm"
      tone={down ? "negative" : "positive"}
      className={`home-growth-badge${down ? " negative" : ""}`}
    >
      <i className="home-growth-glyph" aria-hidden="true">
        {down ? (
          <ArrowDown size={10} weight="bold" />
        ) : (
          <ArrowUp size={10} weight="bold" />
        )}
      </i>
      {children}
    </StatusPill>
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
    <EmptyState
      icon={Plant}
      title={title}
      description={description}
      className="empty-state"
    >
      {action}
    </EmptyState>
  );
}
export function DashboardView(props: Props) {
  const {
    data,
    month,
    period,
    category,
    setCategory,
    openForm,
    navigate,
    openTransactions,
  } = props;
  const plan = planForMonth(data, month);
  const scoped = { ...data, plan };
  // Totais e distribuição: intervalo do período. Ritmo/plano: mês âncora.
  const stats = summarizePeriod(scoped, period, "all");
  const pace = spendingPace(scoped, month, "all");
  const hidden = useContext(PrivacyContext);
  const reducedMotion = useReducedMotion();
  const [insightIndex, setInsightIndex] = useState(0);
  const [insightDir, setInsightDir] = useState(1);
  const confirmedIncome = stats.records
    .filter((row) => row.status === "paid" && row.kind === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const confirmedExpenses = stats.paid;
  const confirmedResult = confirmedIncome - confirmedExpenses;
  const previousMonthKey = shiftMonthKey(month, -1);
  const previousStats = summarize(scoped, previousMonthKey, "all");
  const previousIncome = previousStats.records
    .filter((row) => row.status === "paid" && row.kind === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const previousResult = previousIncome - previousStats.paid;
  const resultDelta = confirmedResult - previousResult;
  const resultDeltaPercent =
    previousResult === 0
      ? confirmedResult === 0
        ? 0
        : null
      : (resultDelta / Math.abs(previousResult)) * 100;
  const bills = pendingBills(scoped, period, "all");
  const wealth = netWorth(scoped);
  const wealthFlow = wealth.series.map((point) => ({
    month: point.month,
    value: point.value / 100,
  }));
  const openPlan = () =>
    openForm({
      resource: "plan",
      month,
      record: record({ ...plan, month }),
    });
  const currentMonth = localDate().slice(0, 7);
  const isPastMonth = month < currentMonth;
  const insightKey = `${month}:${isPastMonth}`;
  const [insightPeriod, setInsightPeriod] = useState(insightKey);
  if (insightPeriod !== insightKey) {
    setInsightPeriod(insightKey);
    setInsightIndex(0);
  }
  const monthResult = stats.balance;
  const monthPositive = monthResult >= 0;
  const canStillSpend = pace.remaining >= 0;
  const paceStroke = canStillSpend ? "var(--success)" : "var(--destructive)";
  const paceFill = paceStroke;
  const resultStroke = monthPositive ? "var(--success)" : "var(--destructive)";
  const forecastGlowTone = isPastMonth
    ? monthPositive
      ? "positive"
      : "negative"
    : pace.empty
      ? null
      : canStillSpend
        ? "positive"
        : "negative";
  const todayPoint = pace.series.find((point) => point.day === pace.todayDay);
  const resultFlow = stats.flow.map((point) => ({
    day: point.day,
    result: point.income - point.expenses,
  }));
  const shiftDelta = pace.categoryShift?.delta;
  const shiftCategory = pace.categoryShift?.category;
  const shiftInsight =
    shiftDelta == null || shiftCategory == null
      ? {
          id: "shift",
          title: "Mudança nos gastos",
          body: <>Sem variação relevante por categoria no período.</>,
        }
      : {
          id: "shift",
          title: "Mudança nos gastos",
          body: (
            <>
              Você gastou{" "}
              <strong>
                <Amount value={Math.abs(shiftDelta)} motion="reel" />{" "}
                {shiftDelta >= 0 ? "a mais" : "a menos"}
              </strong>{" "}
              em {shiftCategory} este mês vs. o mesmo período do mês passado.
            </>
          ),
        };
  const insights = isPastMonth
    ? [
        {
          id: "result",
          title: "Resultado do mês",
          body: (
            <>
              O mês fechou{" "}
              <strong>
                {monthPositive ? "positivo" : "negativo"} em{" "}
                <Amount value={Math.abs(monthResult)} motion="reel" />
              </strong>
              . Entradas <Amount value={stats.income} /> · saídas{" "}
              <Amount value={stats.expenses} />.
            </>
          ),
        },
        shiftInsight,
        {
          id: "limit",
          title: "Uso do teto",
          body:
            pace.monthlyLimit > 0 ? (
              <>
                Você usou{" "}
                <strong>
                  <AnimatedLabel value={`${pace.limitUsedPercent}%`} />
                </strong>{" "}
                do teto de <Amount value={pace.monthlyLimit} />.
              </>
            ) : (
              <>Sem teto definido para esse mês.</>
            ),
        },
      ]
    : [
        {
          id: "pace",
          title: "Ritmo de gastos",
          body: (
            <>
              Você usou{" "}
              <strong>
                <AnimatedLabel value={`${pace.limitUsedPercent}%`} />
              </strong>{" "}
              do limite. No ritmo atual, pode gastar até{" "}
              <strong>
                <Amount value={pace.dailyAllowance} motion="reel" />
              </strong>{" "}
              por dia até o fim do mês.
            </>
          ),
        },
        shiftInsight,
        {
          id: "projection",
          title: "Renda e sobra",
          body:
            pace.forecastIncome > 0 ? (
              <>
                Renda prevista do CNPJ <Amount value={pace.forecastIncome} />
                {pace.salaryReceived + pace.freelanceReceived > 0 ? (
                  <>
                    {" "}
                    (já entrou{" "}
                    <Amount
                      value={pace.salaryReceived + pace.freelanceReceived}
                    />
                    )
                  </>
                ) : null}
                . Depois do gasto e da meta de guardar, o mês tende a fechar{" "}
                <strong>
                  {pace.forecastResult >= 0 ? "positivo" : "negativo"} em{" "}
                  <Amount value={Math.abs(pace.forecastResult)} motion="reel" />
                </strong>
                .
              </>
            ) : (
              <>
                Defina salário e freelas no planejamento para fechar a previsão
                com a renda do CNPJ.
              </>
            ),
        },
      ];
  const activeInsight = insights[insightIndex] ?? insights[0];
  const showPrevInsight = () => {
    setInsightDir(-1);
    setInsightIndex((index) => (index + insights.length - 1) % insights.length);
  };
  const showNextInsight = () => {
    setInsightDir(1);
    setInsightIndex((index) => (index + 1) % insights.length);
  };
  useEffect(() => {
    const blocked = isPastMonth ? false : pace.empty;
    if (blocked || insights.length < 2) return;
    const timer = window.setInterval(() => {
      setInsightDir(1);
      setInsightIndex((index) => (index + 1) % insights.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [pace.empty, insights.length, insightIndex, isPastMonth]);
  const insightSlide = {
    enter: (direction: number) => ({
      opacity: 0,
      x: reducedMotion ? 0 : direction * 14,
      filter: reducedMotion ? "blur(0px)" : "blur(3px)",
    }),
    center: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
    },
    exit: (direction: number) => ({
      opacity: 0,
      x: reducedMotion ? 0 : direction * -10,
      filter: reducedMotion ? "blur(0px)" : "blur(2px)",
    }),
  };

  return (
    <div className="home-grid">
      <div className="home-top-stack">
        <FinanceSurface
          render={<section />}
          className={`finance-card home-forecast${forecastGlowTone ? ` is-${forecastGlowTone}` : ""}`}
          header={
            <ShellHeader
              as="h2"
              icon={Wallet}
              title={
                <>
                  {" "}
                  {isPastMonth
                    ? "Resultado do mês"
                    : "Você ainda pode gastar"}{" "}
                </>
              }
              aside={
                <>
                  {" "}
                  <div className="home-pace-heading-actions">
                    <span
                      title={
                        isPastMonth
                          ? "Entradas menos saídas do mês selecionado."
                          : "Limite = renda do CNPJ (previsto ou já entrada) − guardar. Ritmo = despesas pagas no banco + fatura aberta do cartão. Reserva de alimentação só reduz o que ainda pode gastar, sem contar como gasto."
                      }
                    >
                      <Info
                        size={14}
                        aria-label={
                          isPastMonth
                            ? "Cálculo do resultado do mês"
                            : "Cálculo do quanto ainda pode gastar"
                        }
                      />
                    </span>
                    {!isPastMonth && (
                      <button
                        type="button"
                        className="home-pace-edit"
                        aria-label="Editar planejamento"
                        onClick={openPlan}
                      >
                        <PencilSimple size={14} />
                      </button>
                    )}
                  </div>{" "}
                </>
              }
            />
          }
        >
          {forecastGlowTone && (
            <div className="home-forecast-glow" aria-hidden="true">
              <span className="home-forecast-glow-blob home-forecast-glow-top" />
              <span className="home-forecast-glow-blob home-forecast-glow-right" />
            </div>
          )}
          <div className="home-forecast-body">
            {!isPastMonth && pace.empty ? (
              <div className="home-pace-empty">
                <p>
                  Defina a renda prevista (ou o teto fallback) no planejamento.
                </p>
                <Button type="button" size="sm" onClick={openPlan}>
                  Planejamento
                </Button>
              </div>
            ) : isPastMonth ? (
              <>
                <div className="home-amount home-forecast-amount home-pace-amount">
                  <Amount value={monthResult} motion="reel" />
                </div>
                <div
                  className="home-chart home-pace-chart"
                  role="img"
                  aria-label="Resultado acumulado do mês"
                >
                  <span
                    className={`home-pace-pill ${monthPositive ? "" : "over"}`.trim()}
                  >
                    {monthPositive ? "Positivo" : "Negativo"}
                  </span>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <ComposedChart
                      data={resultFlow}
                      accessibilityLayer={!hidden}
                      margin={{ top: 28, right: 0, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="home-result-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={resultStroke}
                            stopOpacity={0.18}
                          />
                          <stop
                            offset="100%"
                            stopColor={resultStroke}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="day"
                        hide
                        domain={[1, resultFlow.length]}
                      />
                      <YAxis hide domain={["auto", "auto"]} />
                      <ReferenceLine
                        y={0}
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      {!hidden && (
                        <Tooltip
                          formatter={(value) => {
                            if (value == null) return [null, ""];
                            return [money(Number(value) * 100), "Resultado"];
                          }}
                          labelFormatter={(day) => `Dia ${day}`}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            fontSize: 11,
                            background: "var(--popover)",
                            color: "var(--foreground)",
                          }}
                        />
                      )}
                      <Area
                        dataKey="result"
                        type="monotone"
                        stroke="none"
                        fill="url(#home-result-fill)"
                        isAnimationActive={!hidden && !reducedMotion}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <Line
                        dataKey="result"
                        type="monotone"
                        stroke={resultStroke}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={!hidden && !reducedMotion}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      {resultFlow.length > 0 && (
                        <ReferenceDot
                          x={resultFlow.at(-1)!.day}
                          y={resultFlow.at(-1)!.result}
                          r={4}
                          fill={resultStroke}
                          stroke="var(--card)"
                          strokeWidth={2}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="home-chart-dates">
                  <span>01</span>
                  <span>{String(resultFlow.length).padStart(2, "0")}</span>
                </div>
              </>
            ) : (
              <>
                <div className="home-amount home-forecast-amount home-pace-amount">
                  <Amount value={pace.remaining} motion="reel" />
                  <span className="home-pace-limit">
                    / <Amount value={pace.monthlyLimit} />
                  </span>
                </div>
                <div
                  className="home-chart home-pace-chart"
                  role="img"
                  aria-label="Ritmo ideal e gasto acumulado do mês"
                >
                  <span
                    className={`home-pace-pill ${canStillSpend ? "" : "over"}`.trim()}
                  >
                    <Amount value={pace.dailyAllowance} motion="reel" />
                    /dia
                  </span>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <ComposedChart
                      data={pace.series}
                      accessibilityLayer={!hidden}
                      margin={{ top: 28, right: 0, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="home-pace-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={paceFill}
                            stopOpacity={0.18}
                          />
                          <stop
                            offset="100%"
                            stopColor={paceFill}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="day"
                        hide
                        domain={[1, pace.daysInMonth]}
                      />
                      <YAxis hide domain={[0, "auto"]} />
                      {!hidden && (
                        <Tooltip
                          formatter={(value, name) => {
                            if (value == null) return [null, ""];
                            const label =
                              name === "ideal" ? "Ritmo ideal" : "Gasto";
                            return [money(Number(value) * 100), label];
                          }}
                          labelFormatter={(day) => `Dia ${day}`}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            fontSize: 11,
                            background: "var(--popover)",
                            color: "var(--foreground)",
                          }}
                        />
                      )}
                      <Area
                        dataKey="actual"
                        type="monotone"
                        stroke="none"
                        fill="url(#home-pace-fill)"
                        connectNulls={false}
                        isAnimationActive={!hidden && !reducedMotion}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <Line
                        dataKey="ideal"
                        type="linear"
                        stroke="var(--chart-2)"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={!hidden && !reducedMotion}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <Line
                        dataKey="actual"
                        type="monotone"
                        stroke={paceStroke}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={!hidden && !reducedMotion}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      {todayPoint?.actual != null && (
                        <ReferenceDot
                          x={todayPoint.day}
                          y={todayPoint.actual}
                          r={4}
                          fill={paceStroke}
                          stroke="var(--card)"
                          strokeWidth={2}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="home-chart-dates">
                  <span>01</span>
                  <span>{String(pace.daysInMonth).padStart(2, "0")}</span>
                </div>
              </>
            )}
          </div>
          <div className="home-forecast-footer home-pace-insights">
            <div className="home-pace-insight-head">
              <span className="home-pace-insight-title">
                <AnimatePresence
                  mode="wait"
                  initial={false}
                  custom={insightDir}
                >
                  <m.span
                    key={
                      !isPastMonth && pace.empty ? "empty" : activeInsight.id
                    }
                    className="home-pace-insight-title-value"
                    custom={insightDir}
                    variants={insightSlide}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reducedMotion ? 0 : 0.22,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    {!isPastMonth && pace.empty
                      ? "Ritmo de gastos"
                      : activeInsight.title}
                  </m.span>
                </AnimatePresence>
              </span>
            </div>
            <div className="home-pace-insight-body" aria-live="polite">
              <AnimatePresence mode="wait" initial={false} custom={insightDir}>
                <m.p
                  key={!isPastMonth && pace.empty ? "empty" : activeInsight.id}
                  className="home-pace-insight-copy"
                  custom={insightDir}
                  variants={insightSlide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    duration: reducedMotion ? 0 : 0.24,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {!isPastMonth && pace.empty ? (
                    <>
                      Defina salário/freelas no planejamento para ver o ritmo.
                    </>
                  ) : (
                    activeInsight.body
                  )}
                </m.p>
              </AnimatePresence>
            </div>
            <div className="home-pace-insight-nav">
              <button
                type="button"
                aria-label="Insight anterior"
                onClick={showPrevInsight}
                disabled={!isPastMonth && pace.empty}
              >
                <CaretLeft size={14} />
              </button>
              <div className="home-pace-insight-dots" aria-hidden="true">
                {insights.map((insight, index) => (
                  <button
                    key={insight.id}
                    type="button"
                    className="home-pace-insight-dot"
                    aria-label={`Ver ${insight.title}`}
                    aria-current={index === insightIndex}
                    disabled={!isPastMonth && pace.empty}
                    onClick={() => {
                      setInsightDir(index > insightIndex ? 1 : -1);
                      setInsightIndex(index);
                    }}
                  >
                    {index === insightIndex && (
                      <m.span
                        layoutId="pace-insight-dot"
                        className="home-pace-insight-dot-active"
                        transition={{
                          duration: reducedMotion ? 0 : 0.25,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Próximo insight"
                onClick={showNextInsight}
                disabled={!isPastMonth && pace.empty}
              >
                <CaretRight size={14} />
              </button>
            </div>
          </div>
        </FinanceSurface>
        <button
          className="finance-card home-bills-summary"
          aria-label="Ver contas a pagar"
          onClick={() => openTransactions({ type: "expense" })}
        >
          <span className="home-summary-symbol">
            <CalendarDots size={18} />
          </span>
          <span className="home-summary-copy">
            <strong>
              {bills.length}{" "}
              {bills.length === 1 ? "conta a pagar" : "contas a pagar"}
            </strong>
            <span>
              <Amount
                value={bills.reduce((sum, row) => sum + row.amount, 0)}
                motion="reel"
              />
              {bills[0] && <span> · {dateLabel(bills[0].date)}</span>}
            </span>
          </span>
          <CaretRight size={17} />
        </button>
      </div>

      <SpendingDistribution
        data={data}
        period={period}
        category={category}
        setCategory={setCategory}
      />

      <div className="home-left-stack">
        <FinanceSurface
          render={<section />}
          className="finance-card home-result"
          header={
            <ShellHeader
              as="h2"
              icon={ArrowUpRight}
              title={
                <>
                  {" "}
                  {isPastMonth
                    ? "Resultado do mês"
                    : "Resultado até agora"}{" "}
                </>
              }
              aside={
                <>
                  {" "}
                  <DashboardLink
                    label="Ver lançamentos"
                    onClick={() => openTransactions()}
                  />{" "}
                </>
              }
            />
          }
        >
          <div className="home-value-line">
            <strong className="home-amount">
              <Amount value={confirmedResult} motion="reel" />
            </strong>
            {resultDeltaPercent != null && (
              <GrowthTag value={resultDelta}>
                <PrivateValue as="span" className="amount">
                  {`${Math.abs(resultDeltaPercent).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`}
                </PrivateValue>
              </GrowthTag>
            )}
          </div>
          <p className="home-result-compare">
            vs <Amount value={previousResult} /> mês anterior
          </p>
          <div className="home-result-metrics">
            <div>
              <span>
                <ArrowDownLeft size={13} className="positive" />
                Receita
              </span>
              <strong>
                <Amount value={confirmedIncome} motion="reel" />
              </strong>
            </div>
            <div>
              <span>
                <ArrowUpRight size={13} className="negative" />
                Gasto
              </span>
              <strong>
                <Amount value={confirmedExpenses} motion="reel" />
              </strong>
            </div>
          </div>
        </FinanceSurface>

        <MarketTickers data={data} />
      </div>

      <div className="home-middle-stack">
        <HomeInvestmentsCard
          data={data}
          month={month}
          navigate={navigate}
          openForm={openForm}
        />
        <FinanceSurface
          render={<section />}
          className="finance-card home-wealth"
          header={
            <ShellHeader
              as="h2"
              icon={Wallet}
              title="Patrimônio"
              aside={
                <>
                  {" "}
                  <DashboardLink
                    label="Ver contas"
                    onClick={() => navigate("accounts")}
                  />{" "}
                </>
              }
            />
          }
        >
          {wealth.empty ? (
            <div className="home-empty">
              <Wallet size={24} />
              <span>Nenhuma conta ou investimento</span>
              <Button variant="outline" onClick={() => navigate("accounts")}>
                Ver contas
              </Button>
            </div>
          ) : (
            <>
              <div className="home-value-line">
                <strong className="home-amount">
                  <Amount value={wealth.current} motion="reel" />
                </strong>
                {wealth.change !== 0 && (
                  <GrowthTag value={wealth.change}>
                    <PrivateValue as="span" className="amount">
                      {compactMoney(Math.abs(wealth.change))}
                    </PrivateValue>
                  </GrowthTag>
                )}
              </div>
              <div
                className="home-wealth-chart"
                role="img"
                aria-label="Evolução do patrimônio nos últimos meses"
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart
                    data={wealthFlow}
                    accessibilityLayer={!hidden}
                    margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="home-wealth-gradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--success)"
                          stopOpacity={0.18}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--success)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                    {!hidden && (
                      <Tooltip
                        formatter={(value) => [
                          money(Number(value) * 100),
                          "Patrimônio",
                        ]}
                        labelFormatter={(label) => monthLabel(String(label))}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          fontSize: 11,
                          background: "var(--popover)",
                          color: "var(--foreground)",
                        }}
                      />
                    )}
                    <Area
                      dataKey="value"
                      type="monotone"
                      isAnimationActive={false}
                      stroke="var(--success)"
                      strokeWidth={2}
                      fill="url(#home-wealth-gradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="home-card-footer">
                <span>
                  {wealth.change > 0 ? (
                    <>
                      Seu patrimônio cresceu{" "}
                      <strong>
                        <Amount value={Math.abs(wealth.change)} />
                      </strong>{" "}
                      neste mês.
                    </>
                  ) : wealth.change < 0 ? (
                    <>
                      Seu patrimônio caiu{" "}
                      <strong>
                        <Amount value={Math.abs(wealth.change)} />
                      </strong>{" "}
                      neste mês.
                    </>
                  ) : (
                    "Seu patrimônio ficou estável neste mês."
                  )}
                </span>
              </div>
            </>
          )}
        </FinanceSurface>
      </div>

      <div className="home-right-stack">
        <CreditCardsCard
          data={data}
          month={month}
          category={category}
          navigate={navigate}
        />
      </div>
    </div>
  );
}

function DashboardLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="icon-button home-open"
      aria-label={label}
      onClick={onClick}
    >
      <ArrowUpRight size={16} />
    </button>
  );
}

function pendingBills(data: FinanceData, period: AppPeriod, category: string) {
  const bounds = periodDateBounds(period);
  return data.transactions
    .filter(
      (row) =>
        row.kind === "expense" &&
        row.status === "pending" &&
        row.source !== "pluggy" &&
        row.currency === "BRL" &&
        inPeriod(row.date, bounds) &&
        matchesCategoryFilter(row.category, category),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

function SpendingDistribution({
  data,
  period,
  category,
  setCategory,
}: Pick<Props, "data" | "period" | "category" | "setCategory">) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const stats = summarizePeriod(data, period, "all");
  const categories = new Map<
    string,
    {
      id: string;
      name: string;
      spent: number;
      color: string;
      icon: string;
      image: string | null;
      budget: number;
    }
  >();
  for (const row of stats.records.filter((row) => row.kind === "expense")) {
    const name = row.category || "Sem categoria";
    const entry = categories.get(name);
    if (entry) entry.spent += row.amount;
    else {
      categories.set(name, {
        id: name,
        name,
        spent: row.amount,
        color: colorForCategory(name, categories.size, data.categories),
        icon: "layers",
        image: imageForCategory(name, data.categories),
        budget: 0,
      });
    }
  }
  const visible = [...categories.values()].filter(
    (item) => item.spent > 0 || item.budget > 0,
  );
  const uncategorized = visible.find(
    (item) => item.name === "Sem categoria" || item.id === "Sem categoria",
  );
  const named = visible
    .filter(
      (item) => item.name !== "Sem categoria" && item.id !== "Sem categoria",
    )
    .sort((a, b) => b.spent - a.spent);
  const items = [...named, ...(uncategorized ? [uncategorized] : [])];
  const total = stats.expenses || 1;
  const slices = items.map((item, index) => {
    const start =
      (items.slice(0, index).reduce((sum, entry) => sum + entry.spent, 0) /
        total) *
      100;
    const end = start + (item.spent / total) * 100;
    return { ...item, start, end };
  });
  const activeId = category === "all" ? null : category;
  const hovered =
    slices.find((item) => item.id === hoveredId) ??
    slices.find((item) => item.id === activeId) ??
    null;
  const filteringId = hoveredId || activeId;
  function selectItem(item: (typeof items)[number]) {
    setCategory(category === item.name ? "all" : item.name);
  }
  return (
    <FinanceSurface
      render={<section />}
      className="finance-card home-distribution"
      header={
        <ShellHeader
          as="h2"
          icon={ChartPieSlice}
          title="Distribuição dos gastos"
        />
      }
    >
      <div
        className="home-distribution-body"
        onMouseLeave={() => setHoveredId(null)}
      >
        <div className={`home-donut${filteringId ? " is-filtering" : ""}`}>
          {slices.length ? (
            <svg
              className="home-donut-svg"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              {slices.map((item) => (
                <path
                  key={item.id}
                  className={`home-donut-slice${filteringId === item.id ? " is-hovered" : ""}`}
                  d={donutSlicePath(50, 50, 48, 33, item.start, item.end)}
                  fill={`color-mix(in srgb, ${item.color} 42%, var(--card))`}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onClick={() => selectItem(item)}
                />
              ))}
            </svg>
          ) : (
            <div className="home-donut-empty" />
          )}
          <div className="home-donut-center">
            <span>{hovered ? hovered.name : "Total de saídas"}</span>
            <strong>
              <Amount
                value={hovered ? hovered.spent : stats.expenses}
                motion="reel"
              />
            </strong>
          </div>
        </div>
        <div
          className={`home-spending-list${filteringId ? " is-filtering" : ""}`}
        >
          {items.length ? (
            items.map((item) => (
              <button
                type="button"
                className={`home-spending-row${filteringId === item.id ? " is-hovered" : ""}${activeId === item.id ? " is-selected" : ""}`}
                key={item.id}
                aria-pressed={activeId === item.id}
                onMouseEnter={() => setHoveredId(item.id)}
                onClick={() => selectItem(item)}
              >
                <span
                  className={`home-category-icon${item.image ? " has-image" : ""}`}
                  style={{
                    color: item.color,
                    background: `color-mix(in srgb, ${item.color} 16%, transparent)`,
                  }}
                >
                  {item.image ? (
                    <CategoryImage name={item.image} size={28} />
                  ) : (
                    <FinanceIcon name={item.icon} size={15} />
                  )}
                </span>
                <strong>{item.name}</strong>
                <span className="home-percentage">
                  {Math.round((item.spent / total) * 100)}%
                </span>
                <span className="home-category-amount">
                  <Amount value={item.spent} />
                </span>
              </button>
            ))
          ) : (
            <div className="home-empty">
              <span>Sem saídas no período</span>
            </div>
          )}
        </div>
      </div>
    </FinanceSurface>
  );
}

function CreditCardsCard({
  data,
  month,
  category,
  navigate,
}: {
  data: FinanceData;
  month: string;
  category: string;
  navigate: (view: View) => void;
}) {
  const merchantLogoUrl = useMerchantLogoUrl();
  const cards = data.accounts.filter(
    (row) => row.type === "CREDIT" && row.currency === "BRL",
  );
  const [index, setIndex] = useState(0);
  const [forecastIndex, setForecastIndex] = useState(1);
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef(0);
  const programmaticScrollRef = useRef<number | null>(null);
  const dragRef = useRef({
    id: null as number | null,
    startX: 0,
    startScroll: 0,
    dragging: false,
    suppressClick: false,
    cardIndex: -1,
  });
  const activeIndex = Math.min(index, Math.max(0, cards.length - 1));
  const active = cards[activeIndex];
  const today = localDate();
  const forecastMonths = ([-1, 0, 1] as const).map((offset) => {
    const key = shiftMonthKey(month, offset);
    const amount = active
      ? cardInvoiceAmount(data, active.id, key, category, today)
      : 0;
    const monthLabel = shortMonthLabel(key);
    return {
      key,
      label: offset === 0 ? monthLabel : `${monthLabel} ${key.slice(2, 4)}`,
      amount,
      open: key === today.slice(0, 7),
    };
  });
  const selected = forecastMonths[forecastIndex] || forecastMonths[1];
  const previousInvoiceAmount =
    forecastIndex > 0
      ? forecastMonths[forecastIndex - 1].amount
      : active
        ? cardInvoiceAmount(
            data,
            active.id,
            shiftMonthKey(month, -2),
            category,
            today,
          )
        : 0;
  const invoiceDelta = selected.amount - previousInvoiceAmount;
  const recentCharges = useMemo(() => {
    if (!active) return [];
    return data.transactions
      .filter(
        (row) =>
          row.accountId === active.id &&
          row.currency === "BRL" &&
          row.kind === "expense" &&
          row.date.startsWith(selected.key) &&
          matchesCategoryFilter(row.category, category),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, 4);
  }, [active, category, data.transactions, selected.key]);

  function nearestCardIndex() {
    const track = trackRef.current;
    if (!track) return 0;
    const slots = [
      ...track.querySelectorAll<HTMLElement>(".home-credit-card-slot"),
    ];
    const paddingLeft =
      Number.parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const origin = track.getBoundingClientRect().left + paddingLeft;
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < slots.length; i++) {
      const delta = Math.abs(slots[i].getBoundingClientRect().left - origin);
      if (delta < distance) {
        distance = delta;
        best = i;
      }
    }
    return best;
  }

  function scrollToCard(next: number, behavior?: ScrollBehavior) {
    const track = trackRef.current;
    const slot = track?.querySelectorAll<HTMLElement>(".home-credit-card-slot")[
      next
    ];
    if (!track || !slot) return;
    const paddingLeft =
      Number.parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const left =
      slot.getBoundingClientRect().left -
      track.getBoundingClientRect().left +
      track.scrollLeft -
      paddingLeft;
    programmaticScrollRef.current = next;
    track.scrollTo({
      left,
      behavior: behavior ?? (reduced ? "auto" : "smooth"),
    });
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(cards.length - 1, next));
    setIndex(clamped);
    setForecastIndex(1);
    scrollToCard(clamped);
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const sync = () => {
      const next = nearestCardIndex();
      const target = programmaticScrollRef.current;
      if (target !== null) {
        if (next === target) programmaticScrollRef.current = null;
        else return;
      }
      setIndex((current) => (current === next ? current : next));
    };

    const onScrollEnd = () => {
      programmaticScrollRef.current = null;
      sync();
    };
    const onScroll = () => {
      window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(sync, 80);
    };

    track.addEventListener("scrollend", onScrollEnd);
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(scrollTimerRef.current);
      track.removeEventListener("scrollend", onScrollEnd);
      track.removeEventListener("scroll", onScroll);
    };
  }, [cards.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const dragThreshold = 12;

    const cardIndexFromEvent = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return -1;
      const slot = target.closest(".home-credit-card-slot");
      if (!(slot instanceof HTMLElement)) return -1;
      return [
        ...track.querySelectorAll<HTMLElement>(".home-credit-card-slot"),
      ].indexOf(slot);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      dragRef.current = {
        id: event.pointerId,
        startX: event.clientX,
        startScroll: track.scrollLeft,
        dragging: false,
        suppressClick: false,
        cardIndex: cardIndexFromEvent(event),
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.id !== event.pointerId) return;
      const delta = event.clientX - drag.startX;
      if (!drag.dragging && Math.abs(delta) > dragThreshold) {
        drag.dragging = true;
        track.classList.add("dragging");
        track.setPointerCapture(event.pointerId);
      }
      if (!drag.dragging) return;
      track.scrollLeft = drag.startScroll - delta;
    };

    const finishDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.id !== event.pointerId) return;
      const { dragging, cardIndex } = drag;
      dragRef.current = {
        ...drag,
        id: null,
        dragging: false,
        suppressClick: dragging,
      };
      track.classList.remove("dragging");
      if (track.hasPointerCapture(event.pointerId))
        track.releasePointerCapture(event.pointerId);
      if (dragging) {
        const next = nearestCardIndex();
        setIndex(next);
        setForecastIndex(1);
        scrollToCard(next, reduced ? "auto" : "smooth");
        return;
      }
      if (cardIndex >= 0) goTo(cardIndex);
    };

    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", finishDrag);
    track.addEventListener("pointercancel", finishDrag);
    return () => {
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", finishDrag);
      track.removeEventListener("pointercancel", finishDrag);
    };
  }, [cards.length, reduced]);

  return (
    <FinanceSurface
      render={<section />}
      className="finance-card home-cards"
      aria-label="Cartões"
      header={<ShellHeader as="h2" icon={CreditCard} title="Cartões" />}
    >
      <div className="home-cards-top">
        <div className="home-cards-heading">
          <span className="home-muted">
            Fatura de{" "}
            {new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
              new Date(`${selected.key}-15T12:00:00`),
            )}
          </span>
        </div>
        <div className="home-cards-amount-row">
          <strong className="home-amount home-cards-amount">
            <Amount value={selected.amount} motion="reel" />
          </strong>
          <span
            className={`home-cards-delta ${invoiceDelta > 0 ? "up" : invoiceDelta < 0 ? "down" : ""}`}
          >
            {invoiceDelta > 0 ? "+" : ""}
            <Amount value={invoiceDelta} />
          </span>
        </div>
        <div className="home-cards-toolbar">
          <button
            className="home-cards-invoice"
            onClick={() => navigate("transactions")}
          >
            Ver fatura
          </button>
          {cards.length > 1 && (
            <div className="home-cards-nav">
              <button
                className="icon-button"
                aria-label="Cartão anterior"
                disabled={activeIndex <= 0}
                onClick={() => goTo(activeIndex - 1)}
              >
                <CaretLeft size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Próximo cartão"
                disabled={activeIndex >= cards.length - 1}
                onClick={() => goTo(activeIndex + 1)}
              >
                <CaretRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {cards.length ? (
        <>
          <div ref={trackRef} className="home-cards-track">
            {cards.map((card) => (
              <div key={card.id} className="home-credit-card-slot">
                <CreditCardVisual
                  card={card}
                  active={card.id === active?.id}
                  onSelect={() => {
                    if (dragRef.current.suppressClick) {
                      dragRef.current.suppressClick = false;
                      return;
                    }
                    goTo(cards.findIndex((row) => row.id === card.id));
                  }}
                />
              </div>
            ))}
          </div>

          <div className="home-cards-forecast" aria-label="Próximas faturas">
            <ForecastMonths
              months={forecastMonths}
              selectedIndex={forecastIndex}
              onSelect={setForecastIndex}
            />
          </div>

          <div className="home-cards-entries">
            <div className="home-cards-entries-heading">
              <span>Últimas entradas</span>
            </div>
            {recentCharges.length ? (
              <ul className="home-cards-entry-list">
                {recentCharges.map((row) => {
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
                  const hasMerchantLogo = Boolean(
                    merchantLogoUrl(row.description),
                  );
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="home-cards-entry"
                        onClick={() => navigate("transactions")}
                      >
                        <span
                          className={`home-cards-entry-symbol${hasMerchantLogo || categoryImage ? " has-image" : ""}${hasMerchantLogo ? " has-merchant" : ""}`}
                          style={
                            hasMerchantLogo
                              ? undefined
                              : {
                                  color: categoryColor,
                                  background: `color-mix(in srgb, ${categoryColor} 16%, transparent)`,
                                }
                          }
                        >
                          {hasMerchantLogo ? (
                            <MerchantLogo
                              description={row.description}
                              size={22}
                            />
                          ) : categoryImage ? (
                            <CategoryImage name={categoryImage} size={22} />
                          ) : (
                            <FinanceIcon name="layers" size={12} />
                          )}
                        </span>
                        <span className="home-cards-entry-copy">
                          <strong>{row.description}</strong>
                          <small>
                            {dateLabel(row.date)}
                            {row.category ? ` · ${row.category}` : ""}
                          </small>
                        </span>
                        <strong className="home-cards-entry-amount">
                          <Amount value={row.amount} />
                        </strong>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="home-cards-entries-empty">
                Nenhuma entrada neste mês
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="home-empty">
          <CreditCard size={26} />
          <span>Nenhum cartão de crédito</span>
          <Button variant="outline" onClick={() => navigate("accounts")}>
            Ver contas
          </Button>
        </div>
      )}
    </FinanceSurface>
  );
}

function creditCardTheme(card: Account) {
  const text = `${card.institution} ${card.name}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ");
  if (
    text.includes("sicredi") ||
    text.includes("visa internacional") ||
    (text.includes("visa") && text.includes("internacional"))
  )
    return "sicredi";
  if (
    text.includes("ultravioleta") ||
    text.includes("ultraviolet") ||
    text.includes("nubank") ||
    text.includes("nu bank")
  )
    return "ultravioleta";
  return "generic";
}

function creditCardLabel(card: Account, theme: string) {
  if (theme === "ultravioleta") return "Nubank Ultravioleta";
  if (theme === "sicredi") return "Sicredi Visa Internacional";
  const institution = card.institution.trim();
  if (!institution || /meupluggy|pluggy/i.test(institution)) return card.name;
  return `${institution} ${card.name}`.trim();
}

function CreditCardChip({
  variant = "generic",
}: {
  variant?: "ultravioleta" | "sicredi" | "generic";
}) {
  const reactId = useId().replace(/:/g, "");
  const fillId = `chip-fill-${variant}-${reactId}`;

  return (
    <svg
      className="home-credit-card-chip"
      viewBox="0 0 90 60"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ddd3c4" />
          <stop offset="38%" stopColor="#c4b49a" />
          <stop offset="70%" stopColor="#a89478" />
          <stop offset="100%" stopColor="#c8bba8" />
        </linearGradient>
      </defs>
      <rect width="90" height="60" rx="8" fill={`url(#${fillId})`} />
      <g
        fill="none"
        stroke="#5f5343"
        strokeWidth="1.1"
        strokeLinejoin="round"
        strokeLinecap="butt"
      >
        {variant === "ultravioleta" ? (
          <>
            {/* Ref 1 em paisagem: faixas + poço central */}
            <path d="M2 14.5 H88" />
            <path d="M2 45.5 H88" />
            <path d="M2 30 H34.5" />
            <path d="M55.5 30 H88" />
            <path d="M34.5 14.5 V21" />
            <path d="M55.5 14.5 V21" />
            <path d="M34.5 39 V45.5" />
            <path d="M55.5 39 V45.5" />
            <rect x="34.5" y="21" width="21" height="18" rx="9" />
            <rect x="39.5" y="24.5" width="11" height="11" rx="1.2" />
          </>
        ) : (
          <>
            {/* Ref 2 em paisagem: H com cortes diagonais */}
            <path d="M26 2 V58" />
            <path d="M64 2 V58" />
            <path d="M26 2 H64" />
            <path d="M2 30 H26" />
            <path d="M64 30 H88" />
            <path d="M26 18 L45 30 L64 18" />
            <path d="M26 42 L45 30 L64 42" />
            <path d="M26 18 V42" />
            <path d="M64 18 V42" />
          </>
        )}
      </g>
    </svg>
  );
}

function NubankLogo({ id }: { id: string }) {
  return (
    <svg className="home-credit-nu" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#f7f7f7" />
          <stop offset="35%" stopColor="#d8d8d8" />
          <stop offset="70%" stopColor="#9a9a9a" />
          <stop offset="100%" stopColor="#6e6e6e" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M7.2795 5.4336c-1.1815 0-2.1846.4628-2.9432 1.252h-.002c-.0541-.0022-.1074-.002-.162-.002-1.5436 0-2.9925.8835-3.699 2.2559-.3088.5996-.4234 1.2442-.459 1.9003-.0321.589 0 1.1863 0 1.7696v5.6523H3.184s.0022-2.784 0-5.1777c-.0014-1.6112-.0118-3.0471 0-3.3418.056-1.3937.4372-2.3053 1.1484-3.0508 2.3585.0018 3.8852 1.6091 3.9705 4.168.0196.5874.0254 3.7304.0254 3.7304v3.672h3.1678v-4.965c0-1.5007.0127-2.8006-.0918-3.6952-.292-2.5-1.821-4.168-4.1248-4.168zm8.3903.3008l-3.166.0039v4.9648c0 1.5009-.0127 2.8007.0919 3.6953.2921 2.5001 1.821 4.168 4.1248 4.168 1.1815 0 2.1846-.4628 2.9432-1.252.0003-.0003.0016.0004.002 0 .0542.0023.1093.002.164.002 1.5435 0 2.9905-.8835 3.6971-2.2558.3088-.5997.4233-1.2442.459-1.9004.032-.5889 0-1.1862 0-1.7695V5.7383H20.816s-.0022 2.784 0 5.1777c.0015 1.6113.0119 3.047 0 3.3418-.056 1.3935-.4372 2.3053-1.1483 3.0508-2.3586-.0018-3.8853-1.6091-3.9706-4.168-.0196-.5874-.0273-2.0437-.0273-3.7324Z"
      />
    </svg>
  );
}

function SicrediMark() {
  return (
    <svg
      className="home-credit-sicredi-mark"
      viewBox="0 0 145 34"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M25.1965 15.2486C24.2035 16.0664 23.4636 16.2027 23.1326 15.8717C22.9185 15.6575 22.8795 15.2292 23.0353 14.684C23.561 12.9511 23.9698 11.1988 24.3008 9.42702C26.2868 8.55086 28.2728 7.73311 30.4729 7.51894C29.441 10.3421 27.5524 13.2821 25.1965 15.2486ZM24.184 21.0702C22.9379 20.8171 22.3538 20.272 22.3928 19.7852C22.4122 19.4737 22.7043 19.1622 23.2105 18.948C24.7681 18.286 26.3063 17.5656 27.7665 16.6894C29.6941 17.624 31.5438 18.8117 33.0235 20.3109C30.3172 21.3234 26.9877 21.6544 24.184 21.0702ZM19.0439 24.1465C18.4403 22.9004 18.4987 22.0438 18.8881 21.7517C19.1607 21.557 19.589 21.5959 20.0758 21.8685C21.5945 22.7252 23.1326 23.504 24.7681 24.1465C24.7681 24.1465 24.7681 24.1465 24.7681 24.166C25.3522 26.5024 25.7027 28.9557 25.5469 31.37C22.8406 29.6566 20.3873 26.9308 19.0439 24.1465ZM13.2223 21.9075C13.9037 20.5445 14.6241 20.0188 15.1109 20.1746C15.4419 20.272 15.6755 20.6419 15.7534 21.2455C16.026 23.1536 16.4349 25.0227 16.9216 26.8724C15.2277 29.1504 13.417 31.3505 11.1389 33.1418C10.8858 29.4619 11.5868 25.2369 13.2223 21.9075ZM11.4699 15.6186C13.0081 15.307 13.8453 15.5602 14.04 16.0469C14.1568 16.3584 14.0011 16.7868 13.5727 17.2541C12.1319 18.7533 10.8079 20.3304 9.54238 21.9659H9.52291C6.42714 22.18 3.19508 22.0632 0.157715 21.3428C3.25349 18.7338 7.43959 16.4168 11.4699 15.6186ZM15.4029 10.5174C16.5517 11.5103 16.8632 12.2892 16.6101 12.7175C16.4349 12.9901 16.026 13.1264 15.4029 13.068C13.3391 12.8343 11.2752 12.737 9.19192 12.737C7.22542 10.4784 5.43416 7.96676 4.28541 5.26039C8.19893 6.13655 12.4045 7.96676 15.4029 10.5174ZM21.5166 10.5952C21.5166 11.9971 21.1272 12.698 20.6599 12.737C20.3484 12.7759 19.9979 12.5228 19.6669 12.0166C18.6155 10.3811 17.4668 8.80398 16.2402 7.26583C16.7074 4.81257 17.4668 2.32038 18.7713 0.15918C20.4068 3.29389 21.5361 7.11006 21.5166 10.5952Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.239 7.24661C16.7063 4.81283 17.4656 2.32064 18.7701 0.159439C15.9859 -0.229966 13.1237 0.101028 10.5147 1.07454C12.1113 2.63216 13.6884 4.20925 15.1097 5.90317C15.2757 6.10406 15.4534 6.31279 15.6288 6.51881C15.8444 6.77204 16.0565 7.02116 16.239 7.24661ZM25.0594 2.36028C24.9426 4.22942 24.8063 6.0791 24.5337 7.9093C24.5013 8.11212 24.4688 8.33183 24.4364 8.55155C24.3909 8.85915 24.3455 9.16676 24.3001 9.42798C26.286 8.55182 28.272 7.73407 30.4721 7.5199C29.0898 5.43658 27.2401 3.66479 25.0594 2.36028ZM32.9049 13.1462C31.6393 14.1392 30.3348 15.1127 28.9524 15.9499C28.7762 16.0556 28.5921 16.1733 28.4089 16.2903L28.4088 16.2904C28.1873 16.4319 27.9673 16.5725 27.7647 16.6898C29.6923 17.6243 31.542 18.812 33.0217 20.3112C33.3722 17.8385 33.3527 15.6189 32.9049 13.1462ZM26.1083 24.6527C27.627 25.2174 29.2041 25.6457 30.7811 26.0351C29.4766 28.1379 27.6854 29.9876 25.5631 31.37C25.7189 28.9557 25.3684 26.5024 24.7843 24.166V24.1465C25.1076 24.292 25.5115 24.4375 25.8845 24.5719L25.8847 24.572L25.8848 24.572C25.9609 24.5994 26.0357 24.6263 26.1083 24.6527ZM19.3922 33.7646C18.6524 31.9928 17.9514 30.2015 17.3868 28.4103C17.3464 28.2789 17.3034 28.1424 17.2597 28.0039L17.2597 28.0036L17.2596 28.0035L17.2596 28.0034L17.2596 28.0034C17.1351 27.6085 17.006 27.1986 16.9195 26.8527C15.2256 29.1307 13.4149 31.3308 11.1563 33.1221C13.8822 33.9204 16.5496 34.2708 19.3922 33.7646ZM8.47152 23.4658C7.14754 25.3154 5.94039 27.3014 4.79164 29.2874C2.53309 27.0872 0.936531 24.3224 0.157721 21.3435C3.19508 22.0639 6.42714 22.1807 9.52292 21.9665H9.54239C9.34379 22.2352 9.12416 22.546 8.90454 22.8567L8.90438 22.857L8.90419 22.8572C8.75789 23.0642 8.6116 23.2712 8.47152 23.4658ZM0 13.3987C2.43378 13.1066 4.88704 12.8535 7.30135 12.7756C7.50564 12.7693 7.72039 12.7608 7.93601 12.7523L7.93616 12.7523C8.37808 12.7348 8.82359 12.7172 9.18996 12.7172C7.204 10.4782 5.4322 7.96649 4.28346 5.26013C2.12226 7.53815 0.642519 10.3808 0 13.3987Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M42.5429 11.2948C42.0951 14.6048 43.3023 16.5713 46.6122 17.8563L50.9735 19.5113C52.3559 19.998 52.6675 20.2317 52.4922 21.5557C52.2196 23.2496 51.5382 23.6974 48.4813 23.6974H41.0826L40.4207 28.1171H48.6955C55.1402 28.1171 57.3209 26.6763 57.9634 21.9061C58.3722 18.9077 57.8271 16.7465 53.8551 15.2862L49.7274 13.7675C48.1309 13.2029 47.8388 12.9693 48.053 11.6453C48.2866 10.1655 48.8708 9.83455 50.0584 9.75667H58.8979L59.5599 5.33691H51.6745C46.3007 5.33691 43.2633 6.29096 42.5429 11.2948ZM67.6595 9.75667L68.3021 5.33691H62.9477L62.2857 9.75667H67.6595ZM64.9533 28.0976H59.5989L61.9548 12.0151H67.3286L64.9533 28.0976ZM78.1552 11.5683C75.1178 11.5683 73.015 12.1718 71.5937 13.4764C70.1724 14.7614 69.3546 16.7084 68.8873 19.8237C68.42 22.9194 68.8095 25.1001 70.0945 26.4825C71.3211 27.826 73.385 28.4685 76.4418 28.4685C77.941 28.4685 80.1411 28.3322 82.1076 27.7091L82.2439 27.6702L82.8086 23.8735L82.4581 23.9319C81.0757 24.1266 79.3429 24.2045 77.2985 24.2045C75.8966 24.2045 75.1762 24.0487 74.7868 23.6204C74.3001 23.0947 74.2027 22.0627 74.4753 20.0768C74.9426 16.3969 76.1497 15.8128 78.8366 15.8128C79.927 15.8128 83.9963 15.8712 83.9963 15.8712L84.522 12.2692C84.5193 12.2718 84.4759 12.2611 84.3928 12.2405C83.8578 12.108 81.6775 11.5683 78.1552 11.5683ZM98.131 12.0151H99.1629L98.9682 12.3656C97.469 14.7994 96.9822 16.8632 96.9822 16.8827L96.9433 17.0579H95.7945C94.3927 17.0579 92.5041 18.0315 91.8226 18.8492L90.5181 28.0976H85.1248L87.4807 12.0151H91.7447V15.1109C94.2369 12.9497 96.1645 12.0151 98.131 12.0151ZM115.537 17.2147C115.79 15.5207 115.517 14.2552 114.699 13.3595C113.609 12.1524 111.506 11.5683 108.294 11.5683C101.791 11.5683 99.3373 13.6126 98.5585 19.6874C98.1691 22.8026 98.6169 25.0028 99.9409 26.4046C101.226 27.787 103.368 28.4685 106.463 28.4685C108.644 28.4685 111.974 28.0791 114.076 27.2418L114.271 27.164L114.213 26.9693C114.213 26.9681 114.211 26.9621 114.208 26.9515C114.204 26.9375 114.198 26.9155 114.189 26.8862C114.093 26.5547 113.724 25.2896 113.59 24.1266L113.551 23.8735L113.298 23.9319C112.655 24.0877 108.683 24.2824 107.048 24.2824C105.139 24.2824 104.127 23.9319 104.01 22.0822L108.644 21.7512C112.499 21.4981 115.011 20.6414 115.537 17.2147ZM104.322 18.8696C104.808 16.2606 105.432 15.4429 107.963 15.4429H108.469C109.326 15.4429 109.91 15.5013 110.143 15.7544C110.299 15.9296 110.358 16.2217 110.319 16.7279C110.143 18.1492 109.403 18.4413 107.826 18.5581L104.322 18.8696ZM129.574 11.9372L130.547 5.35628L135.921 5.37575L132.553 28.117H128.25V25.5664C126.108 27.494 123.908 28.487 121.669 28.487C120.111 28.487 118.943 28.0586 118.125 27.163C116.859 25.8001 116.49 23.3663 116.996 19.7448C117.989 12.9497 120.637 11.5868 124.609 11.5868C126.186 11.5868 127.977 11.7036 129.574 11.9372ZM123.479 24.0867C125.115 24.0478 126.419 23.23 128.094 21.8087L129.028 15.3251H126.673C123.674 15.3251 123.032 15.695 122.447 19.8616C122.155 22.0034 122.058 23.3274 122.506 23.8141C122.701 24.0283 123.012 24.1062 123.479 24.0867ZM143.905 9.75667L144.548 5.33691H139.193L138.551 9.75667H143.905ZM141.199 28.0976H135.845L138.2 12.0151H143.574L141.199 28.0976Z"
      />
    </svg>
  );
}

function VisaMark() {
  return (
    <svg className="home-credit-visa" viewBox="0 7.8 24 8.2" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"
      />
    </svg>
  );
}

function ContactlessMark() {
  return (
    <svg
      className="home-credit-contactless"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 9.5c1.6-1.5 3.7-1.5 5.2 0M6.2 7c2.5-2.4 6.1-2.4 8.6 0M9.8 12c.9-.8 2.1-.8 3 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ForecastMonths({
  months,
  selectedIndex,
  onSelect,
}: {
  months: {
    key: string;
    label: string;
    amount: number;
    open: boolean;
  }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const fillId = useId().replace(/:/g, "");
  const [chart, setChart] = useState<{
    width: number;
    height: number;
    top: number;
    centers: number[];
    lefts: number[];
    rights: number[];
  } | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const items = [
        ...list.querySelectorAll<HTMLElement>(".home-cards-forecast-item"),
      ];
      const plots = [
        ...list.querySelectorAll<HTMLElement>(".home-cards-forecast-plot"),
      ];
      if (!items.length || !plots.length) return;
      const listRect = list.getBoundingClientRect();
      const plotRect = plots[0].getBoundingClientRect();
      setChart({
        width: listRect.width,
        height: plotRect.height,
        top: plotRect.top - listRect.top,
        centers: items.map((item) => {
          const rect = item.getBoundingClientRect();
          return rect.left - listRect.left + rect.width / 2;
        }),
        lefts: items.map(
          (item) => item.getBoundingClientRect().left - listRect.left,
        ),
        rights: items.map((item) => {
          const rect = item.getBoundingClientRect();
          return rect.right - listRect.left;
        }),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [months]);

  const amounts = months.map((item) => item.amount);
  const maxAmount = Math.max(...amounts, 1);
  const minAmount = Math.min(...amounts);
  const span = Math.max(maxAmount - minAmount, 1);
  const pointY = (amount: number, height: number) => {
    if (maxAmount === minAmount) return height * 0.5;
    const level = (amount - minAmount) / span;
    return height * (0.12 + (1 - level) * 0.76);
  };

  const points =
    chart?.centers.map((x, index) => ({
      x,
      y: pointY(amounts[index], chart.height),
    })) ?? [];
  const first = points[0];
  const second = points[1];
  const firstLeft = chart?.lefts[0] ?? 0;
  const leadIn =
    chart && first
      ? second
        ? {
            x: firstLeft,
            y: Math.min(
              chart.height * 0.88,
              Math.max(
                chart.height * 0.12,
                first.y -
                  ((second.y - first.y) * (first.x - firstLeft)) /
                    (second.x - first.x),
              ),
            ),
          }
        : { x: firstLeft, y: first.y }
      : null;
  const selected = points[selectedIndex];
  const previous = selectedIndex > 0 ? points[selectedIndex - 1] : leadIn;
  const next = points[selectedIndex + 1] ?? null;
  const selectedLeft = chart?.lefts[selectedIndex] ?? 0;
  const selectedRight = chart?.rights[selectedIndex] ?? 0;
  const yAtX = (
    from: { x: number; y: number } | null,
    to: { x: number; y: number } | null,
    x: number,
    fallback: number,
  ) => {
    if (!from || !to || from.x === to.x) return fallback;
    return from.y + ((to.y - from.y) * (x - from.x)) / (to.x - from.x);
  };
  const entryY = yAtX(previous, selected, selectedLeft, selected?.y ?? 0);
  const exitY = yAtX(selected, next, selectedRight, selected?.y ?? 0);
  const entry = selected ? { x: selectedLeft, y: entryY } : null;
  const exit = selected ? { x: selectedRight, y: exitY } : null;
  const solidPoints =
    selectedIndex > 0
      ? leadIn
        ? [leadIn, ...points.slice(0, selectedIndex + 1)]
        : points.slice(0, selectedIndex + 1)
      : [];
  const dashedPoints =
    selectedIndex === 0 && leadIn
      ? [leadIn, ...points]
      : points.slice(selectedIndex);
  const solidTrend = solidPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const dashedTrend = dashedPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const fillPath =
    chart && selected && entry && exit
      ? [
          `M ${entry.x} ${entry.y}`,
          `L ${selected.x} ${selected.y}`,
          `L ${exit.x} ${exit.y}`,
          `L ${exit.x} ${chart.height}`,
          `L ${entry.x} ${chart.height}`,
          "Z",
        ].join(" ")
      : "";

  return (
    <div className="home-cards-forecast-list" ref={listRef}>
      {chart && points.length > 0 && (
        <svg
          className="home-cards-forecast-chart"
          width={chart.width}
          height={chart.height}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          style={{ top: chart.top }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--foreground)"
                stopOpacity="0.14"
              />
              <stop
                offset="100%"
                stopColor="var(--foreground)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          {selected && <path d={fillPath} fill={`url(#${fillId})`} />}
          {dashedPoints.length > 1 && (
            <polyline
              className="home-cards-forecast-path is-dashed"
              fill="none"
              points={dashedTrend}
            />
          )}
          {solidPoints.length > 1 && (
            <polyline
              className="home-cards-forecast-path is-solid"
              fill="none"
              points={solidTrend}
            />
          )}
          {points.map((point, index) => {
            const isSelected = index === selectedIndex;
            const past = index < selectedIndex;
            return (
              <circle
                key={months[index].key}
                className={`home-cards-forecast-dot ${isSelected ? "active" : past ? "done" : ""}`}
                cx={point.x}
                cy={point.y}
                r={isSelected ? 5.5 : 5}
              />
            );
          })}
        </svg>
      )}
      {months.map((item, itemIndex) => {
        const isSelected = selectedIndex === itemIndex;
        return (
          <button
            key={item.key}
            type="button"
            className={`home-cards-forecast-item ${isSelected ? "selected" : ""}`}
            onClick={() => onSelect(itemIndex)}
          >
            <span className="home-cards-forecast-head">
              <span className="home-cards-forecast-month">{item.label}</span>
              {item.open && <span className="home-cards-status">Aberta</span>}
            </span>
            <span className="home-cards-forecast-plot" />
            <strong>
              <Amount value={item.amount} />
            </strong>
          </button>
        );
      })}
    </div>
  );
}

function CreditCardVisual({
  card,
  active,
  onSelect,
}: {
  card: Account;
  active: boolean;
  onSelect: () => void;
}) {
  const theme = creditCardTheme(card);
  const label = creditCardLabel(card, theme);
  return (
    <button
      type="button"
      className={`home-credit-card theme-${theme} ${active ? "active" : ""}`}
      style={
        theme === "generic"
          ? { background: card.color || "var(--foreground)" }
          : undefined
      }
      onClick={onSelect}
      aria-pressed={active}
      aria-label={label}
    >
      <span className="home-credit-card-sheen" aria-hidden="true" />
      {theme === "sicredi" ? (
        <>
          <span className="home-credit-sicredi-brand" aria-hidden="true">
            <SicrediMark />
          </span>
          <ContactlessMark />
          <CreditCardChip variant="sicredi" />
          <div className="home-credit-card-network" aria-hidden="true">
            <span>internacional</span>
            <VisaMark />
          </div>
        </>
      ) : theme === "ultravioleta" ? (
        <>
          <CreditCardChip variant="ultravioleta" />
          <span className="home-credit-ultra-brand" aria-hidden="true">
            <span className="home-credit-ultra-name">Eduardo C Amarante</span>
            <NubankLogo id={`nu-logo-${card.id}`} />
          </span>
        </>
      ) : (
        <>
          <div className="home-credit-card-top">
            <strong>{label}</strong>
          </div>
          <CreditCardChip variant="generic" />
          <span className="home-credit-card-name">{card.name}</span>
        </>
      )}
    </button>
  );
}

function monthChangePct(history: MarketQuote["history"], month: string) {
  const points = history.filter((point) => point.date.startsWith(month));
  if (points.length >= 2) {
    const first = points[0].price;
    const last = points.at(-1)!.price;
    return first ? ((last - first) / first) * 100 : null;
  }
  if (history.length >= 2) {
    const first = history[0].price;
    const last = history.at(-1)!.price;
    return first ? ((last - first) / first) * 100 : null;
  }
  return null;
}

function HomeInvestmentsCard({
  data,
  month,
  navigate,
  openForm,
}: {
  data: FinanceData;
  month: string;
  navigate: (view: View) => void;
  openForm: (form: FormState) => void;
}) {
  const [period, setPeriod] = useState<"month" | "all">("all");
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const tickers = extractEquityTickers(data.investments);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (tickers.length) params.set("tickers", tickers.join(","));
    const query = params.toString();
    fetch(`/api/market${query ? `?${query}` : ""}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("market");
        return response.json() as Promise<{ quotes: MarketQuote[] }>;
      })
      .then((payload) => setQuotes(payload.quotes || []))
      .catch((error) => {
        if (error?.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [tickers.join(",")]);

  const monthGainById = (() => {
    if (period !== "month") return {};
    const gains: Record<string, number> = {};
    const bySymbol = new Map(
      quotes.map((quote) => [quote.symbol.toUpperCase(), quote]),
    );
    for (const row of data.investments) {
      if (row.currency !== "BRL" || row.balance <= 0) continue;
      const bucket = investmentBucket(row);
      if (bucket === "bolsa") {
        const match = row.name.toUpperCase().match(/\b([A-Z]{4}\d{1,2}F?)\b/);
        const quote = match ? bySymbol.get(match[1]) : null;
        const pct = quote ? monthChangePct(quote.history, month) : null;
        if (pct != null) gains[row.id] = Math.round((row.balance * pct) / 100);
      } else if (bucket === "cripto") {
        const quote = bySymbol.get("BTC");
        const pct = quote ? monthChangePct(quote.history, month) : null;
        if (pct != null) gains[row.id] = Math.round((row.balance * pct) / 100);
      }
    }
    return gains;
  })();

  const overview = investmentsOverview(data.investments, {
    period,
    monthGainById,
  });

  return (
    <FinanceSurface
      render={<section />}
      className="finance-card home-investments"
      aria-label="Investimentos"
      header={
        <ShellHeader
          as="h2"
          icon={Plant}
          title="Investimentos"
          aside={
            <>
              {" "}
              <DashboardLink
                label="Ver investimentos"
                onClick={() => navigate("investments")}
              />{" "}
            </>
          }
        />
      }
    >
      {overview.empty ? (
        <div className="home-empty">
          <Plant size={24} />
          <span>Nenhum investimento</span>
          <Button
            variant="outline"
            onClick={() => openForm({ resource: "investments" })}
          >
            <Plus size={14} />
            Adicionar
          </Button>
        </div>
      ) : (
        <>
          <div className="home-investments-toolbar">
            <MotionSegmentedControl
              label="Período da valorização"
              value={period}
              onChange={(value) => setPeriod(value as "month" | "all")}
              options={[
                ["all", "Todo o período"],
                ["month", "Mês"],
              ]}
            />
          </div>
          <div className="home-investment-categories">
            {overview.categories.map((row) => (
              <button
                key={row.id}
                type="button"
                className="home-investment-category"
                onClick={() => navigate("investments")}
              >
                <span className="home-investment-share">
                  <i style={{ background: row.color }} aria-hidden="true" />
                  <PrivateValue as="small" className="amount">
                    {`${row.share.toFixed(1).replace(".", ",")}%`}
                  </PrivateValue>
                </span>
                <span className="home-investment-category-copy">
                  <strong>{row.label}</strong>
                  <span className="home-investment-category-meta">
                    <Amount value={row.balance} />
                    {row.gain != null && (
                      <span
                        className={
                          row.gain > 0
                            ? "home-investment-gain up"
                            : row.gain < 0
                              ? "home-investment-gain down"
                              : "home-investment-gain"
                        }
                      >
                        {row.gain !== 0 && (
                          <i
                            className="home-investment-gain-icon"
                            aria-hidden="true"
                          >
                            {row.gain > 0 ? (
                              <ArrowUp size={10} weight="bold" />
                            ) : (
                              <ArrowDown size={10} weight="bold" />
                            )}
                          </i>
                        )}
                        <PrivateValue as="span" className="amount">
                          {compactMoney(Math.abs(row.gain))}
                        </PrivateValue>
                      </span>
                    )}
                  </span>
                </span>
                <CaretRight size={16} className="home-investment-chevron" />
              </button>
            ))}
          </div>
          <div className="home-card-footer">
            <span>
              Total{" "}
              <strong>
                <Amount value={overview.total} />
              </strong>
              {overview.gain == null ? (
                "."
              ) : overview.gain > 0 ? (
                <>
                  . Rendeu{" "}
                  <strong>
                    <Amount value={overview.gain} />
                  </strong>
                  {period === "month" ? " neste mês." : "."}
                </>
              ) : overview.gain < 0 ? (
                <>
                  . Caiu{" "}
                  <strong>
                    <Amount value={Math.abs(overview.gain)} />
                  </strong>
                  {period === "month" ? " neste mês." : "."}
                </>
              ) : period === "month" ? (
                ". Sem variação neste mês."
              ) : (
                ". Sem variação."
              )}
            </span>
          </div>
        </>
      )}
    </FinanceSurface>
  );
}

function GoalCard({
  goal,
  compact = false,
  actions,
  onDetails,
  categories,
}: {
  goal: Goal;
  categories: Category[];
  compact?: boolean;
  actions: React.ReactNode;
  onDetails: () => void;
}) {
  const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
  return (
    <div className={`goal-card ${compact ? "compact" : ""}`}>
      <button
        type="button"
        className="goal-card-open"
        aria-label={`Ver detalhes de ${goal.name}`}
        onClick={onDetails}
      />
      <div className="goal-card-top">
        {goal.imageSlug ? (
          <CategoryImage name={goal.imageSlug} size={64} />
        ) : (
          <Illustration name={assetNames[goal.icon] || "target"} />
        )}
        {actions}
      </div>
      <h3>{goal.name}</h3>
      {goal.description && <GoalDescription text={goal.description} />}
      <div className="goal-amount">
        <Amount value={goal.current} />
        <span>
          {" "}
          de <Amount value={goal.target} />
        </span>
      </div>
      <ProgressBar
        value={percent}
        label={`Progresso de ${goal.name}`}
        tone={goal.current / goal.target >= 0.9 ? "positive" : "neutral"}
        className="progress-track"
      />
      <div className="goal-card-footer">
        <span>{percent}%</span>
      </div>
      {!compact && (
        <div className="goal-deadline">
          <span>
            Até{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              month: "short",
              year: "numeric",
            }).format(new Date(goal.deadline + "T12:00:00"))}
          </span>
          <span className="goal-card-category">
            <CategoryMark
              name={goal.category || "Sem categoria"}
              size={18}
              color={
                categories.find((item) => item.name === goal.category)?.color
              }
              imageSlug={
                categories.find((item) => item.name === goal.category)
                  ?.imageSlug
              }
            />
            {goal.category || "Sem categoria"}
          </span>
        </div>
      )}
    </div>
  );
}
type TransactionSortColumn =
  "description" | "category" | "account" | "date" | "status" | "amount";
type TransactionSort = {
  column: TransactionSortColumn;
  direction: "asc" | "desc";
};

function TransactionTable({
  data,
  rows,
  openForm,
  onSearchSame,
  sort,
  onSort,
  compact = false,
}: {
  data: FinanceData;
  rows: Transaction[];
  openForm: (form: FormState) => void;
  onSearchSame?: (description: string) => void;
  sort?: TransactionSort;
  onSort?: (column: TransactionSortColumn) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`table-scroll${!compact ? " transactions-responsive" : ""}`}
    >
      {!compact && sort && onSort && (
        <div className="transaction-mobile-sort">
          <FieldSelect
            aria-label="Ordenar lançamentos"
            value={sort.column}
            onValueChange={(column) => onSort(column as TransactionSortColumn)}
            options={[
              { value: "description", label: "Descrição" },
              { value: "category", label: "Categoria" },
              { value: "account", label: "Conta" },
              { value: "date", label: "Data" },
              { value: "status", label: "Situação" },
              { value: "amount", label: "Valor" },
            ]}
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
      )}
      <table className="transactions-table">
        <thead>
          <tr>
            {(
              [
                ["description", "Descrição"],
                ["category", "Categoria"],
                ...(!compact ? [["account", "Conta"]] : []),
                ["date", "Data"],
                ["status", "Situação"],
                ["amount", "Valor"],
              ] as [TransactionSortColumn, string][]
            ).map(([column, label]) => {
              const active = sort?.column === column;
              return (
                <th
                  key={column}
                  scope="col"
                  className={column === "amount" ? "right" : undefined}
                  aria-sort={
                    onSort
                      ? active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                >
                  {onSort ? (
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
                  ) : (
                    label
                  )}
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
            const account = data.accounts.find((a) => a.id === row.accountId),
              categoryName = row.category || "Sem categoria",
              categoryImage = imageForCategory(categoryName, data.categories),
              categoryColor = colorForCategory(
                categoryName,
                0,
                data.categories,
              );
            return (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger render={<tr />}>
                  <td className="transaction-desc">
                    <button
                      className="transaction-name"
                      onClick={() =>
                        openForm({
                          resource: "transactions",
                          record: record(row),
                        })
                      }
                      title={row.description}
                    >
                      <TransactionAvatar
                        transaction={row}
                        categories={data.categories}
                      />
                      <span className="transaction-name-text">
                        <strong>{row.description}</strong>
                        {compact && account ? (
                          <small>{accountChannelLabel(account)}</small>
                        ) : null}
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
                  {!compact && (
                    <td
                      className="muted transaction-account-cell"
                      data-label="Conta"
                    >
                      {account
                        ? formatAccountLabel(account, data.connections)
                        : "Manual"}
                    </td>
                  )}
                  <td className="table-date" data-label="Data">
                    {dateLabel(row.date, { year: true })}
                  </td>
                  <td className="transaction-status-cell" data-label="Situação">
                    <StatusTag
                      tone={row.status === "paid" ? "success" : "warning"}
                    >
                      {row.status === "paid" ? "Confirmado" : "Pendente"}
                    </StatusTag>
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
                  <td className="transaction-actions-cell">
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
                      <PencilSimple size={14} />
                    </button>
                  </td>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {onSearchSame ? (
                    <ContextMenuItem
                      onSelect={() => onSearchSame(row.description)}
                    >
                      <MagnifyingGlass size={14} />
                      Buscar iguais
                    </ContextMenuItem>
                  ) : null}
                  {onSearchSame ? <ContextMenuSeparator /> : null}
                  <ContextMenuItem
                    onSelect={() =>
                      openForm({
                        resource: "transactions",
                        record: record(row),
                      })
                    }
                  >
                    <PencilSimple size={14} />
                    Editar
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function TransactionsView(props: Props) {
  const {
    data,
    month,
    period: appPeriod,
    category,
    setCategory,
    query,
    setQuery,
    txType,
    setTxType,
    openForm,
  } = props;
  const [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [sort, setSort] = useState<TransactionSort>({
      column: "date",
      direction: "desc",
    });
  const bounds = periodDateBounds(appPeriod);
  const [pagePeriod, setPagePeriod] = useState(appPeriod);
  if (pagePeriod !== appPeriod) {
    setPagePeriod(appPeriod);
    setPage(1);
  }
  const baseRows = data.transactions.filter((row) =>
    inPeriod(row.date, bounds),
  );
  const categories = [
    ...new Set(
      [
        ...baseRows.map((row) => row.category || "Sem categoria"),
        ...(category !== "all" ? [category] : []),
      ].filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filtered = [
    ...filterTransactions(baseRows, query, txType, status, category),
  ].sort((a, b) => {
    const value = (row: Transaction): string | number => {
      switch (sort.column) {
        case "description":
          return row.description;
        case "category":
          return row.category || "Sem categoria";
        case "account": {
          const account = data.accounts.find(
            (item) => item.id === row.accountId,
          );
          return account
            ? formatAccountLabel(account, data.connections)
            : "Manual";
        }
        case "date":
          return row.date;
        case "status":
          return row.status === "paid" ? "Confirmado" : "Pendente";
        case "amount":
          return row.amount;
      }
    };
    const left = value(a),
      right = value(b);
    const comparison =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), "pt-BR", {
            sensitivity: "base",
            numeric: true,
          });
    return (
      (sort.direction === "asc" ? comparison : -comparison) ||
      a.id.localeCompare(b.id)
    );
  });
  const sumFiltered = (kind: Transaction["kind"], statusFilter?: string) =>
    filtered
      .filter(
        (row) =>
          row.currency === "BRL" &&
          row.kind === kind &&
          (!statusFilter || row.status === statusFilter),
      )
      .reduce((total, row) => total + row.amount, 0);
  const stats = {
    income: sumFiltered("income"),
    expenses: sumFiltered("expense"),
    pending: sumFiltered("expense", "pending"),
  };
  const periodLabel = appPeriod.mode === "all" ? "no total" : "no período";
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    currentPage = Math.min(page, pages);
  const exportStamp =
    appPeriod.mode === "all"
      ? "todo-periodo"
      : appPeriod.mode === "month"
        ? month
        : appPeriod.mode === "last3"
          ? "ultimos-3-meses"
          : appPeriod.mode === "year"
            ? String(appPeriod.year)
            : `${appPeriod.from}_${appPeriod.to}`;
  function exportCsv() {
    const safe = (value: string) =>
      `"${(/^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
    const csv =
      "\uFEFF" +
      [
        "Descrição;Valor;Moeda;Tipo;Data;Situação;Categoria",
        ...filtered.map((row) =>
          [
            row.description,
            (row.amount / 100).toFixed(2),
            row.currency,
            row.kind,
            row.date,
            row.status,

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
    a.download = `clara-lancamentos-${exportStamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="summary-grid">
        <MiniStat
          label={`Entradas ${periodLabel}`}
          value={stats.income}
          icon={<ArrowDownLeft />}
          color="green"
        />
        <MiniStat
          label={`Saídas ${periodLabel}`}
          value={stats.expenses}
          icon={<ArrowUpRight />}
          color="neutral"
        />
        <MiniStat
          label="Ainda pendente"
          value={stats.pending}
          icon={<Wallet />}
          color="amber"
        />
      </div>
      <FinanceSurface render={<section />} className="finance-card full-table">
        <CardTitle
          title="Lançamentos"
          subtitle={`${filtered.length} registros`}
          action={
            <Button
              variant="outline"
              size="sm"
              className="text-[10px]"
              onClick={exportCsv}
            >
              <DownloadSimple size={15} />
              Exportar CSV
            </Button>
          }
        />
        <div className="table-filters">
          <label className="search-field">
            <MagnifyingGlass size={17} />
            <input
              id="transaction-search"
              aria-label="Buscar lançamento"
              placeholder="Buscar descrição, valor ou categoria"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query ? (
              <button
                type="button"
                className="search-field-clear"
                aria-label="Limpar busca"
                onClick={(e) => {
                  e.preventDefault();
                  setQuery("");
                  setPage(1);
                  requestAnimationFrame(() => {
                    document.getElementById("transaction-search")?.focus();
                  });
                }}
              >
                <X size={14} />
              </button>
            ) : null}
          </label>
          <FieldSelect
            aria-label="Filtrar por tipo"
            value={txType}
            onValueChange={(next) => {
              setTxType(next);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Todos os tipos" },
              { value: "income", label: "Entradas" },
              { value: "expense", label: "Saídas" },
              { value: "transfer", label: "Transferências" },
            ]}
          />
          <FieldSelect
            aria-label="Filtrar por categoria"
            value={category}
            onValueChange={(next) => {
              setCategory(next);
              setPage(1);
            }}
            options={categoryFieldOptions(categories, {
              categories: data.categories,
            })}
          />
          <FieldSelect
            aria-label="Filtrar por situação"
            value={status}
            onValueChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Todas as situações" },
              { value: "paid", label: "Confirmados" },
              { value: "pending", label: "Pendentes" },
            ]}
          />
        </div>
        {filtered.length ? (
          <>
            <TransactionTable
              data={data}
              rows={filtered.slice((currentPage - 1) * 10, currentPage * 10)}
              openForm={openForm}
              sort={sort}
              onSort={(column) => {
                setSort((current) => ({
                  column,
                  direction:
                    current.column === column && current.direction === "asc"
                      ? "desc"
                      : "asc",
                }));
                setPage(1);
              }}
              onSearchSame={(description) => {
                setQuery(description);
                setCategory("all");
                setTxType("all");
                setStatus("all");
                setPage(1);
                requestAnimationFrame(() => {
                  document.getElementById("transaction-search")?.focus();
                });
              }}
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
      </FinanceSurface>
      <p className="view-footnote">
        Totais em BRL. Transferências não compõem o resultado do período.
      </p>
    </>
  );
}
export function MiniStat({
  label,
  value,
  icon,
  color,
  detail,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  detail?: string;
}) {
  return (
    <StatCard
      label={label}
      value={<Amount value={value} motion="reel" />}
      icon={icon}
      tone={color}
      hint={detail}
    />
  );
}
export function InvestmentsView({ data, month, category, openForm }: Props) {
  const stats = summarize(data, month, category);
  const all = data.investments;
  const fixed = stats.investments
    .filter((row) => row.type === "FIXED_INCOME")
    .reduce((n, row) => n + row.balance, 0);
  return (
    <>
      <div className="summary-grid">
        <MiniStat
          label="Patrimônio investido · BRL"
          value={stats.invested}
          icon={<Plant />}
          color="green"
        />
        <MiniStat
          label="Em renda fixa · BRL"
          value={fixed}
          icon={<ShieldCheck />}
          color="neutral"
        />
        <MiniStat
          label="Outros investimentos · BRL"
          value={stats.invested - fixed}
          icon={<ArrowUpRight />}
          color="amber"
        />
      </div>
      <FinanceSurface
        render={<section />}
        className="finance-card investment-page"
      >
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
            {all.map((row) => (
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
                    background: "var(--muted)",
                    color: "var(--foreground)",
                  }}
                >
                  <Plant size={21} />
                </span>
                <div>
                  <h3>{row.name}</h3>
                  <p>
                    {row.institution} <span>·</span>{" "}
                    {investmentTypes[row.type] || row.type}
                  </p>
                </div>
                <div className="position-value">
                  <Amount value={row.balance} currency={row.currency} />
                  {row.invested != null && row.invested > 0 ? (
                    <small
                      className={
                        row.balance === row.invested
                          ? undefined
                          : row.balance > row.invested
                            ? "positive"
                            : "negative"
                      }
                    >
                      {row.balance === row.invested
                        ? "Sem variação"
                        : `${row.balance > row.invested ? "+" : ""}${(((row.balance - row.invested) / row.invested) * 100).toFixed(2).replace(".", ",")}% vs custo`}
                    </small>
                  ) : (
                    <small>
                      {row.source === "pluggy"
                        ? "Informe o custo para ver valorização"
                        : "Posição manual"}
                    </small>
                  )}
                </div>
                <CaretRight size={17} />
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
      </FinanceSurface>
      <p className="view-footnote">
        Saldos da última atualização. Totais em BRL.
      </p>
    </>
  );
}
export function GoalsView({ data, openForm, mutate, category }: Props) {
  const goals = data.goals.filter((goal) =>
    matchesCategoryFilter(goal.category, category),
  );
  const inProgressCount = goals.filter((goal) => !goal.completed).length;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selectedGoal = data.goals.find((goal) => goal.id === selectedId);
  return (
    <>
      <div className="section-top">
        <span>
          <strong>{inProgressCount}</strong>{" "}
          {inProgressCount === 1 ? "meta em progresso" : "metas em progresso"}
        </span>
      </div>
      {[false, true].map((completed) => {
        const sectionGoals = goals.filter(
          (goal) => Boolean(goal.completed) === completed,
        );
        return (
          <section key={String(completed)} className="goals-section">
            {completed && <h2>Metas concluídas</h2>}
            {sectionGoals.length ? (
              completed ? (
                <div className="completed-goals-scroll">
                  <table className="completed-goals-table">
                    <caption className="sr-only">Metas concluídas</caption>
                    <thead>
                      <tr>
                        <th scope="col">Meta</th>
                        <th scope="col">Categoria</th>
                        <th scope="col">Valor reservado</th>
                        <th scope="col">Valor da meta</th>
                        <th scope="col">Criada em</th>
                        <th scope="col">Concluída em</th>
                        <th scope="col">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...sectionGoals]
                        .sort((a, b) =>
                          (b.completedAt || "").localeCompare(
                            a.completedAt || "",
                          ),
                        )
                        .map((goal) => (
                          <GoalContextMenu
                            key={goal.id}
                            goal={goal}
                            openForm={openForm}
                            mutate={mutate}
                            row
                            onView={() => {
                              setSelectedId(goal.id);
                              setDetailsOpen(true);
                            }}
                          >
                            {(menu) => (
                              <>
                                <td>
                                  <button
                                    type="button"
                                    className="completed-goal-name"
                                    onClick={() => {
                                      setSelectedId(goal.id);
                                      setDetailsOpen(true);
                                    }}
                                  >
                                    {goal.imageSlug ? (
                                      <CategoryImage
                                        name={goal.imageSlug}
                                        size={36}
                                      />
                                    ) : (
                                      <Illustration
                                        name={assetNames[goal.icon] || "target"}
                                      />
                                    )}
                                    <span>{goal.name}</span>
                                  </button>
                                </td>
                                <td>{goal.category || "Sem categoria"}</td>
                                <td>
                                  <Amount value={goal.current} />
                                </td>
                                <td>
                                  <Amount value={goal.target} />
                                </td>
                                <td>{goalHistoryDate(goal.createdAt)}</td>
                                <td>{goalHistoryDate(goal.completedAt)}</td>
                                <td>{menu}</td>
                              </>
                            )}
                          </GoalContextMenu>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="goals-page-grid">
                  {sectionGoals.map((goal) => (
                    <GoalContextMenu
                      key={goal.id}
                      goal={goal}
                      openForm={openForm}
                      mutate={mutate}
                      onView={() => {
                        setSelectedId(goal.id);
                        setDetailsOpen(true);
                      }}
                    >
                      {(menu) => (
                        <GoalCard
                          actions={menu}
                          goal={goal}
                          categories={data.categories}
                          onDetails={() => {
                            setSelectedId(goal.id);
                            setDetailsOpen(true);
                          }}
                        />
                      )}
                    </GoalContextMenu>
                  ))}
                </div>
              )
            ) : (
              <p className="goals-empty">
                {completed
                  ? "Nenhuma meta concluída."
                  : "Nenhuma meta em andamento."}
              </p>
            )}
          </section>
        );
      })}
      <Dialog
        open={detailsOpen && !!selectedGoal}
        onOpenChange={setDetailsOpen}
        onOpenChangeComplete={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        {selectedGoal && <GoalDetails goal={selectedGoal} />}
      </Dialog>
    </>
  );
}
function goalHistoryDate(value: string | null) {
  if (!value) return "Não registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
function GoalDetails({ goal }: { goal: Goal }) {
  const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const remaining = Math.max(0, goal.target - goal.current);
  return (
    <DialogContent className="finance-dialog goal-details-dialog sm:max-w-[540px] p-7">
      <div className="goal-details-image">
        {goal.imageSlug ? (
          <CategoryImage name={goal.imageSlug} size={180} />
        ) : (
          <Illustration name={assetNames[goal.icon] || "target"} />
        )}
      </div>
      <DialogHeader>
        <div className="goal-details-status" data-completed={goal.completed}>
          {goal.completed ? "Concluída" : "Em andamento"}
        </div>
        <DialogTitle className="goal-details-title">{goal.name}</DialogTitle>
      </DialogHeader>
      <div className="goal-details-values">
        <div>
          <span>Valor reservado</span>
          <strong>
            <Amount value={goal.current} />
          </strong>
        </div>
        <div>
          <span>Valor da meta</span>
          <strong>
            <Amount value={goal.target} />
          </strong>
        </div>
      </div>
      <div className="goal-details-progress">
        <ProgressBar
          value={percent}
          label="Progresso da meta"
          tone={goal.current / goal.target >= 0.9 ? "positive" : "neutral"}
          className="progress-track"
        />
        <div className="goal-details-progress-label">
          <span>{percent}%</span>
          <span>
            Faltam <Amount value={remaining} />
          </span>
        </div>
      </div>
      <div className="goal-details-deadline">
        <span>Prazo</span>
        <span>
          {new Intl.DateTimeFormat("pt-BR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date(goal.deadline + "T12:00:00"))}
        </span>
      </div>
      <section
        className="goal-details-description"
        aria-label="Descrição da meta"
      >
        <h3>Descrição</h3>
        {goal.description ? (
          <GoalDescription text={goal.description} />
        ) : (
          <p className="muted">Sem descrição.</p>
        )}
      </section>
    </DialogContent>
  );
}
export function CategoriesHeader({
  categoryView,
  onCategoryViewChange,
  openForm,
}: {
  categoryView: CategoryViewState;
  onCategoryViewChange: (value: CategoryViewState) => void;
  openForm: Props["openForm"];
}) {
  return (
    <>
      <div className="page-heading-start">
        <CategoriesViewSelector
          categoryView={categoryView}
          onCategoryViewChange={onCategoryViewChange}
        />
      </div>
      {categoryView.view === "categories" && (
        <div className="page-heading-actions">
          <Button onClick={() => openForm({ resource: "categories" })}>
            <Plus size={16} />
            Nova categoria
          </Button>
        </div>
      )}
    </>
  );
}
function CategoriesViewSelector({
  categoryView,
  onCategoryViewChange,
}: {
  categoryView: CategoryViewState;
  onCategoryViewChange: (value: CategoryViewState) => void;
}) {
  return (
    <MotionSegmentedControl
      label="Visualização de categorias"
      value={categoryView.view}
      onChange={(view) =>
        onCategoryViewChange({
          view: view === "configuration" ? "configuration" : "categories",
          categoryId: "all",
        })
      }
      options={[
        ["categories", "Categorias"],
        ["configuration", "Configuração"],
      ]}
    />
  );
}
export function CategoriesView({
  data,
  openForm,
  mutate,
  categoryView,
  onCategoryViewChange,
}: Props & {
  categoryView: CategoryViewState;
  onCategoryViewChange: (value: CategoryViewState) => void;
}) {
  const categories = data.categories;
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data.transactions) {
      const name = row.category || "Sem categoria";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    for (const goal of data.goals) {
      const name = goal.category || "Sem categoria";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    for (const row of data.recurrings) {
      if (row.ignored) continue;
      const name = row.category || "Sem categoria";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return counts;
  }, [data.transactions, data.recurrings, data.goals]);
  if (categoryView.view === "configuration")
    return (
      <CategoryRulesTable
        data={data}
        mutate={mutate}
        categoryId={categoryView.categoryId}
        onCategoryChange={(categoryId) =>
          onCategoryViewChange({ view: "configuration", categoryId })
        }
      />
    );
  return (
    <>
      {categories.length ? (
        <div className="categories-page-grid">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              usage={usage.get(category.name) || 0}
              ruleCount={
                data.categoryRules.filter(
                  (rule) => rule.categoryId === category.id,
                ).length
              }
              onEdit={() =>
                openForm({ resource: "categories", record: record(category) })
              }
            />
          ))}
        </div>
      ) : (
        <FinanceSurface render={<section />} className="finance-card">
          <Empty
            title="Nenhuma categoria"
            action={
              <Button onClick={() => openForm({ resource: "categories" })}>
                Criar categoria
              </Button>
            }
          />
        </FinanceSurface>
      )}
    </>
  );
}
function CategoryCard({
  category,
  usage,
  ruleCount,
  onEdit,
}: {
  category: Category;
  usage: number;
  ruleCount: number;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      className="category-card"
      onClick={onEdit}
      aria-label={`Editar ${category.name}`}
    >
      <CategoryMark
        name={category.name}
        size={40}
        color={category.color}
        imageSlug={category.imageSlug}
      />
      <div className="category-card-body">
        <h3>{category.name}</h3>
        <span className="category-card-origin">
          {category.name === "Sem categoria"
            ? "Protegida"
            : category.taxonomyKey
              ? "Padrão"
              : "Personalizada"}{" "}
          · {ruleCount} {ruleCount === 1 ? "regra" : "regras"}
        </span>
        <p>
          {usage === 0
            ? "Sem lançamentos"
            : usage === 1
              ? "1 lançamento"
              : `${usage} lançamentos`}
        </p>
      </div>
      <span
        className="category-card-swatch"
        style={{ background: category.color }}
        aria-hidden="true"
      />
    </button>
  );
}
export function AccountsHeader({
  data,
  openForm,
  syncing,
  onDemoChange,
}: Pick<Props, "data" | "openForm"> & {
  syncing: boolean;
  onDemoChange: (enabled: boolean) => void;
}) {
  return (
    <section className="connection-toolbar organization-header">
      <div className="connect-actions">
        <a
          href="https://meu.pluggy.ai/api-guide"
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "text-xs",
          })}
        >
          Guia
          <ArrowSquareOut size={13} />
        </a>
        <label className="demo-control">
          <span>Dados fictícios</span>
          <Switch
            aria-label="Dados fictícios"
            checked={data.mode === "demo"}
            disabled={syncing}
            className="demo-toggle"
            onCheckedChange={onDemoChange}
          >
            <SwitchThumb />
          </Switch>
        </label>
        <Button onClick={() => openForm({ resource: "connections" })}>
          <Plus size={15} />
          Adicionar conexão
        </Button>
      </div>
    </section>
  );
}
export function AccountsView({
  data,
  openForm,
  sync,
  syncing,
}: Props & {
  sync: () => void;
  syncing: boolean;
  onDemoChange: (enabled: boolean) => void;
}) {
  return (
    <>
      {(data.connections.length === 0 || !data.pluggyConfigured) && (
        <FinanceSurface
          render={<section />}
          className="finance-card setup-card"
        >
          <CardTitle title="Configuração" />
          <div className="setup-steps">
            <div>
              <span>1</span>
              <h3>Conectar bancos</h3>
              <p>Conecte seus bancos no Meu Pluggy.</p>
              <a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer">
                Abrir Meu Pluggy
                <ArrowSquareOut size={12} />
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
                <ArrowSquareOut size={12} />
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
        </FinanceSurface>
      )}
      <div className="accounts-layout">
        <FinanceSurface render={<section />} className="finance-card">
          <CardTitle title="Contas" subtitle="Saldos da instituição" />
          {data.accounts.length ? (
            <div className="bank-account-list">
              {data.accounts.map((account) => {
                const institution = displayInstitution(
                  account,
                  data.connections,
                );
                return (
                  <div className="bank-account" key={account.id}>
                    <span
                      className="bank-logo"
                      style={{ background: account.color }}
                    >
                      <InstitutionLogo institution={institution} size={38} />
                      <span className="bank-logo-fallback">
                        {institution.slice(0, 2).toLowerCase()}
                      </span>
                    </span>
                    <div>
                      <h3>{institution}</h3>
                      <p>
                        {account.name} ·{" "}
                        {account.type === "CREDIT"
                          ? "Cartão de crédito"
                          : /poupan/i.test(account.name)
                            ? "Poupança"
                            : "Conta"}
                      </p>
                    </div>
                    <strong>
                      <Amount
                        value={account.balance}
                        currency={account.currency}
                      />
                    </strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty title="Nenhuma conta" />
          )}
        </FinanceSurface>
        <FinanceSurface render={<section />} className="finance-card">
          <CardTitle
            title="Conexões"
            action={
              <button
                className="icon-button"
                aria-label="Sincronizar conexões"
                onClick={sync}
                disabled={syncing || data.mode === "demo"}
              >
                <ArrowsClockwise
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
                    <Bank size={19} />
                    <h3>{connection.name}</h3>
                    <StatusTag
                      tone={
                        connection.status === "UPDATED"
                          ? "success"
                          : connection.status === "ERROR"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {connection.status === "UPDATED"
                        ? "Atualizado"
                        : connection.status === "ERROR"
                          ? "Requer atenção"
                          : "Aguardando"}
                    </StatusTag>
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
              title="Nenhuma conexão"
              description="Adicione o itemId fornecido pela sua aplicação Pluggy."
              action={
                <Button
                  variant="outline"
                  onClick={() => openForm({ resource: "connections" })}
                >
                  <Plus size={15} />
                  Adicionar conexão
                </Button>
              }
            />
          )}
        </FinanceSurface>
      </div>
      <p className="view-footnote">
        Sincronização bancária a cada 24 h. Até 5 conexões pessoais.
      </p>
    </>
  );
}
