"use client";
import { useContext, useEffect, useId, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowSquareOut,
  ArrowUpRight,
  ArrowsClockwise,
  ArrowsLeftRight,
  Bank,
  CalendarDots,
  CaretLeft,
  CaretRight,
  Check,
  Circle,
  CreditCard,
  DownloadSimple,
  DotsThree,
  Eye,
  Info,
  MagnifyingGlass,
  PencilSimple,
  Plant,
  Plus,
  ShieldCheck,
  Target,
  Wallet,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FinanceIcon, Illustration } from "./finance-icons";
import { PrivacyContext } from "./finance-privacy";
import {
  AnimatedLabel,
  LinkChevron,
  MotionSegmentedControl,
  SpinningAmount,
} from "./finance-motion";
import type { FormState, Mutate } from "./finance-form";
import type { Account, FinanceData, Goal, Transaction } from "@/lib/types";
import type { View } from "./finance-app";
import {
  filterTransactions,
  matchesGroupFilter,
  netWorth,
  spendingPace,
  summarize,
} from "@/lib/analytics";
import { colorForCategory, iconForCategory } from "@/lib/categorize";
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

function cardInvoiceTotal(
  data: FinanceData,
  accountId: string,
  month: string,
  pendingOnly = false,
) {
  return data.transactions
    .filter(
      (row) =>
        row.accountId === accountId &&
        row.currency === "BRL" &&
        row.kind === "expense" &&
        row.date.startsWith(month) &&
        (!pendingOnly || row.status === "pending"),
    )
    .reduce((total, row) => total + row.amount, 0);
}

type TransactionFilters = {
  groupId?: string;
  category?: string;
  type?: string;
};

