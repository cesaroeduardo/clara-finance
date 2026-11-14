"use client";
import { FinanceSurface } from "@/components/ui/finance-surface";
import { ShellHeader } from "@/components/ui/surface";
import { PrivateValue } from "./finance-privacy";

import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartLineUp,
  CurrencyBtc,
  CurrencyDollar,
  Plant,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MotionSegmentedControl } from "./finance-motion";
import {
  extractEquityTickers,
  marketLogoConfig,
  marketLogoUrl,
  periodStats,
  positionCentsForTicker,
  positionCostForTicker,
  positionReturnPct,
  type MarketQuote,
} from "@/lib/market";
import type { FinanceData } from "@/lib/types";
import { dateLabel, money } from "@/lib/format";

type MarketPeriod = "today" | "month";

function quoteChangeForPeriod(quote: MarketQuote, period: MarketPeriod) {
  if (period === "month" && quote.history.length > 1) {
    return {
      changePct: periodStats(quote.history).changePct,
      changeKnown: true,
    };
  }
  return {
    changePct: quote.changePct,
    changeKnown: quote.changeKnown !== false,
  };
}

function formatMarketPrice(quote: MarketQuote) {
  if (quote.unit === "percent") {
    return `${quote.price.toFixed(2).replace(".", ",")}% a.a.`;
  }
  if (quote.unit === "index") {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: quote.price >= 1000 ? 0 : 2,
    }).format(quote.price);
  }
  if (quote.symbol === "BTC") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(quote.price);
  }
  if (quote.symbol === "USD") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(quote.price);
  }
  if (quote.currency === "USD") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(quote.price);
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(quote.price);
}

function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2).replace(".", ",")}%`;
}

function sparklinePath(values: number[], width: number, height: number) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return { x, y };
  });

  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const point = points[i];
    const cx = (prev.x + point.x) / 2;
    line += ` C ${cx} ${prev.y}, ${cx} ${point.y}, ${point.x} ${point.y}`;
  }

  const area = `${line} L ${points.at(-1)!.x} ${height} L ${points[0].x} ${height} Z`;
  return { line, area };
}

function TickerIcon({ id, size = 13 }: { id: string; size?: number }) {
  const src = marketLogoUrl(id, Math.max(44, size * 2));
  const fit = marketLogoConfig(id)?.fit || "cover";
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // Logo.dev: unoptimized / plain img — não passar pelo Image Optimization do Next.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`market-ticker-logo market-ticker-logo-${id} market-ticker-logo-${fit}`}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }
  if (id === "usd") return <CurrencyDollar size={size} weight="bold" />;
  if (id === "btc") return <CurrencyBtc size={size} weight="bold" />;
  if (id === "ibov" || id === "spx" || /^[a-z]{4}\d/.test(id)) {
    return <ChartLineUp size={size} weight="bold" />;
  }
  return <Plant size={size} weight="bold" />;
}

function toneOf(changePct: number, known = true) {
  if (!known || Math.abs(changePct) < 0.005) return "flat" as const;
  return changePct < 0 ? ("down" as const) : ("up" as const);
}

function strokeOf(tone: "up" | "down" | "flat") {
  if (tone === "up") return "var(--success)";
  if (tone === "down") return "var(--destructive)";
  return "var(--muted-foreground)";
}

function MarketTickerCard({
  quote,
  period,
  onOpen,
}: {
  quote: MarketQuote;
  period: MarketPeriod;
  onOpen: () => void;
}) {
  const gradientId = useId();
  const { changePct, changeKnown } = quoteChangeForPeriod(quote, period);
  const tone = toneOf(changePct, changeKnown);
  const stroke = strokeOf(tone);
  const path = sparklinePath(quote.series, 120, 36);

  return (
    <button
      type="button"
      className={`market-ticker market-ticker-${tone}`}
      onClick={onOpen}
    >
      <span className="market-ticker-icon" aria-hidden="true">
        <TickerIcon id={quote.id} />
      </span>
      <span className="market-ticker-copy">
        <strong>{quote.symbol}</strong>
        <span>
          <span className="market-ticker-symbol">{quote.name}</span>{" "}
          <span className="market-ticker-price">
            {formatMarketPrice(quote)}
          </span>{" "}
          <span className={`market-ticker-change ${tone}`}>
            {changeKnown ? formatPct(changePct) : "—"}
          </span>
        </span>
      </span>
      <span className="market-ticker-chart">
        {path ? (
          <svg viewBox="0 0 120 36" preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={path.area} fill={`url(#${gradientId})`} />
            <path
              d={path.line}
              fill="none"
              stroke={stroke}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
    </button>
  );
}

