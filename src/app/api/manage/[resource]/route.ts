import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, AppError, guardWrite, modeOf } from "@/lib/http";
import {
  transactionSchema,
  groupSchema,
  goalSchema,
  investmentSchema,
  connectionSchema,
} from "@/lib/validation";
type Context = { params: Promise<{ resource: string }> };
const resources = [
  "transactions",
  "groups",
  "goals",
  "investments",
  "connections",
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
      if (resource === "groups") {
        const count = database
          .prepare(
            "SELECT (SELECT count(*) FROM transactions WHERE group_id=?) + (SELECT count(*) FROM goals WHERE group_id=?) + (SELECT count(*) FROM investments WHERE group_id=?) AS n",
          )
          .get(body.id, body.id, body.id) as { n: number };
        if (count.n)
          throw new AppError(
            "Mova os registros deste grupo antes de excluí-lo.",
          );
        if (body.id === `${mode}-other`)
          throw new AppError("O grupo padrão precisa ser mantido.");
      }
      database
        .prepare(`DELETE FROM ${resource} WHERE id=? AND mode=?`)
        .run(body.id, mode);
      return NextResponse.json({ ok: true });
    }
    const id = existing ? String(existing.id) : randomUUID();
    const assertGroup = (groupId: string) => {
      if (
        !database
          .prepare("SELECT 1 FROM groups WHERE id=? AND mode=?")
          .get(groupId, mode)
      )
        throw new AppError("Grupo inválido.");
    };
    if (resource === "transactions") {
      const row = transactionSchema.parse(body);
      assertGroup(row.groupId);
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
            "UPDATE transactions SET group_id=?,category=?,kind=?,user_categorized=1 WHERE id=? AND mode=?",
          )
          .run(row.groupId, row.category, row.kind, id, mode);
      else if (existing)
        database
          .prepare(
            "UPDATE transactions SET description=?,amount=?,kind=?,date=?,status=?,group_id=?,category=?,account_id=? WHERE id=? AND mode=?",
          )
          .run(
            row.description,
            row.amount,
            row.kind,
            row.date,
            row.status,
            row.groupId,
            row.category,
            row.accountId,
            id,
            mode,
          );
      else
        database
          .prepare(
            "INSERT INTO transactions(id,mode,description,amount,kind,date,status,group_id,category,account_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            mode,
            row.description,
            row.amount,
            row.kind,
            row.date,
            row.status,
            row.groupId,
            row.category,
            row.accountId,
          );
    } else if (resource === "groups") {
      const row = groupSchema.parse(body);
      if (existing)
        database
          .prepare(
            "UPDATE groups SET name=?,color=?,icon=?,budget=? WHERE id=? AND mode=?",
          )
          .run(row.name, row.color, row.icon, row.budget, id, mode);
      else
        database
          .prepare(
            "INSERT INTO groups(id,mode,name,color,icon,budget) VALUES(?,?,?,?,?,?)",
          )
          .run(id, mode, row.name, row.color, row.icon, row.budget);
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
        assertGroup(row.groupId);
        if (existing)
          database
            .prepare(
              "UPDATE goals SET name=?,target=?,current=?,deadline=?,group_id=?,icon=?,color=? WHERE id=? AND mode=?",
            )
            .run(
              row.name,
              row.target,
              row.current,
              row.deadline,
              row.groupId,
              row.icon,
              row.color,
              id,
              mode,
            );
        else
          database
            .prepare(
              "INSERT INTO goals(id,mode,name,target,current,deadline,group_id,icon,color) VALUES(?,?,?,?,?,?,?,?,?)",
            )
            .run(
              id,
              mode,
              row.name,
              row.target,
              row.current,
              row.deadline,
              row.groupId,
              row.icon,
              row.color,
            );
      }
    } else if (resource === "investments") {
      const row = investmentSchema.parse(body);
      assertGroup(row.groupId);
      if (existing?.source === "pluggy")
        database
          .prepare("UPDATE investments SET group_id=? WHERE id=? AND mode=?")
          .run(row.groupId, id, mode);
      else if (existing)
        database
          .prepare(
            "UPDATE investments SET name=?,institution=?,type=?,balance=?,invested=?,group_id=? WHERE id=? AND mode=?",
          )
          .run(
            row.name,
            row.institution,
            row.type,
            row.balance,
            row.invested,
            row.groupId,
            id,
            mode,
          );
      else
        database
          .prepare(
            "INSERT INTO investments(id,mode,name,institution,type,balance,invested,group_id) VALUES(?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            mode,
            row.name,
            row.institution,
            row.type,
            row.balance,
            row.invested,
            row.groupId,
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