type Props = {
  data: FinanceData;
  month: string;
  group: string;
  query: string;
  setQuery: (value: string) => void;
  txType: string;
  setTxType: (value: string) => void;
  txCategory: string;
  setTxCategory: (value: string) => void;
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
  if (hidden) {
    return <span className={`amount ${className}`.trim()}>••••••</span>;
  }
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
function StatusGlyph({
  tone,
}: {
  tone: "success" | "warning" | "muted";
}) {
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
    <span className={className}>
      <StatusGlyph tone={tone} />
      {children}
    </span>
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
        <Plant size={25} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function DashboardView(props: Props) {
  const { data, month, group, openForm, navigate, openTransactions } = props;
  const stats = summarize(data, month, group);
  const pace = spendingPace(data, month, group);
  const hidden = useContext(PrivacyContext);
  const reducedMotion = useReducedMotion();
  const [insightIndex, setInsightIndex] = useState(0);
  const [insightDir, setInsightDir] = useState(1);
  const confirmedIncome = stats.records
    .filter((row) => row.status === "paid" && row.kind === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const confirmedExpenses = stats.paid;
  const confirmedResult = confirmedIncome - confirmedExpenses;
  const bills = pendingBills(data, month, group);
  const featuredGoal =
    stats.goals.find((goal) => goal.icon === "shield") || stats.goals[0];
  const wealth = netWorth(data);
  const wealthFlow = wealth.series.map((point) => ({
    month: point.month,
    value: point.value / 100,
  }));
  const updateGoal = (goal: Goal) =>
    openForm({ resource: "goals", record: record(goal), contribute: true });
  const underPace = pace.paceDelta >= 0;
  const paceStroke = underPace ? "var(--success)" : "var(--destructive)";
  const paceFill = underPace
    ? "var(--success)"
    : "var(--destructive)";
  const todayPoint = pace.series.find((point) => point.day === pace.todayDay);
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
  const insights = [
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
      title: "Projeção de saldo",
      body: (
        <>
          Mantendo seu ritmo atual, em 3 meses você terá{" "}
          <strong>
            <Amount
              value={Math.abs(pace.projectedSurplus3m)}
              motion="reel"
            />{" "}
            {pace.projectedSurplus3m >= 0 ? "sobrando" : "a menos"}
          </strong>{" "}
          {pace.projectedSurplus3m >= 0
            ? "para usar como quiser."
            : "no limite planejado."}
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
        <section className="finance-card home-forecast">
          <div className="home-forecast-body">
            <div className="home-card-heading">
              <h2>Você ainda pode gastar</h2>
              <span title="Limite = entradas do mês menos o aporte estimado das metas. O ritmo ideal divide esse limite pelos dias do mês. A linha sólida projeta o gasto até o fim do mês no ritmo atual.">
                <Info size={14} aria-label="Cálculo do limite de gastos" />
              </span>
            </div>
            {pace.empty ? (
              <div className="home-pace-empty">
                <p>Sem entradas neste mês.</p>
              </div>
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
                  aria-label="Ritmo ideal, gasto acumulado e previsão até o fim do mês"
                  aria-hidden={hidden}
                >
                  {!hidden && (
                    <span
                      className={`home-pace-pill ${underPace ? "" : "over"}`.trim()}
                    >
                      <Amount value={Math.abs(pace.paceDelta)} motion="reel" />{" "}
                      {underPace ? "abaixo" : "acima"}
                    </span>
                  )}
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <ComposedChart
                      data={pace.series}
                      accessibilityLayer={!hidden}
                      margin={{ top: 28, right: 10, bottom: 0, left: 6 }}
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
                      <XAxis dataKey="day" hide domain={[1, pace.daysInMonth]} />
                      <YAxis hide domain={[0, "auto"]} />
                      {!hidden && (
                        <Tooltip
                          formatter={(value, name) => {
                            if (value == null) return [null, ""];
                            const label =
                              name === "ideal"
                                ? "Ritmo ideal"
                                : name === "forecast"
                                  ? "Previsão"
                                  : "Gasto";
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
                        dataKey="track"
                        type="monotone"
                        stroke="none"
                        fill="url(#home-pace-fill)"
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
                      <Line
                        dataKey="forecast"
                        type="linear"
                        stroke={paceStroke}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        strokeOpacity={0.7}
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
            <button
              type="button"
              className="home-pace-insight-head"
              onClick={() => openTransactions()}
            >
              <span>
                <Eye size={15} />
                <span className="home-pace-insight-title">
                  <AnimatePresence mode="wait" initial={false} custom={insightDir}>
                    <m.span
                      key={pace.empty ? "empty" : activeInsight.id}
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
                      {pace.empty ? "Ritmo de gastos" : activeInsight.title}
                    </m.span>
                  </AnimatePresence>
                </span>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <div className="home-pace-insight-body" aria-live="polite">
              <AnimatePresence mode="wait" initial={false} custom={insightDir}>
                <m.p
                  key={pace.empty ? "empty" : activeInsight.id}
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
                  {pace.empty ? (
                    <>
                      Cadastre entradas do mês para ver o ritmo e as projeções.
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
                disabled={pace.empty}
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
                    disabled={pace.empty}
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
                disabled={pace.empty}
              >
                <CaretRight size={14} />
              </button>
            </div>
          </div>
        </section>
        <button
          className="finance-card home-bills-summary"
          aria-label="Ver contas a pagar"
          onClick={() => {
            const card = document.getElementById("home-pending");
            card?.focus({ preventScroll: true });
            card?.scrollIntoView({ block: "nearest", behavior: "instant" });
          }}
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
              <Amount value={stats.pending} motion="reel" />
              {bills[0] && <span> · {dateLabel(bills[0].date)}</span>}
            </span>
          </span>
          <CaretRight size={17} />
        </button>
      </div>

      <SpendingDistribution
        data={data}
        month={month}
        group={group}
        navigate={navigate}
        openTransactions={openTransactions}
      />

      <div className="home-left-stack">
        <section className="finance-card home-result">
          <div className="home-card-heading">
            <h2>Resultado mensal</h2>
            <DashboardLink
              label="Ver lançamentos"
              onClick={() => openTransactions()}
            />
          </div>
          <div className="home-value-line">
            <strong className="home-amount">
              <Amount value={confirmedResult} motion="reel" />
            </strong>
            <span className="home-neutral-badge">Confirmado</span>
          </div>
          <div className="home-result-metrics">
            <div>
              <span>
                <ArrowDownLeft size={13} className="positive" />
                Entradas
              </span>
              <strong>
                <Amount value={confirmedIncome} motion="reel" />
              </strong>
            </div>
            <div>
              <span>
                <ArrowUpRight size={13} className="negative" />
                Saídas
              </span>
              <strong>
                <Amount value={confirmedExpenses} motion="reel" />
              </strong>
            </div>
          </div>
        </section>

        <section className="finance-card home-featured-goal">
          <div className="home-card-heading">
            <h2>{featuredGoal ? featuredGoal.name : "Meta em destaque"}</h2>
            <DashboardLink
              label="Ver metas"
              onClick={() => navigate("goals")}
            />
          </div>
          {featuredGoal ? (
            <>
              <div className="home-goal-main">
                <div>
                  <strong className="home-amount">
                    <Amount value={featuredGoal.current} motion="reel" />
                  </strong>
                  <span className="home-goal-target">
                    de <Amount value={featuredGoal.target} />
                  </span>
                  <span className="home-neutral-badge">
                    {Math.min(
                      100,
                      Math.round(
                        (featuredGoal.current / featuredGoal.target) * 100,
                      ),
                    )}
                    %
                  </span>
                </div>
                <div className="home-goal-ring" aria-hidden="true">
                  <svg viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="51"
                      fill="none"
                      stroke="var(--track)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="51"
                      fill="none"
                      stroke={featuredGoal.color}
                      strokeWidth="8"
                      pathLength="100"
                      strokeDasharray={`${Math.min(100, Math.max(0, (featuredGoal.current / featuredGoal.target) * 100))} 100`}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <Illustration
                    name={assetNames[featuredGoal.icon] || "target"}
                  />
                </div>
              </div>
              <div className="home-card-footer">
                <span>
                  Prazo: {dateLabel(featuredGoal.deadline)}{" "}
                  {featuredGoal.deadline.slice(0, 4)}
                </span>
                <button
                  className="text-link"
                  onClick={() => updateGoal(featuredGoal)}
                >
                  <Plus size={13} />
                  Atualizar
                </button>
              </div>
            </>
          ) : (
            <div className="home-empty">
              <Target size={25} />
              <span>Nenhuma meta</span>
              <Button
                variant="outline"
                onClick={() => openForm({ resource: "goals" })}
              >
                <Plus size={14} />
                Nova meta
              </Button>
            </div>
          )}
        </section>
      </div>

      <div className="home-middle-stack">
        <section className="finance-card home-wealth">
          <div className="home-card-heading">
            <h2>Patrimônio</h2>
            <DashboardLink
              label="Ver contas"
              onClick={() => navigate("accounts")}
            />
          </div>
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
                  <span
                    className={`home-growth-badge ${wealth.change < 0 ? "negative" : ""}`}
                  >
                    {hidden
                      ? "••••"
                      : `${wealth.change > 0 ? "+" : ""}${compactMoney(wealth.change)}`}
                  </span>
                )}
              </div>
              <div
                className="home-wealth-chart"
                role="img"
                aria-label="Evolução do patrimônio nos últimos meses"
                aria-hidden={hidden}
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart
                    data={wealthFlow}
                    accessibilityLayer={!hidden}
                    margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
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
        </section>

        <UpcomingCard {...props} />
      </div>

      <CreditCardsCard data={data} month={month} navigate={navigate} />
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

function pendingBills(data: FinanceData, month: string, group: string) {
  return data.transactions
    .filter(
      (row) =>
        row.kind === "expense" &&
        row.status === "pending" &&
        row.currency === "BRL" &&
        row.date.startsWith(month) &&
        matchesGroupFilter(row.groupId, group),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

function SpendingDistribution({
  data,
  month,
  group,
  navigate,
  openTransactions,
}: Pick<Props, "data" | "month" | "group" | "navigate" | "openTransactions">) {
  const [breakdown, setBreakdown] = useState("category");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const stats = summarize(data, month, group);
  const categories = new Map<
    string,
    {
      id: string;
      name: string;
      spent: number;
      color: string;
      icon: string;
      budget: number;
    }
  >();
  for (const row of stats.records.filter((row) => row.kind === "expense")) {
    const name = row.category || "Sem categoria";
    const category = categories.get(name);
    if (category) category.spent += row.amount;
    else {
      const parent = data.groups.find((item) => item.id === row.groupId);
      categories.set(name, {
        id: name,
        name,
        spent: row.amount,
        color: colorForCategory(name, categories.size),
        icon: iconForCategory(name, parent?.icon || "layers"),
        budget: 0,
      });
    }
  }
  const source =
    breakdown === "group"
      ? [
          ...stats.groups,
          ...(stats.expenses >
          stats.groups.reduce((sum, item) => sum + item.spent, 0)
            ? [
                {
                  id: "ungrouped",
                  name: "Sem grupo",
                  spent:
                    stats.expenses -
                    stats.groups.reduce((sum, item) => sum + item.spent, 0),
                  budget: 0,
                  color: "var(--chart-3)",
                  icon: "layers",
                },
              ]
            : []),
        ]
      : [...categories.values()];
  const visible = source.filter((item) => item.spent > 0 || item.budget > 0);
  const uncategorized = visible.find(
    (item) => item.name === "Sem categoria" || item.id === "Sem categoria",
  );
  const named = visible
    .filter(
      (item) => item.name !== "Sem categoria" && item.id !== "Sem categoria",
    )
    .sort((a, b) => b.spent - a.spent);
  const namedLimit = uncategorized ? 5 : 6;
  const items =
    named.length > namedLimit
      ? [
          ...named.slice(0, namedLimit),
          {
            id: "other",
            name: "Outros",
            spent: named
              .slice(namedLimit)
              .reduce((sum, item) => sum + item.spent, 0),
            budget: named
              .slice(namedLimit)
              .reduce((sum, item) => sum + item.budget, 0),
            color: colorForCategory("Outros"),
            icon: iconForCategory("Outros"),
          },
          ...(uncategorized ? [uncategorized] : []),
        ]
      : [...named, ...(uncategorized ? [uncategorized] : [])];
  const total = stats.expenses || 1;
  const slices = items.map((item, index) => {
    const start =
      (items.slice(0, index).reduce((sum, entry) => sum + entry.spent, 0) /
        total) *
      100;
    const end = start + (item.spent / total) * 100;
    return { ...item, start, end };
  });
  const hovered = slices.find((item) => item.id === hoveredId) ?? null;
  function openItem(item: (typeof items)[number]) {
    if (item.id === "other") {
      openTransactions({ type: "expense", category: "all", groupId: group });
      return;
    }
    if (breakdown === "group") {
      openTransactions({
        type: "expense",
        category: "all",
        groupId: item.id,
      });
      return;
    }
    openTransactions({
      type: "expense",
      category: item.name,
      groupId: group,
    });
  }
  return (
    <section className="finance-card home-distribution">
      <div className="home-card-heading">
        <h2>Distribuição dos gastos</h2>
        <div className="home-distribution-actions">
          <MotionSegmentedControl
            value={breakdown}
            onChange={(value) => {
              setBreakdown(value);
              setHoveredId(null);
            }}
            options={[
              ["category", "Categorias"],
              ["group", "Grupos"],
            ]}
            label="Distribuição por"
          />
          <DashboardLink
            label="Gerenciar grupos"
            onClick={() => navigate("groups")}
          />
        </div>
      </div>
      <div
        className="home-distribution-body"
        onMouseLeave={() => setHoveredId(null)}
      >
        <div className={`home-donut${hoveredId ? " is-filtering" : ""}`}>
          {slices.length ? (
            <svg
              className="home-donut-svg"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              {slices.map((item) => (
                <path
                  key={item.id}
                  className={`home-donut-slice${hoveredId === item.id ? " is-hovered" : ""}`}
                  d={donutSlicePath(50, 50, 48, 33, item.start, item.end)}
                  fill={item.color}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onClick={() => openItem(item)}
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
          className={`home-spending-list${hoveredId ? " is-filtering" : ""}`}
        >
          {items.length ? (
            items.map((item) => (
              <button
                type="button"
                className={`home-spending-row${hoveredId === item.id ? " is-hovered" : ""}`}
                key={item.id}
                onMouseEnter={() => setHoveredId(item.id)}
                onClick={() => openItem(item)}
              >
                <span
                  className="home-category-icon"
                  style={{
                    color: item.color,
                    background: `color-mix(in srgb, ${item.color} 16%, transparent)`,
                  }}
                >
                  <FinanceIcon name={item.icon} size={15} />
                </span>
                <strong>{item.name}</strong>
                <span className="home-percentage">
                  {Math.round((item.spent / total) * 100)}%
                </span>
                <span
                  className={`home-category-amount ${item.budget && item.spent > item.budget ? "negative" : ""}`}
                >
                  <Amount value={item.spent} />
                  {breakdown === "group" && item.budget > 0 && (
                    <small>
                      {" "}
                      / <Amount value={item.budget} />
                    </small>
                  )}
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
    </section>
  );
}

function CreditCardsCard({
  data,
  month,
  navigate,
}: {
  data: FinanceData;
  month: string;
  navigate: (view: View) => void;
}) {
  const cards = data.accounts.filter(
    (row) => row.type === "CREDIT" && row.currency === "BRL",
  );
  const [index, setIndex] = useState(0);
  const [forecastIndex, setForecastIndex] = useState(1);
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef(0);
  const dragRef = useRef({
    id: null as number | null,
    startX: 0,
    startScroll: 0,
    moved: false,
  });
  const activeIndex = Math.min(index, Math.max(0, cards.length - 1));
  const active = cards[activeIndex];
  const forecastMonths = ([-1, 0, 1] as const).map((offset) => {
    const key = shiftMonthKey(month, offset);
    const pending = active
      ? cardInvoiceTotal(data, active.id, key, true)
      : 0;
    const closed = active
      ? cardInvoiceTotal(data, active.id, key, false)
      : 0;
    // Passado: fatura fechada. Atual: saldo. Futuro: pendências.
    const amount =
      offset < 0
        ? closed
        : offset === 0 && active
          ? Math.abs(active.balance) || pending
          : pending;
    const monthLabel = shortMonthLabel(key);
    return {
      key,
      label:
        offset === 0
          ? monthLabel
          : `${monthLabel} ${key.slice(2, 4)}`,
      amount,
      open: offset === 0,
    };
  });
  const selected = forecastMonths[forecastIndex] || forecastMonths[1];

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
      setIndex((current) => (current === next ? current : next));
    };

    const onScrollEnd = () => sync();
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

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      dragRef.current = {
        id: event.pointerId,
        startX: event.clientX,
        startScroll: track.scrollLeft,
        moved: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.id !== event.pointerId) return;
      const delta = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(delta) > 4) {
        drag.moved = true;
        track.classList.add("dragging");
        track.setPointerCapture(event.pointerId);
      }
      if (!drag.moved) return;
      track.scrollLeft = drag.startScroll - delta;
    };

    const finishDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.id !== event.pointerId) return;
      const moved = drag.moved;
      dragRef.current = { ...drag, id: null };
      track.classList.remove("dragging");
      if (track.hasPointerCapture(event.pointerId))
        track.releasePointerCapture(event.pointerId);
      if (!moved) return;
      const next = nearestCardIndex();
      setIndex(next);
      setForecastIndex(1);
      scrollToCard(next, reduced ? "auto" : "smooth");
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
    <section className="finance-card home-cards" aria-label="Cartões">
      <div className="home-cards-top">
        <div className="home-cards-heading">
          <span className="home-muted">
            Fatura de{" "}
            {new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
              new Date(`${selected.key}-15T12:00:00`),
            )}
          </span>
        </div>
        <strong className="home-amount home-cards-amount">
          <Amount value={selected.amount} motion="reel" />
        </strong>
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
                    if (dragRef.current.moved) {
                      dragRef.current.moved = false;
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
    </section>
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
  const clipId = `chip-clip-${variant}-${reactId}`;

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
        <clipPath id={clipId}>
          <rect width="90" height="60" rx="7" />
        </clipPath>
      </defs>
      <rect width="90" height="60" rx="7" fill={`url(#${fillId})`} />
      <g
        clipPath={`url(#${clipId})`}
        transform="translate(90 0) rotate(90)"
        fill="none"
        stroke="#5f5343"
        strokeWidth="1.05"
        strokeLinejoin="round"
        strokeLinecap="butt"
      >
        {variant === "ultravioleta" ? (
          <>
            {/* Ref 1: laterais em 3 faixas + pad central arredondado */}
            <rect x="0.75" y="0.75" width="58.5" height="88.5" rx="7" />
            <path d="M13.5 0.75 V89.25" />
            <path d="M46.5 0.75 V89.25" />
            <path d="M30 0.75 V34.5" />
            <path d="M30 55.5 V89.25" />
            <path d="M13.5 34.5 H21" />
            <path d="M39 34.5 H46.5" />
            <path d="M13.5 55.5 H21" />
            <path d="M39 55.5 H46.5" />
            <rect x="21" y="34.5" width="18" height="21" rx="9" />
            <rect x="24.5" y="39" width="11" height="12" rx="1.2" />
          </>
        ) : (
          <>
            {/* Ref 2: padrão em H com cortes diagonais */}
            <rect x="0.75" y="0.75" width="58.5" height="88.5" rx="7" />
            <path d="M30 0.75 V26" />
            <path d="M30 64 V89.25" />
            <path d="M0.75 34 H21 L30 26 L39 34 H59.25" />
            <path d="M59.25 56 H39 L30 64 L21 56 H0.75" />
            <path d="M21 34 V56" />
            <path d="M39 34 V56" />
          </>
        )}
      </g>
    </svg>
  );
}

function NubankLogo({ id }: { id: string }) {
  return (
    <svg
      className="home-credit-nu"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
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
      viewBox="-32 -28 160 140"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="m87.156 52.94c-3.4348 2.8288-5.9942 3.3003-7.1392 2.1553-0.74058-0.74093-0.87549-2.2224-0.33657-4.1083 1.8184-5.9942 3.2325-12.056 4.3774-18.184 6.8697-3.0307 13.739-5.8593 21.35-6.6002-3.5694 9.7655-10.102 19.935-18.251 26.737zm-3.5023 20.137c-4.3103-0.87549-6.3308-2.761-6.1959-4.4449 0.06711-1.0775 1.0775-2.155 2.8285-2.8959 5.3878-2.2899 10.709-4.7818 15.759-7.8126 6.6677 3.2328 13.066 7.3412 18.184 12.527-9.3612 3.5023-20.878 4.6472-30.576 2.6265zm-17.78 10.641c-2.0879-4.3103-1.8859-7.2734-0.53892-8.2838 0.94294-0.67348 2.4245-0.53892 4.1083 0.40402 5.2533 2.9634 10.574 5.6573 16.231 7.8797v0.06745c2.0204 8.0817 3.2328 16.568 2.6939 24.919-9.3612-5.9268-17.847-15.355-22.494-24.987zm-20.137-7.7448c2.357-4.7147 4.8489-6.5331 6.5328-5.9942 1.1449 0.33691 1.953 1.6164 2.2224 3.7043 0.94294 6.6002 2.3573 13.066 4.0409 19.464-5.8593 7.8797-12.123 15.49-20.003 21.686-0.87549-12.729 1.5493-27.344 7.2066-38.86zm-6.0617-21.754c5.3207-1.0778 8.2166-0.20201 8.8901 1.4815 0.40402 1.0775-0.13456 2.5594-1.6164 4.1758-4.9838 5.1858-9.5636 10.641-13.941 16.298h-0.06735c-10.708 0.74058-21.888 0.33657-32.395-2.1553 10.708-9.0247 25.188-17.039 39.13-19.8zm13.604-17.645c3.9738 3.4345 5.0513 6.1288 4.1758 7.6103-0.60603 0.94294-2.0204 1.4144-4.1758 1.2124-7.1388-0.80838-14.278-1.1449-21.484-1.1449-6.8022-7.8126-12.998-16.501-16.972-25.862 13.537 3.0307 28.084 9.3615 38.456 18.184zm21.148 0.26912c0 4.8493-1.347 7.2737-2.9634 7.4086-1.0775 0.13456-2.2899-0.74093-3.4348-2.4919-3.6369-5.6573-7.6103-11.113-11.853-16.433 1.6161-8.486 4.2429-17.107 8.7552-24.582 5.6573 10.843 9.5636 24.044 9.4962 36.099z"
      />
      <path
        fill="currentColor"
        opacity="0.78"
        d="m56.172 25.261c1.6164-8.4186 4.2429-17.039 8.7552-24.515-9.6307-1.347-19.531-0.20205-28.556 3.1654 5.5227 5.3879 10.978 10.843 15.894 16.703 0.5742 0.69489 1.1889 1.4169 1.7956 2.1295 0.74577 0.87594 1.4794 1.7377 2.1107 2.5175zm30.51-16.902c-0.40402 6.4655-0.87549 12.864-1.8184 19.194-0.11207 0.70157-0.22449 1.4616-0.33657 2.2216-0.15739 1.064-0.31443 2.128-0.47147 3.0316 6.8693-3.0307 13.739-5.8593 21.349-6.6002-4.7815-7.2063-11.18-13.335-18.723-17.847zm27.138 37.309c-4.3778 3.4348-8.8901 6.8022-13.672 9.6982-0.60949 0.36562-1.2463 0.77275-1.88 1.1775l-3.46e-4 3.46e-4c-0.76618 0.48946-1.5272 0.9758-2.228 1.3815 6.6677 3.2325 13.066 7.3408 18.184 12.527 1.2124-8.5532 1.145-16.231-0.40401-24.784zm-23.51 39.802c5.2533 1.9533 10.709 3.4348 16.163 4.7818-4.5123 7.2737-10.708 13.672-18.049 18.454 0.53892-8.3512-0.67348-16.837-2.6939-24.919v-0.06745c1.1183 0.50329 2.5154 1.0066 3.8057 1.4715l6.92e-4 3.46e-4h3.46e-4c0.26323 0.09478 0.52197 0.18783 0.7731 0.27914zm-23.231 31.519c-2.559-6.1288-4.9838-12.325-6.9368-18.521-0.13975-0.45452-0.28849-0.92668-0.43965-1.4058v-1e-3l-3.45e-4 -3.45e-4v-3.46e-4c-0.43065-1.366-0.87722-2.7839-1.1764-3.9803-5.8593 7.8797-12.123 15.49-19.935 21.686 9.429 2.7614 18.656 3.9734 28.488 2.2224zm-37.775-35.624c-4.5797 6.3979-8.7553 13.268-12.729 20.137-7.8125-7.6106-13.335-17.174-16.029-27.478 10.506 2.4919 21.686 2.8959 32.395 2.155h0.06735c-0.68697 0.92945-1.4467 2.0045-2.2064 3.0793l-5.53e-4 1e-3 -6.57e-4 6.92e-4c-0.50606 0.71602-1.0121 1.4321-1.4966 2.1052zm-29.303-34.823c8.4186-1.0104 16.905-1.8859 25.256-2.1553 0.70665-0.02179 1.4495-0.05119 2.1953-0.0806h5.19e-4c1.5286-0.06053 3.0697-0.12141 4.337-0.12141-6.8696-7.7448-12.998-16.433-16.972-25.794-7.4757 7.8798-12.594 17.713-14.817 28.152z"
      />
    </svg>
  );
}

function VisaMark() {
  return (
    <svg
      className="home-credit-visa"
      viewBox="0 7.8 24 8.2"
      aria-hidden="true"
    >
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
  const selected = points[selectedIndex];
  const trend = points.map((point) => `${point.x},${point.y}`).join(" ");
  const selectedLeft = chart?.lefts[selectedIndex] ?? 0;
  const fillPath =
    chart && selected
      ? [
          `M ${selectedLeft} ${selected.y}`,
          `L ${selected.x} ${selected.y}`,
          `L ${selected.x} ${chart.height}`,
          `L ${selectedLeft} ${chart.height}`,
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
          {selected && (
            <path d={fillPath} fill={`url(#${fillId})`} />
          )}
          {points.length > 1 && (
            <polyline
              className="home-cards-forecast-path is-dashed"
              fill="none"
              points={trend}
            />
          )}
          {selected && (
            <line
              className="home-cards-forecast-path is-solid"
              x1={selectedLeft}
              y1={selected.y}
              x2={selected.x}
              y2={selected.y}
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
            <strong>Sicredi</strong>
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

function UpcomingCard({
  data,
  month,
  group,
  openForm,
  mutate,
  openTransactions,
}: Props) {
  const [day, setDay] = useState("all"),
    [busy, setBusy] = useState("");
  const bills = pendingBills(data, month, group);
  const dates = [...new Set(bills.map((row) => row.date.slice(8, 10)))];
  const activeDay = dates.includes(day) ? day : "all";
  const filtered =
    activeDay === "all"
      ? bills
      : bills.filter((row) => row.date.endsWith(`-${activeDay}`));
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
    <section
      className="finance-card home-pending"
      id="home-pending"
      tabIndex={-1}
      aria-label="Contas a pagar"
    >
      <div className="home-card-heading">
        <h2>Contas a pagar</h2>
        <DashboardLink
          label="Ver todos os lançamentos"
          onClick={() => openTransactions({ type: "expense" })}
        />
      </div>
      <strong className="home-amount">
        <Amount
          value={bills.reduce((sum, row) => sum + row.amount, 0)}
          motion="reel"
        />
      </strong>
      <span className="home-muted">
        {bills.length} {bills.length === 1 ? "pendente" : "pendentes"}
      </span>
      {dates.length > 0 && (
        <div className="home-due-tabs" role="group" aria-label="Vencimento">
          <button
            aria-pressed={activeDay === "all"}
            onClick={() => setDay("all")}
          >
            Todas
          </button>
          {dates.slice(0, 4).map((date) => (
            <button
              key={date}
              aria-pressed={activeDay === date}
              onClick={() => setDay(date)}
            >
              {date}
            </button>
          ))}
        </div>
      )}
      <div className="home-bill-list">
        {filtered.length ? (
          filtered.slice(0, 6).map((bill) => (
            <div className="home-bill-row" key={bill.id}>
              <button
                className="home-bill-check"
                aria-label={
                  bill.source === "manual"
                    ? `Marcar ${bill.description} como confirmado`
                    : `Editar categoria de ${bill.description}`
                }
                disabled={busy === bill.id}
                onClick={() => markPaid(bill)}
              >
                <Circle size={19} />
              </button>
              <button
                className="home-bill-description"
                onClick={() =>
                  openForm({ resource: "transactions", record: record(bill) })
                }
              >
                <strong>{bill.description}</strong>
                <span className={bill.date < localDate() ? "negative" : ""}>
                  {dateLabel(bill.date)}
                  {bill.date < localDate() ? " · Em atraso" : ""}
                </span>
              </button>
              <strong>
                <Amount value={bill.amount} />
              </strong>
            </div>
          ))
        ) : (
          <div className="home-empty">
            <ShieldCheck size={26} />
            <span>Nenhuma conta pendente</span>
          </div>
        )}
      </div>
      <div className="home-card-footer">
        <span>Vencimentos do mês</span>
        <TextLink onClick={() => openTransactions({ type: "expense" })}>
          Ver todos
        </TextLink>
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
            <DotsThree size={18} />
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
                        <ArrowsLeftRight size={17} />
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
                    <i style={{ background: g?.color || "#8a8f98" }} />
                    {g?.name || "Sem grupo"}
                  </span>
                </td>
                {!compact && (
                  <td className="muted">{account?.institution || "Manual"}</td>
                )}
                <td className="table-date">{dateLabel(row.date)}</td>
                <td>
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
export function TransactionsView(props: Props) {
  const {
    data,
    month,
    group,
    query,
    setQuery,
    txType,
    setTxType,
    txCategory,
    setTxCategory,
    openForm,
  } = props;
  const [status, setStatus] = useState("all"),
    [page, setPage] = useState(1);
  const stats = summarize(data, month, group);
  const baseRows = data.transactions.filter(
    (row) =>
      row.date.startsWith(month) && matchesGroupFilter(row.groupId, group),
  );
  const categories = [
    ...new Set(
      baseRows.map((row) => row.category || "Sem categoria").filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filtered = filterTransactions(
    baseRows,
    query,
    txType,
    status,
    txCategory,
  );
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
          color="neutral"
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
            value={txType}
            onChange={(e) => {
              setTxType(e.target.value);
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
            aria-label="Filtrar por categoria"
            value={txCategory}
            onChange={(e) => {
              setTxCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todas as categorias</option>
            {categories.map((name) => (
              <option value={name} key={name}>
                {name}
              </option>
            ))}
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
          <Amount value={value} motion="reel" />
        </strong>
      </div>
    </div>
  );
}
export function InvestmentsView({ data, month, group, openForm }: Props) {
  const stats = summarize(data, month, group);
  const all = data.investments.filter((row) =>
    matchesGroupFilter(row.groupId, group),
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
      </section>
      <p className="view-footnote">
        Saldos da última atualização. Totais em BRL.
      </p>
    </>
  );
}
export function GoalsView({ data, group, openForm }: Props) {
  const goals = data.goals.filter((g) => matchesGroupFilter(g.groupId, group));
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
                  <DotsThree size={20} />
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
                <Amount value={g.spent} motion="reel" />
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
                <CaretRight size={14} />
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
}: Props & {
  sync: () => void;
  syncing: boolean;
}) {
  return (
    <>
      <section className="finance-card connection-toolbar">
        <h2>Open Finance</h2>
        <div className="connect-actions">
          <Button onClick={() => openForm({ resource: "connections" })}>
            <Plus size={15} />
            Adicionar conexão
          </Button>
          <a
            href="https://meu.pluggy.ai/api-guide"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Guia
            <ArrowSquareOut size={13} />
          </a>
        </div>
      </section>
      {(data.connections.length === 0 || !data.pluggyConfigured) && (
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
        </section>
      )}
      <div className="accounts-layout">
        <section className="finance-card">
          <CardTitle title="Contas" subtitle="Saldos da instituição" />
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
        </section>
      </div>
      <p className="view-footnote">
        Sincronização bancária a cada 24 h. Até 5 conexões pessoais.
      </p>
    </>
  );
}
