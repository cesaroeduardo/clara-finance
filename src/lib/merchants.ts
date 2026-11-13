import { normalizeText } from "./categorize";

const merchantDomains: ReadonlyArray<{ match: string; domain: string }> = [
  { match: "aplicacao rdb", domain: "nubank.com.br" },
  { match: "resgate rdb", domain: "nubank.com.br" },
  { match: "iof de compra internacional", domain: "nubank.com.br" },
  { match: "pagamento de fatura", domain: "nubank.com.br" },
  { match: "mercadolivre", domain: "mercadolivre.com.br" },
  { match: "mercado livre", domain: "mercadolivre.com.br" },
  { match: "steamgames", domain: "steampowered.com" },
  { match: "youtubepremium", domain: "youtube.com" },
  { match: "google youtub", domain: "youtube.com" },
  { match: "apple.com/bill", domain: "apple.com" },
  { match: "cursor, ai", domain: "cursor.com" },
  { match: "amazon credito", domain: "amazon.com.br" },
  { match: "vivo easy", domain: "vivo.com.br" },
  { match: "rge sul", domain: "rge-sul.com.br" },
  { match: "99app", domain: "99app.com" },
  { match: "ifd*", domain: "ifood.com.br" },
  { match: "uber", domain: "uber.com" },
  { match: "steam", domain: "steampowered.com" },
  { match: "netflix", domain: "netflix.com" },
  { match: "spotify", domain: "spotify.com" },
  { match: "openai", domain: "openai.com" },
  { match: "chatgpt", domain: "openai.com" },
  { match: "twitch", domain: "twitch.tv" },
  { match: "amazon", domain: "amazon.com.br" },
  { match: "cursor", domain: "cursor.com" },
  { match: "unifique", domain: "unifique.com.br" },
  { match: "ultramock", domain: "ultramock.com" },
  { match: "goomer", domain: "goomer.com.br" },
  { match: "livepix", domain: "livepix.gg" },
];

export type MerchantAsset = { match: string; src: string };

export function merchantAssetFor(
  description: string,
  assets: readonly MerchantAsset[] = [],
) {
  const text = normalizeText(description || "");
  for (const rule of assets) {
    if (text.includes(normalizeText(rule.match))) return rule.src;
  }
  return null;
}

export function merchantDomainFor(description: string) {
  const text = normalizeText(description || "");
  for (const rule of merchantDomains) {
    if (text.includes(normalizeText(rule.match))) return rule.domain;
  }
  return null;
}

export function merchantLogoUrl(
  description: string,
  size = 64,
  assets: readonly MerchantAsset[] = [],
) {
  const local = merchantAssetFor(description, assets);
  if (local) return local;
  const domain = merchantDomainFor(description);
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  if (!domain || !token) return null;
  const params = new URLSearchParams({
    token,
    size: String(size),
    format: "png",
    fallback: "404",
  });
  return `https://img.logo.dev/${domain}?${params.toString()}`;
}
