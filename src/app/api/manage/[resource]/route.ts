import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { monthKey } from "@/lib/format";
import { apiError, AppError, guardWrite, modeOf } from "@/lib/http";
import {
  transactionSchema,
  categorySchema,
  goalSchema,
  investmentSchema,
  connectionSchema,
  planSchema,
  recurringSchema,
} from "@/lib/validation";
import { cleanTransactionDescription } from "@/lib/categorize";
import { normalizeMatchKey } from "@/lib/recurring";
import { manageCategoryRule } from "@/lib/manage-category-rules";
type Context = { params: Promise<{ resource: string }> };
const resources = [
  "transactions",
  "categories",
  "category-rules",
  "goals",
  "investments",
  "connections",
  "plan",
  "recurrings",
] as const;
async function handle(request: NextRequest, context: Context) {
  try {
    guardWrite(request);
    const mode = modeOf(request),
      { resource } = await context.params;
    if (!resources.includes(resource as (typeof resources)[number]))
      throw new AppError("Recurso não encontrado.", 404);
    const database = db(),
      body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new AppError("Envie os campos do registro.");
    if (resource === "category-rules")
      return NextResponse.json(
        manageCategoryRule(database, mode, request.method, body),
        {
          status: request.method === "POST" ? 201 : 200,
        },
      );
    if (resource === "plan") {
      if (request.method === "DELETE")
        throw new AppError("O planejamento não pode ser excluído.");
      const row = planSchema.parse(body);
      database
        .prepare(
          `INSERT INTO plan_months(
             mode, month, monthly_limit, fixed_cost, monthly_savings,
             expected_salary, expected_freelance
           )
           VALUES(?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(mode, month) DO UPDATE SET
             monthly_limit=excluded.monthly_limit,
             fixed_cost=excluded.fixed_cost,
             monthly_savings=excluded.monthly_savings,
             expected_salary=excluded.expected_salary,
             expected_freelance=excluded.expected_freelance`,
        )
        .run(
          mode,
          row.month,
          row.monthlyLimit,
          row.fixedCost,
          row.monthlySavings,
          row.expectedSalary,
          row.expectedFreelance,
        );
      // Mantém plan_settings como espelho do mês civil atual.
      if (row.month === monthKey()) {
        database
          .prepare(
            `INSERT INTO plan_settings(
               mode, monthly_limit, fixed_cost, monthly_savings,
               expected_salary, expected_freelance
             )
             VALUES(?, ?, ?, ?, ?, ?)
             ON CONFLICT(mode) DO UPDATE SET
               monthly_limit=excluded.monthly_limit,
               fixed_cost=excluded.fixed_cost,
               monthly_savings=excluded.monthly_savings,
               expected_salary=excluded.expected_salary,
               expected_freelance=excluded.expected_freelance`,
          )
          .run(
            mode,
            row.monthlyLimit,
            row.fixedCost,
            row.monthlySavings,
            row.expectedSalary,
            row.expectedFreelance,
          );
      }
      return NextResponse.json({ ok: true, id: `${mode}:${row.month}` });
    }
    if (request.method !== "POST" && (typeof body.id !== "string" || !body.id))
      throw new AppError("Informe o registro a atualizar.");
    const existing =
      request.method !== "POST"
        ? (database
            .prepare(`SELECT * FROM ${resource} WHERE id=? AND mode=?`)
            .get(body.id, mode) as Record<string, unknown> | undefined)
        : undefined;
    if (request.method !== "POST" && !existing)
      throw new AppError("Registro não encontrado.", 404);
    if (request.method === "DELETE") {
      if (existing?.source === "pluggy")
        throw new AppError(
          "Registros importados são mantidos para evitar inconsistências na sincronização.",
        );
      if (resource === "connections")
        throw new AppError(
          "A remoção de consentimento deve ser feita no Meu Pluggy.",
        );

      if (resource === "categories") {
        if (existing?.name === "Sem categoria")
          throw new AppError("A categoria padrão precisa ser mantida.");
        const count = database
          .prepare(
            `SELECT
               (SELECT count(*) FROM transactions WHERE mode=? AND category=?) +
               (SELECT count(*) FROM recurrings WHERE mode=? AND category=?) +
               (SELECT count(*) FROM goals WHERE mode=? AND category=?) AS n`,
          )
          .get(
            mode,
            existing?.name,
            mode,
            existing?.name,
            mode,
            existing?.name,
          ) as { n: number };
        if (count.n)
          throw new AppError(
            "Mova os registros desta categoria antes de excluí-la.",
          );
      }
      if (resource === "recurrings" && existing?.source === "detected") {
        database
          .prepare(
            "UPDATE recurrings SET ignored=1, active=0 WHERE id=? AND mode=?",
          )
          .run(body.id, mode);
        return NextResponse.json({ ok: true });
      }
      database
        .prepare(`DELETE FROM ${resource} WHERE id=? AND mode=?`)
        .run(body.id, mode);
      return NextResponse.json({ ok: true });
    }
    const id = existing ? String(existing.id) : randomUUID();
    if (resource === "transactions") {
      const row = {
        ...transactionSchema.parse(body),
        description: cleanTransactionDescription(
          String(body.description ?? ""),
        ),
      };
      if (!row.description) throw new AppError("Informe a descrição.");

      if (
        row.accountId &&
        !database
          .prepare(
            "SELECT 1 FROM accounts WHERE id=? AND mode=? AND (currency='BRL' OR ?=1)",
          )
          .get(row.accountId, mode, existing?.source === "pluggy" ? 1 : 0)
      )
        throw new AppError("Conta inválida.");
      if (existing?.source === "pluggy")
        database
          .prepare(
            "UPDATE transactions SET category=?,kind=?,user_categorized=1 WHERE id=? AND mode=?",
          )
          .run(row.category, row.kind, id, mode);
      else if (existing)
        database
          .prepare(
            "UPDATE transactions SET description=?,amount=?,kind=?,date=?,status=?,category=?,account_id=? WHERE id=? AND mode=?",
          )
          .run(
            row.description,
            row.amount,
            row.kind,
            row.date,
            row.status,

            row.category,
            row.accountId,
            id,
            mode,
          );
      else
        database
          .prepare(
            "INSERT INTO transactions(id,mode,description,amount,kind,date,status,category,account_id) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            mode,
            row.description,
            row.amount,
            row.kind,
            row.date,
            row.status,

            row.category,
            row.accountId,
          );
    } else if (resource === "categories") {
      const row = categorySchema.parse(body);
      const duplicate = database
        .prepare("SELECT id FROM categories WHERE mode=? AND name=? AND id!=?")
        .get(mode, row.name, id) as { id: string } | undefined;
      if (duplicate)
        throw new AppError("Já existe uma categoria com este nome.");
      if (existing) {
        const previousName = String(existing.name);
        if (previousName === "Sem categoria" && row.name !== "Sem categoria")
          throw new AppError("A categoria padrão não pode ser renomeada.");
        database
          .prepare(
            "UPDATE categories SET name=?,color=?,image_slug=? WHERE id=? AND mode=?",
          )
          .run(row.name, row.color, row.imageSlug, id, mode);
        if (previousName !== row.name) {
          database
            .prepare(
              "UPDATE transactions SET category=? WHERE mode=? AND category=?",
            )
            .run(row.name, mode, previousName);
          database
            .prepare(
              "UPDATE recurrings SET category=? WHERE mode=? AND category=?",
            )
            .run(row.name, mode, previousName);
          database
            .prepare("UPDATE goals SET category=? WHERE mode=? AND category=?")
            .run(row.name, mode, previousName);
        }
      } else {
        const maxSort = database
          .prepare(
            "SELECT coalesce(max(sort_order), -1) AS n FROM categories WHERE mode=?",
          )
          .get(mode) as { n: number };
        database
          .prepare(
            "INSERT INTO categories(id,mode,name,color,image_slug,sort_order) VALUES(?,?,?,?,?,?)",
          )
          .run(id, mode, row.name, row.color, row.imageSlug, maxSort.n + 1);
      }
    } else if (resource === "goals") {
      if (existing && body.contribution !== undefined) {
        const contribution = Number(body.contribution);
        if (
          !Number.isSafeInteger(contribution) ||
          contribution <= 0 ||
          contribution > 100_000_000_000
        )
          throw new AppError("Informe um valor válido.");
        database
          .prepare("UPDATE goals SET current=current+? WHERE id=? AND mode=?")
          .run(contribution, id, mode);
      } else {
        const row = goalSchema.parse(body);
        const now = new Date().toISOString();
        const completedAt = row.completed
          ? existing?.completed
            ? (existing.completed_at ?? null)
            : now
          : null;
        if (existing)
          database
            .prepare(
              "UPDATE goals SET name=?,description=?,target=?,current=?,deadline=?,icon=?,color=?,image_slug=?,completed=?,category=?,completed_at=? WHERE id=? AND mode=?",
            )
            .run(
              row.name,
              row.description,
              row.target,
              row.current,
              row.deadline,
              row.icon,
              row.color,
              row.imageSlug,
              Number(row.completed),
              row.category,
              completedAt,
              id,
              mode,
            );
        else
          database
            .prepare(
              "INSERT INTO goals(id,mode,name,description,target,current,deadline,icon,color,image_slug,completed,category,created_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            )
            .run(
              id,
              mode,
              row.name,
              row.description,
              row.target,
              row.current,
              row.deadline,
              row.icon,
              row.color,
              row.imageSlug,
              Number(row.completed),
              row.category,
              now,
              completedAt,
            );
      }
    } else if (resource === "investments") {
      const row = investmentSchema.parse(body);

      if (existing?.source === "pluggy")
        database
          .prepare("UPDATE investments SET invested=? WHERE id=? AND mode=?")
          .run(row.invested, id, mode);
      else if (existing)
        database
          .prepare(
            "UPDATE investments SET name=?,institution=?,type=?,balance=?,invested=? WHERE id=? AND mode=?",
          )
          .run(
            row.name,
            row.institution,
            row.type,
            row.balance,
            row.invested,

            id,
            mode,
          );
      else
        database
          .prepare(
            "INSERT INTO investments(id,mode,name,institution,type,balance,invested) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            id,
            mode,
            row.name,
            row.institution,
            row.type,
            row.balance,
            row.invested,
          );
    } else if (resource === "recurrings") {
      const parsed = recurringSchema.parse(body);
      const row = {
        ...parsed,
        description: cleanTransactionDescription(parsed.description),
      };
      if (!row.description) throw new AppError("Informe a descrição.");

      if (
        row.accountId &&
        !database
          .prepare("SELECT 1 FROM accounts WHERE id=? AND mode=?")
          .get(row.accountId, mode)
      )
        throw new AppError("Conta inválida.");
      const matchKey = normalizeMatchKey(row.description);
      if (!matchKey) throw new AppError("Descrição inválida.");
      const installmentCurrent =
        row.type === "installment" ? (row.installmentCurrent ?? 1) : null;
      const installmentTotal =
        row.type === "installment" ? (row.installmentTotal ?? null) : null;
      if (existing)
        database
          .prepare(
            `UPDATE recurrings SET kind=?,type=?,description=?,amount=?,day_of_month=?,category=?,
              account_id=?,installment_current=?,installment_total=?,start_date=?,end_date=?,match_key=?,
              active=?,ignored=?,user_edited=1,source=CASE WHEN source='detected' THEN 'detected' ELSE 'manual' END
             WHERE id=? AND mode=?`,
          )
          .run(
            row.kind,
            row.type,
            row.description,
            row.amount,
            row.dayOfMonth,
            row.category,

            row.accountId,
            installmentCurrent,
            installmentTotal,
            row.startDate ?? null,
            row.endDate ?? null,
            matchKey,
            row.active === false ? 0 : 1,
            row.ignored ? 1 : 0,
            id,
            mode,
          );
      else
        database
          .prepare(
            `INSERT INTO recurrings(id,mode,kind,type,description,amount,day_of_month,frequency,category,account_id,installment_current,installment_total,start_date,end_date,source,match_key,ignored,active,user_edited,currency) VALUES(?,?,?,?,?,?,?,'monthly',?,?,?,?,?,?,'manual',?,0,1,1,'BRL')`,
          )
          .run(
            id,
            mode,
            row.kind,
            row.type,
            row.description,
            row.amount,
            row.dayOfMonth,
            row.category,

            row.accountId,
            installmentCurrent,
            installmentTotal,
            row.startDate ?? null,
            row.endDate ?? null,
            matchKey,
          );
    } else {
      if (mode !== "personal")
        throw new AppError("Use o modo pessoal para conectar os bancos.");
      const row = connectionSchema.parse(body);
      if (
        database.prepare("SELECT 1 FROM connections WHERE id=?").get(row.itemId)
      )
        throw new AppError("Esta conexão já está cadastrada.");
      const count = database
        .prepare("SELECT count(*) AS n FROM connections WHERE mode='personal'")
        .get() as { n: number };
      if (count.n >= 5)
        throw new AppError("O uso pessoal permite até cinco conexões.");
      database
        .prepare("INSERT INTO connections(id,mode,name) VALUES(?,'personal',?)")
        .run(row.itemId, row.name);
    }
    return NextResponse.json(
      { ok: true, id },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
