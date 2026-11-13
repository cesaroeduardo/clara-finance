import { randomUUID } from "node:crypto";
import fs from "node:fs";
import type Database from "better-sqlite3";
import { defaultCategorySeed, normalizeText } from "./categorize";
import { defaultCategoryRules } from "./category-rule-defaults";
import type { CategoryRule, Mode } from "./types";

export function initializeCategoryRules(
  database: Database.Database,
  file: string,
) {
  if (
    database.prepare("SELECT 1 FROM schema_migrations WHERE version=16").get()
  )
    return;
  const legacyFile = `${file}.legacy-category-rules.json`;
  let legacyRules: Array<{
    match: string;
    category: string;
  }> | null = null;
  if (fs.existsSync(legacyFile)) {
    const parsed: unknown = JSON.parse(fs.readFileSync(legacyFile, "utf8"));
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (rule) =>
          !rule ||
          typeof rule.match !== "string" ||
          typeof rule.category !== "string",
      )
    )
      throw new Error("O arquivo local de migração das regras é inválido.");
    legacyRules = parsed;
  }
  database.transaction(() => {
    database.exec(`
      ALTER TABLE categories ADD COLUMN taxonomy_key TEXT;
      CREATE TABLE category_rules (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK(mode IN ('personal','demo')),
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        match_text TEXT NOT NULL,
        match_key TEXT NOT NULL,
        operator TEXT NOT NULL DEFAULT 'contains' CHECK(operator IN ('contains','equals')),
        priority INTEGER NOT NULL DEFAULT 100 CHECK(priority BETWEEN 0 AND 9999),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        UNIQUE(mode, operator, match_key)
      );
      CREATE INDEX category_rules_mode_order ON category_rules(mode, active, priority);
      CREATE INDEX category_rules_category ON category_rules(category_id);
    `);
    for (const mode of ["personal", "demo"] as const) {
      for (const category of defaultCategorySeed) {
        const slug = normalizeText(category.name)
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        database
          .prepare(
            "UPDATE categories SET taxonomy_key=? WHERE mode=? AND (id=? OR name=?)",
          )
          .run(category.name, mode, `${mode}-cat-${slug}`, category.name);
      }
      const rules =
        mode === "personal" && legacyRules
          ? legacyRules
          : defaultCategoryRules.map(([match, category]) => ({
              match,
              category,
            }));
      for (const [priority, rule] of rules.entries()) {
        const category = database
          .prepare(
            "SELECT id FROM categories WHERE mode=? AND (name=? OR taxonomy_key=?) ORDER BY name=? DESC LIMIT 1",
          )
          .get(mode, rule.category, rule.category, rule.category) as
          { id: string } | undefined;
        if (!category)
          throw new Error(
            "Uma categoria da migração de regras não foi encontrada.",
          );
        database
          .prepare(
            "INSERT INTO category_rules(id,mode,category_id,match_text,match_key,priority) VALUES(?,?,?,?,?,?)",
          )
          .run(
            randomUUID(),
            mode,
            category.id,
            rule.match,
            normalizeText(rule.match).trim(),
            priority,
          );
      }
    }
    database.prepare("INSERT INTO schema_migrations(version) VALUES(16)").run();
  })();
}

export function listCategoryRules(
  database: Database.Database,
  mode: Mode,
): CategoryRule[] {
  return (
    database
      .prepare(
        `SELECT r.id, r.category_id AS categoryId, c.name AS category,
      r.match_text AS match, r.operator, r.priority, r.active
      FROM category_rules r JOIN categories c ON c.id=r.category_id AND c.mode=r.mode
      WHERE r.mode=? ORDER BY r.priority, r.rowid`,
      )
      .all(mode) as Array<Omit<CategoryRule, "active"> & { active: number }>
  ).map((rule) => ({ ...rule, active: Boolean(rule.active) }));
}

export function categoryFallback(database: Database.Database, mode: Mode) {
  const transfer = database
    .prepare(
      "SELECT name FROM categories WHERE mode=? AND taxonomy_key='Transferências'",
    )
    .get(mode) as { name: string } | undefined;
  return {
    category: "Sem categoria",
    transferCategory: transfer?.name || "Sem categoria",
  };
}
