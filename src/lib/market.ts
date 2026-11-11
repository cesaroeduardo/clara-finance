export type MarketHistoryPoint = {
  date: string;
  price: number;
  changePct: number;
  high: number;
  low: number;
};

export type MarketQuote = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  changePct: number;
  series: number[];
  history: MarketHistoryPoint[];
  currency: "BRL" | "USD";
  unit?: "currency" | "percent" | "index";
  changeKnown?: boolean;
  positionCents?: number;
  costCents?: number | null;
};

type YahooInstrument = {
  id: string;
  name: string;
  symbol: string;
  yahoo: string;
  currency?: "BRL" | "USD";
  unit?: "currency" | "index";
};

/** Índices e papéis de referência sempre exibidos no Mercado. */
export const FEATURED_MARKETS: YahooInstrument[] = [
  {
    id: "ibov",
    name: "Ibovespa",
    symbol: "IBOV",
    yahoo: "^BVSP",
    unit: "index",
    currency: "BRL",
  },
  {
    id: "spx",
    name: "S&P 500",
    symbol: "SPX",
    yahoo: "^GSPC",
    unit: "index",
    currency: "USD",
  },
  {
    id: "nvda",
    name: "NVIDIA",
    symbol: "NVDA",
    yahoo: "NVDA",
    currency: "USD",
  },
];

type AwesomeQuote = {
  code?: string;
  bid: string;
  pctChange: string;
};

type AwesomeDaily = {
  bid: string;
  high?: string;
  low?: string;
  pctChange?: string;
  timestamp?: string;
  create_date?: string;
};

type YahooChart = {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        shortName?: string;
        longName?: string;
        regularMarketPrice: number;
        regularMarketChangePercent?: number;
        chartPreviousClose?: number;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: Array<number | null>;
          high: Array<number | null>;
          low: Array<number | null>;
        }>;
      };
    }> | null;
    error: unknown;
  };
};

const AWESOME_BASE = "https://economia.awesomeapi.com.br/json";
const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const TICKER_RE = /\b([A-Z]{4}\d{1,2}F?)\b/;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    next: { revalidate: 300 },
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 ClaraFinance/1.0",
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar cotação (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function dateFromDaily(row: AwesomeDaily) {
  if (row.create_date) return row.create_date.slice(0, 10);
  if (row.timestamp) {
    const date = new Date(Number(row.timestamp) * 1000);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    }
  }
  return "";
}

function parseAwesomeHistory(rows: AwesomeDaily[]): MarketHistoryPoint[] {
  return [...rows]
    .reverse()
    .map((row) => {
      const price = Number(row.bid);
      const changePct = Number(row.pctChange ?? 0);
      const high = Number(row.high ?? row.bid);
      const low = Number(row.low ?? row.bid);
      const date = dateFromDaily(row);
      if (!date || !Number.isFinite(price)) return null;
      return {
        date,
        price,
        changePct: Number.isFinite(changePct) ? changePct : 0,
        high: Number.isFinite(high) ? high : price,
        low: Number.isFinite(low) ? low : price,
      };
    })
    .filter((row): row is MarketHistoryPoint => row != null);
}

function historyFromValues(
  points: Array<{ date: string; price: number; high?: number; low?: number }>,
) {
  return points.map((point, index) => {
    const previous = points[index - 1]?.price;
    const changePct =
      previous && previous !== 0
        ? ((point.price - previous) / previous) * 100
        : 0;
    return {
      date: point.date,
      price: point.price,
      changePct,
      high: point.high ?? point.price,
      low: point.low ?? point.price,
    };
  });
}

function quoteFromHistory(
  id: string,
  name: string,
  symbol: string,
  history: MarketHistoryPoint[],
  extras?: Partial<MarketQuote>,
): MarketQuote | null {
  if (!history.length) return null;
  const last = history.at(-1)!;
  return {
    id,
    name,
    symbol,
    price: last.price,
    changePct: last.changePct,
    series: history.map((point) => point.price),
    history,
    currency: "BRL",
    unit: "currency",
    changeKnown: true,
    ...extras,
  };
}

