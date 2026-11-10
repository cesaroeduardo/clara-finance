import { z } from "zod";
const amount = z.number().int().positive().max(100_000_000_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Data inválida",
  );
export const transactionSchema = z.object({
  description: z.string().trim().min(1).max(160),
  amount,
  kind: z.enum(["income", "expense", "transfer"]),
  date,
  status: z.enum(["paid", "pending"]),
  groupId: z.string().min(1),
  category: z.string().trim().min(1).max(80),
  accountId: z.string().nullable().default(null),
});
export const groupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.enum([
    "house",
    "coffee",
    "sprout",
    "briefcase",
    "layers",
    "plane",
    "heart",
    "car",
  ]),
  budget: z.number().int().min(0).max(100_000_000_000),
});
export const goalSchema = z.object({
  name: z.string().trim().min(1).max(80),
  target: amount,
  current: z.number().int().min(0).max(100_000_000_000),
  deadline: date,
  groupId: z.string().min(1),
  icon: z.enum(["shield", "plane", "house", "target", "car"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const investmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  institution: z.string().trim().min(1).max(80),
  type: z.enum([
    "FIXED_INCOME",
    "EQUITY",
    "ETF",
    "MUTUAL_FUND",
    "SECURITY",
    "COE",
    "OTHER",
  ]),
  balance: z.number().int().min(0).max(100_000_000_000),
  invested: z.number().int().min(0).max(100_000_000_000),
  groupId: z.string().min(1),
});
export const connectionSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
});
