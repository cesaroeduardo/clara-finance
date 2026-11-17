import assert from "node:assert/strict";
import { test } from "node:test";
import { institutionLogoUrl } from "../src/lib/accounts";
import { merchantLogoUrl } from "../src/lib/merchants";
import { marketLogoUrl } from "../src/lib/market";

test("sem chave do Logo.dev usa fallbacks locais do demo", () => {
  const previous = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  try {
    assert.equal(institutionLogoUrl("Nubank"), "/institutions/nubank.png");
    assert.equal(institutionLogoUrl("Itaú"), "/institutions/itau.png");
    assert.equal(institutionLogoUrl("XP Investimentos"), "/institutions/xp.png");
    assert.equal(institutionLogoUrl("Clear"), "/institutions/clear.png");
    assert.equal(institutionLogoUrl("Sicredi"), "/institutions/sicredi.png");
    assert.equal(merchantLogoUrl("Uber"), "/merchants/uber.png");
    assert.equal(merchantLogoUrl("Netflix"), "/merchants/netflix.png");
    assert.equal(merchantLogoUrl("Alura"), "/merchants/alura.png");
    assert.equal(marketLogoUrl("ibov"), "/market/b3.png");
    assert.equal(marketLogoUrl("aapl"), "/market/apple.png");
    assert.equal(marketLogoUrl("bbas3"), "/market/bb.png");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY = previous;
  }
});