function toFxQuote(
  id: string,
  name: string,
  symbol: string,
  quote: AwesomeQuote,
  history: MarketHistoryPoint[],
): MarketQuote {
  const price = Number(quote.bid);
  const changePct = Number(quote.pctChange);
  const safePrice = Number.isFinite(price) ? price : 0;
  return {
    id,
    name,
    symbol,
    price: safePrice,
    changePct: Number.isFinite(changePct) ? changePct : 0,
    series: history.length ? history.map((point) => point.price) : [safePrice],
    history,
    currency: "BRL",
    unit: "currency",
    changeKnown: true,
  };
}

export function extractEquityTickers(
  investments: ReadonlyArray<{
    name: string;
    type: string;
    balance: number;
    currency: string;
  }>,
) {
  const tickers = new Set<string>();
  for (const row of investments) {
    if (row.currency !== "BRL" || row.balance <= 0) continue;
    const match = row.name.toUpperCase().match(TICKER_RE);
    if (match) {
      tickers.add(match[1]);
      continue;
    }
    if (
      (row.type === "EQUITY" || row.type === "ETF") &&
      TICKER_RE.test(row.name.trim().toUpperCase())
    ) {
      tickers.add(row.name.trim().toUpperCase());
    }
  }
  return [...tickers].sort();
}

export function positionsForTicker(
  investments: ReadonlyArray<{
    name: string;
    balance: number;
    invested: number | null;
    currency: string;
  }>,
  ticker: string,
) {
  const needle = ticker.toUpperCase();
  return investments.filter(
    (row) =>
      row.currency === "BRL" && row.name.toUpperCase().includes(needle),
  );
}

export function positionCentsForTicker(
  investments: ReadonlyArray<{
    name: string;
    balance: number;
    invested: number | null;
    currency: string;
  }>,
  ticker: string,
) {
  return positionsForTicker(investments, ticker).reduce(
    (sum, row) => sum + row.balance,
    0,
  );
}

export function positionCostForTicker(
  investments: ReadonlyArray<{
    name: string;
    balance: number;
    invested: number | null;
    currency: string;
  }>,
  ticker: string,
) {
  const rows = positionsForTicker(investments, ticker).filter(
    (row) => row.invested != null && row.invested > 0,
  );
  if (!rows.length) return null;
  return rows.reduce((sum, row) => sum + (row.invested as number), 0);
}

export function positionReturnPct(balanceCents: number, costCents: number) {
  if (costCents <= 0) return null;
  return ((balanceCents - costCents) / costCents) * 100;
}