function MarketDialog({
  quote,
  open,
  onOpenChange,
}: {
  quote: MarketQuote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const gradientId = useId();
  const history = quote?.history ?? [];
  const stats = useMemo(() => periodStats(history), [history]);
  const isRate = quote?.unit === "percent";
  const tone = toneOf(quote?.changePct ?? 0, quote?.changeKnown !== false);
  const periodTone = toneOf(stats.changePct);
  const stroke = strokeOf(isRate ? tone : periodTone);
  const chartData = history.map((point) => ({
    date: point.date,
    value: point.price,
  }));
  const historyNewest = [...history].reverse();
  const returnPct =
    quote?.positionCents && quote.costCents != null && quote.costCents > 0
      ? positionReturnPct(quote.positionCents, quote.costCents) || 0
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="finance-dialog market-dialog sm:max-w-[520px] p-7">
        {quote && (
          <>
            <DialogHeader>
              <div className="market-dialog-heading">
                <span className="market-ticker-icon" aria-hidden="true">
                  <TickerIcon id={quote.id} size={18} />
                </span>
                <div>
                  <DialogTitle className="text-[22px] font-semibold tracking-tight">
                    {quote.symbol}
                  </DialogTitle>
                  <DialogDescription>
                    {quote.name}
                    {" · "}
                    {isRate ? "taxa anual" : "últimos 30 dias"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {quote.description && (
              <p className="market-dialog-about">{quote.description}</p>
            )}

            <div className="market-dialog-price">
              <strong>{formatMarketPrice(quote)}</strong>
              <span className={`market-ticker-change ${tone}`}>
                {quote.changeKnown !== false ? formatPct(quote.changePct) : "—"}
                {!isRate && <small> hoje</small>}
              </span>
            </div>

            {!!quote.positionCents && (
              <div className="market-dialog-position">
                <p>
                  Sua posição:{" "}
                  <PrivateValue as="strong" className="amount">
                    {money(quote.positionCents)}
                  </PrivateValue>
                </p>
                {quote.costCents != null && quote.costCents > 0 ? (
                  <p>
                    Custo:{" "}
                    <PrivateValue as="strong" className="amount">
                      {money(quote.costCents)}
                    </PrivateValue>
                    {" · "}
                    <PrivateValue
                      className={`amount market-ticker-change ${toneOf(returnPct || 0)}`}
                    >
                      {formatPct(returnPct || 0)} vs custo
                    </PrivateValue>
                  </p>
                ) : (
                  <p className="market-dialog-hint">
                    Informe o custo na ficha do investimento para ver a
                    valorização.
                  </p>
                )}
              </div>
            )}

            {chartData.length > 1 && (
              <div
                className="market-dialog-chart"
                role="img"
                aria-label={`Evolução de ${quote.symbol}`}
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
                  >
                    <defs>
                      <linearGradient
                        id={gradientId}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={stroke}
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor={stroke}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip
                      formatter={(value) => [
                        quote.unit === "percent"
                          ? `${Number(value).toFixed(2).replace(".", ",")}%`
                          : formatMarketPrice({
                              ...quote,
                              price: Number(value),
                            }),
                        quote.symbol,
                      ]}
                      labelFormatter={(label) => dateLabel(String(label))}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        fontSize: 11,
                        background: "var(--popover)",
                        color: "var(--foreground)",
                      }}
                    />
                    <Area
                      dataKey="value"
                      type="monotone"
                      isAnimationActive={false}
                      stroke={stroke}
                      strokeWidth={2}
                      fill={`url(#${gradientId})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {history.length > 0 && (
              <div className="market-dialog-stats">
                <div>
                  <span>Máxima</span>
                  <strong>
                    {formatMarketPrice({ ...quote, price: stats.high })}
                  </strong>
                </div>
                <div>
                  <span>Mínima</span>
                  <strong>
                    {formatMarketPrice({ ...quote, price: stats.low })}
                  </strong>
                </div>
                <div>
                  <span>No período</span>
                  <strong className={`market-ticker-change ${periodTone}`}>
                    {formatPct(stats.changePct)}
                  </strong>
                </div>
                <div>
                  <span>Dias</span>
                  <strong>
                    <span className="market-ticker-change up">
                      {stats.upDays}↑
                    </span>{" "}
                    <span className="market-ticker-change down">
                      {stats.downDays}↓
                    </span>
                  </strong>
                </div>
              </div>
            )}

            <div className="market-dialog-section">
              <h3>{isRate ? "Histórico da taxa" : "Movimento diário"}</h3>
              {historyNewest.length ? (
                <ul className="market-history-list">
                  {historyNewest.map((point) => {
                    const dayTone = toneOf(point.changePct);
                    return (
                      <li key={`${point.date}-${point.price}`}>
                        <span className="market-history-day">
                          <strong>{dateLabel(point.date)}</strong>
                          <small className={`market-day-tone ${dayTone}`}>
                            {dayTone === "up" ? (
                              <>
                                <ArrowUpRight size={12} /> Subiu
                              </>
                            ) : dayTone === "down" ? (
                              <>
                                <ArrowDownRight size={12} /> Desceu
                              </>
                            ) : (
                              "Estável"
                            )}
                          </small>
                        </span>
                        <span className="market-history-values">
                          <strong>
                            {formatMarketPrice({
                              ...quote,
                              price: point.price,
                            })}
                          </strong>
                          <small className={`market-ticker-change ${dayTone}`}>
                            {formatPct(point.changePct)}
                          </small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="market-dialog-empty">Sem histórico disponível.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MarketTickers({ data }: { data: FinanceData }) {
  const tickers = useMemo(
    () => extractEquityTickers(data.investments),
    [data.investments],
  );
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [period, setPeriod] = useState<MarketPeriod>("today");

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
      .then((payload) => {
        const withPositions = (payload.quotes || []).map((quote) => {
          if (!/^[A-Z]{4}\d/.test(quote.symbol)) return quote;
          return {
            ...quote,
            positionCents: positionCentsForTicker(
              data.investments,
              quote.symbol,
            ),
            costCents: positionCostForTicker(data.investments, quote.symbol),
          };
        });
        setQuotes(withPositions);
        setFailed(false);
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [tickers, data.investments]);

  const selected = quotes.find((quote) => quote.id === selectedId) || null;

  return (
    <FinanceSurface
      render={<section />}
      className="finance-card home-market"
      header={
        <ShellHeader
          as="h2"
          icon={ChartLineUp}
          title="Mercado"
          aside={
            failed && !quotes.length ? <span>Indisponível</span> : undefined
          }
        />
      }
    >
      {quotes.length ? (
        <>
          <div className="home-market-toolbar">
            <MotionSegmentedControl
              label="Período da variação"
              value={period}
              onChange={(value) => setPeriod(value as MarketPeriod)}
              options={[
                ["today", "Hoje"],
                ["month", "Mês"],
              ]}
            />
          </div>
          <div className="market-ticker-list">
            {quotes.map((quote) => (
              <MarketTickerCard
                key={quote.id}
                quote={quote}
                period={period}
                onOpen={() => setSelectedId(quote.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="home-empty market-ticker-empty">
          <Plant size={22} />
          <span>
            {failed
              ? "Não foi possível carregar cotações"
              : "Carregando cotações"}
          </span>
        </div>
      )}
      <MarketDialog
        quote={selected}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </FinanceSurface>
  );
}
