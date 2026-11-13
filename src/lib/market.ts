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
  description?: string;
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
  description: string;
};

type MarketLogoConfig = {
  /** Domínio ou path Logo.dev (`apple.com`, `index/SPX`). */
  domain?: string;
  /** URL pronta (bandeiras etc.), sem Logo.dev. */
  src?: string;
  /** Ajuste Logo.dev para fundo claro/escuro (png/webp). */
  theme?: "light" | "dark" | "auto";
  greyscale?: boolean;
  /** Como o PNG encaixa no avatar. */
  fit?: "cover" | "contain";
};

function flagCdnUrl(country: "br" | "us", size: number) {
  const width = size <= 40 ? 40 : size <= 80 ? 80 : 160;
  return `https://flagcdn.com/w${width}/${country}.png`;
}

/** Logos por id/símbolo do indicador. */
export const MARKET_LOGOS: Record<string, MarketLogoConfig> = {
  aapl: { domain: "apple.com", theme: "light", fit: "contain" },
  nvda: { domain: "nvidia.com" },
  bbas3: { domain: "bb.com.br", theme: "light", fit: "contain" },
  cpfe3: { domain: "cpfl.com.br" },
  ibov: { src: "flag:br", fit: "cover" },
  spx: { src: "flag:us", fit: "cover" },
  spacex: { domain: "spacex.com" },
};

const KNOWN_B3: Record<
  string,
  { name: string; description: string }
> = {
  BBAS3: {
    name: "Banco do Brasil",
    description:
      "Ação do Banco do Brasil na B3. Cotação via Yahoo Finance.",
  },
  CPFE3: {
    name: "CPFL",
    description:
      "Ação da CPFL Energia na B3. Cotação via Yahoo Finance.",
  },
};

/** Ordem fixa dos indicadores no Mercado. */
export const MARKET_QUOTE_ORDER = [
  "usd",
  "btc",
  "bbas3",
  "cpfe3",
  "ibov",
  "spx",
  "nvda",
  "aapl",
] as const;

/** Papéis de referência sempre exibidos no Mercado. */
export const FEATURED_MARKETS: YahooInstrument[] = [
  {
    id: "bbas3",
    name: "Banco do Brasil",
    symbol: "BBAS3",
    yahoo: "BBAS3.SA",
    currency: "BRL",
    description: KNOWN_B3.BBAS3.description,
  },
  {
    id: "cpfe3",
    name: "CPFL",
    symbol: "CPFE3",
    yahoo: "CPFE3.SA",
    currency: "BRL",
    description: KNOWN_B3.CPFE3.description,
  },
  {
    id: "ibov",
    name: "Ibovespa",
    symbol: "IBOV",
    yahoo: "^BVSP",
    unit: "index",
    currency: "BRL",
    description:
      "Índice da B3 com as ações mais negociadas do Brasil. Cotação via Yahoo Finance.",
  },
  {
    id: "spx",
    name: "S&P 500",
    symbol: "SPX",
    yahoo: "^GSPC",
    unit: "index",
    currency: "USD",
    description:
      "Índice das 500 maiores empresas listadas nos EUA. Cotação via Yahoo Finance.",
  },
  {
    id: "nvda",
    name: "NVIDIA",
    symbol: "NVDA",
    yahoo: "NVDA",
    currency: "USD",
    description:
      "Ação da NVIDIA na Nasdaq (EUA). Cotação via Yahoo Finance.",
  },
  {
    id: "aapl",
    name: "Apple",
    symbol: "AAPL",
    yahoo: "AAPL",
    currency: "USD",
    description:
      "Ação da Apple na Nasdaq (EUA). Cotação via Yahoo Finance.",
  },
];

export function marketLogoConfig(idOrSymbol: string) {
  return MARKET_LOGOS[idOrSymbol.toLowerCase()] || null;
}

export function marketLogoUrl(idOrSymbol: string, size = 64) {
  const config = marketLogoConfig(idOrSymbol);
  if (!config) return null;
  if (config.src === "flag:br") return flagCdnUrl("br", size);
  if (config.src === "flag:us") return flagCdnUrl("us", size);
  if (config.src) return config.src;
  if (!config.domain) return null;
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  if (!token) return null;
  const params = new URLSearchParams({
    token,
    size: String(size),
    format: "png",
    fallback: "404",
    retina: "true",
  });
  if (config.theme) params.set("theme", config.theme);
  if (config.greyscale) params.set("greyscale", "true");
  return `https://img.logo.dev/${config.domain}?${params.toString()}`;
}

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
  description: string,
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
    description,
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
  const knownB3 = KNOWN_B3[instrument.symbol.toUpperCase()];
  const name =
    instrument.unit === "index" ||
    instrument.currency === "USD" ||
    knownB3
      ? instrument.name
      : remoteName || instrument.name;

  return quoteFromHistory(instrument.id, name, instrument.symbol, history, {
    currency: instrument.currency || "BRL",
    unit: instrument.unit || "currency",
    description: instrument.description,
    positionCents,
    changePct: Number.isFinite(
      result.meta.regularMarketChangePercent as number,
    )
      ? (result.meta.regularMarketChangePercent as number)
      : history.at(-1)?.changePct || 0,
  });
}

function b3Instrument(ticker: string): YahooInstrument {
  const known = KNOWN_B3[ticker.toUpperCase()];
  return {
    id: ticker.toLowerCase(),
    name: known?.name || ticker,
    symbol: ticker,
    yahoo: `${ticker}.SA`,
    currency: "BRL",
    description:
      known?.description ||
      "Ação listada na B3, a bolsa de valores do Brasil. Cotação via Yahoo Finance.",
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
    toFxQuote(
      "usd",
      "Dólar",
      "USD",
      latest.USDBRL,
      parseAwesomeHistory(usdDaily),
      "Cotação do dólar americano em reais. Fonte: AwesomeAPI.",
    ),
    toFxQuote(
      "btc",
      "Bitcoin",
      "BTC",
      latest.BTCBRL,
      parseAwesomeHistory(btcDaily),
      "Cotação do Bitcoin em reais. Fonte: AwesomeAPI.",
    ),
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

  const byId = new Map<string, MarketQuote>();
  for (const quote of [
    ...featured.filter((row): row is MarketQuote => row != null),
    ...fx,
    // Carteira por último para preservar posição/custo em tickers duplicados.
    ...equities.filter((row): row is MarketQuote => row != null),
  ]) {
    const previous = byId.get(quote.id);
    byId.set(
      quote.id,
      previous
        ? {
            ...quote,
            positionCents: quote.positionCents ?? previous.positionCents,
            costCents: quote.costCents ?? previous.costCents,
          }
        : quote,
    );
  }

  const ordered: MarketQuote[] = [];
  for (const id of MARKET_QUOTE_ORDER) {
    const quote = byId.get(id);
    if (!quote) continue;
    ordered.push(quote);
    byId.delete(id);
  }
  return [...ordered, ...byId.values()];
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
