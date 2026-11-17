import { normalizeText } from "./categorize";

const merchantDomains: ReadonlyArray<{ match: string; domain: string }> = [
  { match: "aplicacao rdb", domain: "nubank.com.br" },
  { match: "resgate rdb", domain: "nubank.com.br" },
  { match: "iof de compra internacional", domain: "nubank.com.br" },
  { match: "pagamento de fatura", domain: "nubank.com.br" },
  { match: "mercadolivre", domain: "mercadolivre.com.br" },
  { match: "mercado livre", domain: "mercadolivre.com.br" },
  { match: "magazine luiza", domain: "magazineluiza.com.br" },
  { match: "magalu", domain: "magazineluiza.com.br" },
  { match: "steamgames", domain: "steampowered.com" },
  { match: "youtubepremium", domain: "youtube.com" },
  { match: "google youtub", domain: "youtube.com" },
  { match: "youtube premium", domain: "youtube.com" },
  { match: "apple.com/bill", domain: "apple.com" },
  { match: "apple", domain: "apple.com" },
  { match: "iphone", domain: "apple.com" },
  { match: "cursor, ai", domain: "cursor.com" },
  { match: "amazon credito", domain: "amazon.com.br" },
  { match: "vivo easy", domain: "vivo.com.br" },
  { match: "rge sul", domain: "rge-rs.com.br" },
  { match: "rge", domain: "rge-rs.com.br" },
  { match: "cpfl", domain: "grupocpfl.com.br" },
  { match: "99app", domain: "99app.com" },
  { match: "99 app", domain: "99app.com" },
  { match: "ifd*", domain: "ifood.com.br" },
  { match: "ifood", domain: "ifood.com.br" },
  { match: "uber eats", domain: "ubereats.com" },
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
  { match: "vivo", domain: "vivo.com.br" },
  { match: "smart fit", domain: "smartfit.com.br" },
  { match: "smartfit", domain: "smartfit.com.br" },
  { match: "amil", domain: "amil.com.br" },
  { match: "carrefour", domain: "carrefour.com.br" },
  { match: "shell", domain: "shell.com.br" },
  { match: "droga raia", domain: "drogaraia.com.br" },
  { match: "drogaraia", domain: "drogaraia.com.br" },
  { match: "starbucks", domain: "starbucks.com" },
  { match: "outback", domain: "outback.com" },
  { match: "latam", domain: "latamairlines.com" },
  { match: "voegol", domain: "voegol.com.br" },
  { match: "gol ", domain: "voegol.com.br" },
  { match: "ultramock", domain: "ultramock.com" },
  { match: "goomer", domain: "goomer.com.br" },
  { match: "livepix", domain: "livepix.gg" },
  { match: "adobe", domain: "adobe.com" },
  { match: "alura", domain: "alura.com.br" },
  { match: "petz", domain: "petz.com.br" },
];

/** Fallback local (demo/preview) quando não há chave do Logo.dev. */
const merchantLocalLogos: Record<string, string> = {
  "nubank.com.br": "/merchants/nubank.png",
  "smartfit.com.br": "/merchants/smartfit.png",
  "amil.com.br": "/merchants/amil.png",
  "carrefour.com.br": "/merchants/carrefour.png",
  "starbucks.com": "/merchants/starbucks.png",
  "uber.com": "/merchants/uber.png",
  "netflix.com": "/merchants/netflix.png",
  "rge-rs.com.br": "/merchants/rge.png",
  "unifique.com.br": "/merchants/unifique.png",
  "spotify.com": "/merchants/spotify.png",
  "apple.com": "/merchants/apple.png",
  "magazineluiza.com.br": "/merchants/magalu.png",
  "outback.com": "/merchants/outback.png",
  "drogaraia.com.br": "/merchants/drogaraia.png",
  "ifood.com.br": "/merchants/ifood.png",
  "mercadolivre.com.br": "/merchants/mercadolivre.png",
  "cursor.com": "/merchants/cursor.png",
  "99app.com": "/merchants/99.png",
  "youtube.com": "/merchants/youtube.png",
  "amazon.com.br": "/merchants/amazon.png",
  "steampowered.com": "/merchants/steam.png",
  "shell.com.br": "/merchants/shell.png",
  "latamairlines.com": "/merchants/latam.png",
  "adobe.com": "/merchants/adobe.png",
  "alura.com.br": "/merchants/alura.png",
  "petz.com.br": "/merchants/petz.png",
};

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
  const uploaded = merchantAssetFor(description, assets);
  if (uploaded) return uploaded;
  const domain = merchantDomainFor(description);
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  if (domain && token) {
    const params = new URLSearchParams({
      token,
      size: String(size),
      format: "png",
      fallback: "404",
    });
    return `https://img.logo.dev/${domain}?${params.toString()}`;
  }
  return domain ? merchantLocalLogos[domain] || null : null;
}
