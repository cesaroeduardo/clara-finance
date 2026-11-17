import type { MarketHistoryPoint, MarketQuote } from "./market";

/** Série fictícia (~30 dias) para preview quando a AwesomeAPI falha. */
function fallbackHistory(
  endPrice: number,
  dayChanges: number[],
  endDate = new Date(),
): MarketHistoryPoint[] {
  const prices: number[] = [];
  let price = endPrice;
  for (let index = dayChanges.length - 1; index >= 0; index--) {
    prices.unshift(price);
    price = price / (1 + dayChanges[index] / 100);
  }
  return prices.map((value, index) => {
    const date = new Date(endDate);
    date.setDate(date.getDate() - (prices.length - 1 - index));
    const previous = prices[index - 1];
    const changePct =
      previous && previous !== 0 ? ((value - previous) / previous) * 100 : 0;
    return {
      date: date.toISOString().slice(0, 10),
      price: value,
      changePct,
      high: value * 1.004,
      low: value * 0.996,
    };
  });
}

function quoteFromFallback(
  id: string,
  name: string,
  symbol: string,
  history: MarketHistoryPoint[],
  description: string,
): MarketQuote {
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
    description,
  };
}

const USD_CHANGES = [
  0.12, -0.08, 0.21, -0.15, 0.05, 0.18, -0.22, 0.09, -0.11, 0.14, -0.06, 0.03,
  -0.19, 0.16, -0.04, 0.08, -0.13, 0.1, -0.07, 0.02, 0.15, -0.09, 0.06, -0.18,
  0.11, -0.05, 0.07, -0.02, 0.04,
];

const BTC_CHANGES = [
  1.2, -0.8, 2.1, -1.5, 0.6, 1.8, -2.4, 0.9, -1.1, 1.4, -0.7, 0.3, -1.9, 1.6,
  -0.4, 0.8, -1.3, 1.0, -0.9, 0.2, 1.5, -1.1, 0.7, -2.0, 1.3, -0.5, 0.9, -0.3,
  -1.53,
];

/** Dólar e Bitcoin usados no Mercado quando a cotação ao vivo não responde. */
export function demoFxFallbackQuotes(now = new Date()): MarketQuote[] {
  const usdHistory = fallbackHistory(5.78, USD_CHANGES, now);
  const btcHistory = fallbackHistory(373_000, BTC_CHANGES, now);
  return [
    quoteFromFallback(
      "usd",
      "Dólar",
      "USD",
      usdHistory,
      "Cotação ilustrativa do dólar em reais para o modo demo.",
    ),
    quoteFromFallback(
      "btc",
      "Bitcoin",
      "BTC",
      btcHistory,
      "Cotação ilustrativa do Bitcoin em reais para o modo demo.",
    ),
  ];
}
