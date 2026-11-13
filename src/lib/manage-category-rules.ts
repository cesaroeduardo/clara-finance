import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { normalizeText } from "./categorize";
import { AppError } from "./http";
import { categoryRuleSchema } from "./validation";
import type { Mode } from "./types";

export function manageCategoryRule(
  database: Database.Database,
  mode: Mode,
  method: string,
  body: Record<string, unknown>,
) {
  const id = method === "POST" ? randomUUID() : body.id;
  if (typeof id !== "string" || !id)
    throw new AppError("Informe a regra a atualizar.");
  if (
    method !== "POST" &&
    !database
      .prepare("SELECT 1 FROM category_rules WHERE id=? AND mode=?")
      .get(id, mode)
  )
    throw new AppError("Regra não encontrada.", 404);
  if (method === "DELETE") {
    database
      .prepare("DELETE FROM category_rules WHERE id=? AND mode=?")
      .run(id, mode);
    return { ok: true, id };
  }
  const rule = categoryRuleSchema.parse(body);
  if (
    !database
      .prepare("SELECT 1 FROM categories WHERE id=? AND mode=?")
      .get(rule.categoryId, mode)
  )
    throw new AppError("Categoria inválida.");
  const matchKey = normalizeText(rule.match).trim();
  if (
    database
      .prepare(
        "SELECT 1 FROM category_rules WHERE mode=? AND operator=? AND match_key=? AND id!=?",
      )
      .get(mode, rule.operator, matchKey, id)
  )
    throw new AppError("Já existe uma regra com esta condição.");
  if (method === "POST")
    database
      .prepare(
        "INSERT INTO category_rules(id,mode,category_id,match_text,match_key,operator,priority,active) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        mode,
        rule.categoryId,
        rule.match,
        matchKey,
        rule.operator,

        rule.priority,
        Number(rule.active),
      );
  else
    database
      .prepare(
        "UPDATE category_rules SET category_id=?,match_text=?,match_key=?,operator=?,priority=?,active=? WHERE id=? AND mode=?",
      )
      .run(
        rule.categoryId,
        rule.match,
        matchKey,
        rule.operator,

        rule.priority,
        Number(rule.active),
        id,
        mode,
      );
  return { ok: true, id };
}
