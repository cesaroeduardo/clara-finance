export const money = (cents: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    cents / 100,
  );
export const compactMoney = (cents: number) =>
  money(cents).replace(/,\d{2}$/, "");
export const localDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const monthKey = (date = new Date()) => localDate(date).slice(0, 7);
export function dateLabel(date: string, options?: { year?: boolean }) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(options?.year ? { year: "numeric" as const } : {}),
  }).format(new Date(date.slice(0, 10) + "T12:00:00"));
}
export function monthLabel(month: string) {
  const date = new Date(`${month}-15T12:00:00`);
  const short = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(date)
    .replace(/\.$/, "")
    .trim();
  const abbr = short.charAt(0).toLocaleUpperCase("pt-BR") + short.slice(1);
  return `${abbr}. ${date.getFullYear()}`;
}
export function formatMoneyInput(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function maskMoneyInput(value: string) {
  const raw = value
    .trim()
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "");
  if (!raw) return "";

  let working = raw;
  if (!working.includes(",") && /^\d+\.\d{1,2}$/.test(working)) {
    working = working.replace(".", ",");
  }

  const hasComma = working.includes(",");
  const intDigits = (hasComma ? working.slice(0, working.indexOf(",")) : working).replace(
    /\D/g,
    "",
  );
  const decDigits = hasComma
    ? working
        .slice(working.indexOf(",") + 1)
        .replace(/\D/g, "")
        .slice(0, 2)
    : "";

  if (!intDigits && !hasComma) return "";

  const intNormalized =
    intDigits.replace(/^0+(?=\d)/, "") || (hasComma ? "0" : "");
  if (!intNormalized && !hasComma) return "";

  const grouped = intNormalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return hasComma ? `${grouped},${decDigits}` : grouped;
}

export function parseMoney(value: string) {
  const normalized = value
    .trim()
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "");
  if (!normalized) return NaN;

  if (normalized.includes(",")) {
    const plain = normalized.replace(/\./g, "");
    if (!/^\d+(,\d{1,2})?$/.test(plain)) return NaN;
    return Math.round(Number(plain.replace(",", ".")) * 100);
  }

  if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    return Math.round(Number(normalized.replace(/\./g, "")) * 100);
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}