async function getYahooQuote(
  instrument: YahooInstrument,
  positionCents?: number,
): Promise<MarketQuote | null> {
  const data = await fetchJson<YahooChart>(
    `${YAHOO_CHART}/${encodeURIComponent(instrument.yahoo)}?range=1mo&interval=1d`,
    { headers: { "User-Agent": "Mozilla/5.0 ClaraFinance/1.0" } },
  );
  const result = data.chart.result?.[0];
  if (!result) return null;

  const closes = result.indicators.quote[0]?.close || [];
  const highs = result.indicators.quote[0]?.high || [];
  const lows = result.indicators.quote[0]?.low || [];
  const points: Array<{
    date: string;
    price: number;
    high: number;
    low: number;
  }> = [];

  result.timestamp.forEach((stamp, index) => {
    const close = closes[index];
    if (close == null || !Number.isFinite(close)) return;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(stamp * 1000));
    points.push({
      date,
      price: close,
      high: Number.isFinite(highs[index] as number)
        ? (highs[index] as number)
        : close,
      low: Number.isFinite(lows[index] as number)
        ? (lows[index] as number)
        : close,
    });
  });

  const history = historyFromValues(points);
  const live = result.meta.regularMarketPrice;
  if (Number.isFinite(live) && history.length) {
    const last = history.at(-1)!;
    if (last.price !== live) {
      const previous = last.price;
      history.push({
        date: new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
        price: live,
        changePct: previous ? ((live - previous) / previous) * 100 : 0,
        high: live,
        low: live,
      });
    } else if (
      Number.isFinite(result.meta.regularMarketChangePercent as number)
    ) {
      last.changePct = result.meta.regularMarketChangePercent as number;
    }
  }

  const remoteName =
    result.meta.shortName?.replace(/\s+/g, " ").trim() ||
    result.meta.longName ||
    "";
  const name =
    instrument.unit === "index" || instrument.currency === "USD"
      ? instrument.name
      : remoteName || instrument.name;

  return quoteFromHistory(instrument.id, name, instrument.symbol, history, {
    currency: instrument.currency || "BRL",
    unit: instrument.unit || "currency",
    positionCents,
    changePct: Number.isFinite(
      result.meta.regularMarketChangePercent as number,
    )
      ? (result.meta.regularMarketChangePercent as number)
      : history.at(-1)?.changePct || 0,
  });
}

function b3Instrument(ticker: string): YahooInstrument {
  return {
    id: ticker.toLowerCase(),
    name: ticker,
    symbol: ticker,
    yahoo: `${ticker}.SA`,
    currency: "BRL",
  };
}

async function getFxQuotes(): Promise<MarketQuote[]> {
  const [latest, usdDaily, btcDaily] = await Promise.all([
    fetchJson<Record<string, AwesomeQuote>>(
      `${AWESOME_BASE}/last/USD-BRL,BTC-BRL`,
    ),
    fetchJson<AwesomeDaily[]>(`${AWESOME_BASE}/daily/USD-BRL/30`),
    fetchJson<AwesomeDaily[]>(`${AWESOME_BASE}/daily/BTC-BRL/30`),
  ]);
  return [
    toFxQuote("usd", "Dólar", "USD", latest.USDBRL, parseAwesomeHistory(usdDaily)),
    toFxQuote("btc", "Bitcoin", "BTC", latest.BTCBRL, parseAwesomeHistory(btcDaily)),
  ];
}

export async function getMarketQuotes(options?: {
  tickers?: string[];
  positions?: Record<string, number>;
}): Promise<MarketQuote[]> {
  const tickers = [
    ...new Set((options?.tickers || []).map((t) => t.toUpperCase())),
  ]
    .filter((ticker) => TICKER_RE.test(ticker))
    .slice(0, 4);

  const portfolioPromises = tickers.map((ticker) =>
    getYahooQuote(
      b3Instrument(ticker),
      options?.positions?.[ticker],
    ).catch(() => null),
  );
  const featuredPromises = FEATURED_MARKETS.map((instrument) =>
    getYahooQuote(instrument).catch(() => null),
  );

  const [equities, featured, fx] = await Promise.all([
    Promise.all(portfolioPromises),
    Promise.all(featuredPromises),
    getFxQuotes().catch(() => [] as MarketQuote[]),
  ]);

  return [
    ...equities.filter((quote): quote is MarketQuote => quote != null),
    ...featured.filter((quote): quote is MarketQuote => quote != null),
    ...fx,
  ];
}

export function periodStats(history: MarketHistoryPoint[]) {
  if (!history.length) {
    return { high: 0, low: 0, changePct: 0, upDays: 0, downDays: 0 };
  }
  const prices = history.map((point) => point.price);
  const first = history[0].price;
  const last = history.at(-1)!.price;
  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    changePct: first ? ((last - first) / first) * 100 : 0,
    upDays: history.filter((point) => point.changePct > 0).length,
    downDays: history.filter((point) => point.changePct < 0).length,
  };
}
