import type { TransactionKind } from "./types";

export type CategoryRule = {
  match: string;
  category: string;
  groupId: string;
};

/** Categorias da taxonomia local (sugestões do formulário). */
export const taxonomyCategories = [
  "Alimentação",
  "Restaurantes",
  "Transporte",
  "Saúde",
  "Pets",
  "Contas da casa",
  "Assinaturas",
  "Software",
  "Compras",
  "Jogos",
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
  Transporte: "#0891B2",
  Assinaturas: "#8B5CF6",
  Software: "#DB2777",
  Pets: "#F59E0B",
  Jogos: "#A855F7",
  Taxas: "#64748B",
  Investimentos: "#10B981",
  Transferências: "#94A3B8",
  "Sem categoria": "var(--track)",
  Outros: "var(--chart-4)",
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

export function colorForCategory(name: string, index = 0) {
  return (
    categoryColors[name] ||
    categoryFallbackPalette[index % categoryFallbackPalette.length]
  );
}

export function imageForCategory(name: string) {
  return categoryImages[name] || null;
}

const groups = {
  home: "personal-home",
  life: "personal-life",
  future: "personal-future",
  work: "personal-work",
  other: "personal-other",
} as const;

/**
 * Regras da mais específica para a mais genérica.
 * `match` é comparado com contains, sem acento e case-insensitive.
 */
export const categoryRules: CategoryRule[] = [];

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

export function categorizeTransaction(input: {
  description: string;
  kind?: TransactionKind;
}): { category: string; groupId: string } {
  const text = normalizeText(
    cleanTransactionDescription(input.description || ""),
  );
  for (const rule of categoryRules) {
    if (text.includes(normalizeText(rule.match)))
      return { category: rule.category, groupId: rule.groupId };
  }
  if (input.kind === "transfer")
    return { category: "Transferências", groupId: groups.other };
  return { category: "Sem categoria", groupId: groups.other };
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
