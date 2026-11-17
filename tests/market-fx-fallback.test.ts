import assert from "node:assert/strict";
import { test } from "node:test";
import { demoFxFallbackQuotes } from "../src/lib/market-fx-fallback";
import { marketLogoUrl } from "../src/lib/market";

test("fallback do Mercado inclui dólar e Bitcoin com histórico", () => {
  const quotes = demoFxFallbackQuotes(new Date("2026-11-17T12:00:00.000Z"));
  assert.deepEqual(
    quotes.map((quote) => quote.id),
    ["usd", "btc"],
  );
  assert.equal(quotes[0].symbol, "USD");
  assert.equal(quotes[1].symbol, "BTC");
  assert.ok(quotes[0].history.length >= 20);
  assert.ok(quotes[1].history.length >= 20);
  assert.ok(quotes[0].price > 0);
  assert.ok(quotes[1].price > 0);
});

test("logos locais cobrem dólar e Bitcoin sem chave do Logo.dev", () => {
  const previous = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  try {
    assert.match(String(marketLogoUrl("usd")), /flagcdn|\/market\//);
    assert.equal(marketLogoUrl("btc"), "/market/bitcoin.png");
  } finally {
    if (previous === undefined)
      delete process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY = previous;
  }
});
