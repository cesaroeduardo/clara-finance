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
