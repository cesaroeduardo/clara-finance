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
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(date.slice(0, 10) + "T12:00:00"));
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(month + "-15T12:00:00"));
}
export function parseMoney(value: string) {
  const normalized = value
    .trim()
    .replace(/R\$\s?/g, "")
    .replace(/\s/g, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized.replace(",", ".")) * 100);
}
