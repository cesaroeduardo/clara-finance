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

/** Ícones por categoria (chaves de `FinanceIcon`). */
export const categoryIcons: Record<string, string> = {
  "Contas da casa": "house",
  Compras: "shopping-bag",
  Alimentação: "coffee",
  Restaurantes: "fork-knife",
  Saúde: "first-aid",
  Transporte: "car",
  Assinaturas: "tv",
  Software: "code",
  Pets: "paw",
  Jogos: "game",
  Taxas: "percent",
  Investimentos: "sprout",
  Transferências: "transfer",
  "Sem categoria": "question",
  Outros: "dots",
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

export function iconForCategory(name: string, fallback = "layers") {
  return categoryIcons[name] || fallback;
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

export function categorizeTransaction(input: {
  description: string;
  kind?: TransactionKind;
}): { category: string; groupId: string } {
  const text = normalizeText(input.description || "");
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
