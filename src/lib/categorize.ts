import type { Category, CategoryRule, TransactionKind } from "./types";

/** Categorias da taxonomia local (seed e fallback). */
export const taxonomyCategories = [
  "Alimentação",
  "Restaurantes",
  "Transporte",
  "Saúde",
  "Barbeiro",
  "Pets",
  "Contas da casa",
  "Assinaturas",
  "Software",
  "Compras",
  "Jogos",
  "Educação",
  "Taxas",
  "Investimentos",
  "Transferências",
  "Sem categoria",
] as const;

/** Paleta próxima ao Visor para fatias e ícones por categoria. */
export const categoryColors: Record<string, string> = {
  "Contas da casa": "#3B82F6",
  Compras: "#22C55E",
  Alimentação: "#EF4444",
  Restaurantes: "#F97316",
  Saúde: "#FB7185",
  Barbeiro: "#C084FC",
  Transporte: "#0891B2",
  Assinaturas: "#8B5CF6",
  Software: "#DB2777",
  Pets: "#F59E0B",
  Jogos: "#A855F7",
  Educação: "#6366F1",
  Taxas: "#64748B",
  Investimentos: "#10B981",
  Transferências: "#94A3B8",
  "Sem categoria": "#94A3B8",
  Outros: "#A1A1AA",
};

/**
 * Imagens 3D por categoria (`/illustrations/categories/*.webp`).
 * Fonte: thiings.co — uso pessoal com atribuição.
 */
export const categoryImages: Record<string, string> = {
  "Contas da casa": "contas-da-casa",
  Compras: "compras",
  Alimentação: "compras-mercado",
  Restaurantes: "alimentacao",
  Saúde: "saude",
  Barbeiro: "barbeiro",
  Transporte: "transporte",
  Assinaturas: "assinaturas",
  Software: "software",
  Pets: "pets",
  Jogos: "jogos",
  Taxas: "taxas",
  Investimentos: "investimentos",
  Transferências: "transferencias",
  "Sem categoria": "sem-categoria",
  Outros: "outros",
};

/** Seed inicial da tabela `categories` (cor hex e imagem opcional). */
export const defaultCategorySeed = taxonomyCategories.map((name, index) => ({
  name,
  color: categoryColors[name] || "#737373",
  imageSlug: categoryImages[name] || null,
  sortOrder: index,
}));

const categoryFallbackPalette = [
  "#FF8A00",
  "#FF6B6B",
  "#A855F7",
  "#22D3EE",
  "#FB7185",
  "#5B8A9A",
  "#0891B2",
  "#E11D48",
  "#F59E0B",
  "#34D399",
];

export function colorForCategory(
  name: string,
  index = 0,
  categories?: Category[],
) {
  return (
    categories?.find((category) => category.name === name)?.color ||
    categoryColors[name] ||
    categoryFallbackPalette[index % categoryFallbackPalette.length]
  );
}

export function imageForCategory(name: string, categories?: Category[]) {
  const category = categories?.find((category) => category.name === name);
  return category ? category.imageSlug : categoryImages[name] || null;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

/**
 * Open Finance (Nu etc.) manda `operação|favorecido`.
 * Mantém só o nome útil e decodifica entidades HTML comuns.
 */
export function cleanTransactionDescription(description: string) {
  let text = description.trim();
  if (!text) return text;
  text = text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
  const pipe = text.indexOf("|");
  if (pipe === -1) return text;
  const merchant = text.slice(pipe + 1).trim();
  return merchant || text;
}

export function categorizeTransaction(
  input: {
    description: string;
    kind?: TransactionKind;
  },
  rules: CategoryRule[],
  fallback: { category: string; transferCategory: string },
): { category: string } {
  const text = normalizeText(
    cleanTransactionDescription(input.description || ""),
  );
  for (const rule of rules) {
    if (!rule.active) continue;
    const match = normalizeText(rule.match).trim();
    if (
      rule.operator === "equals" ? text.trim() === match : text.includes(match)
    )
      return { category: rule.category };
  }
  if (input.kind === "transfer") return { category: fallback.transferCategory };
  return { category: fallback.category };
}

/** Heurística de descrição para pagamento de fatura sem operationType. */
export function isBillPayment(description?: string) {
  if (!description) return false;
  const text = normalizeText(description);
  return (
    text.includes("pagamento de fatura") ||
    /^pagamento recebido$/.test(text.trim())
  );
}
