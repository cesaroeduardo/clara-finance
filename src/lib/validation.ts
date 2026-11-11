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
  invested: z.number().int().min(0).max(100_000_000_000).nullable(),
  groupId: z.string().min(1),
});
export const connectionSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
});
export const recurringSchema = z
  .object({
    description: z.string().trim().min(1).max(160),
    amount,
    kind: z.enum(["income", "expense"]),
    type: z.enum(["fixed", "installment"]),
    dayOfMonth: z.number().int().min(1).max(31),
    frequency: z.enum(["monthly"]).default("monthly"),
    category: z.string().trim().min(1).max(80),
    groupId: z.string().min(1),
    accountId: z.string().nullable().default(null),
    installmentCurrent: z.number().int().min(1).max(360).nullable().optional(),
    installmentTotal: z.number().int().min(1).max(360).nullable().optional(),
    startDate: date.nullable().optional(),
    endDate: date.nullable().optional(),
    active: z.boolean().optional(),
    ignored: z.boolean().optional(),
  })
  .superRefine((row, ctx) => {
    if (row.type !== "installment") return;
    if (row.installmentTotal == null) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o total de parcelas.",
        path: ["installmentTotal"],
      });
      return;
    }
    const current = row.installmentCurrent ?? 1;
    if (current > row.installmentTotal) {
      ctx.addIssue({
        code: "custom",
        message: "A parcela atual não pode passar do total.",
        path: ["installmentCurrent"],
      });
    }
  });
export const planSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Informe o mês do planejamento."),
  monthlyLimit: z.number().int().min(0).max(100_000_000_000),
  fixedCost: z.number().int().min(0).max(100_000_000_000),
  monthlySavings: z.number().int().min(0).max(100_000_000_000),
  expectedSalary: z.number().int().min(0).max(100_000_000_000),
  expectedFreelance: z.number().int().min(0).max(100_000_000_000),
});
