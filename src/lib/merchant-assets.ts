import fs from "node:fs";
import type Database from "better-sqlite3";
import { z } from "zod";
import type { MerchantAsset } from "./merchants";

const legacySchema = z
  .array(
    z.object({
      match: z.string().trim().min(1).max(256),
      src: z
        .string()
        .max(2_000_000)
        .regex(/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$/),
    }),
  )
  .max(500);

export function initializeMerchantAssets(
  database: Database.Database,
  file: string,
) {
  if (
    database.prepare("SELECT 1 FROM schema_migrations WHERE version=19").get()
  )
    return;
  const legacyFile = `${file}.legacy-merchants.json`;
  const assets = fs.existsSync(legacyFile)
    ? legacySchema.parse(JSON.parse(fs.readFileSync(legacyFile, "utf8")))
    : [];
  database.transaction(() => {
    database.exec(`CREATE TABLE IF NOT EXISTS merchant_assets (
      mode TEXT NOT NULL CHECK(mode IN ('personal','demo')),
      match_text TEXT NOT NULL,
      image_data TEXT NOT NULL,
      PRIMARY KEY(mode, match_text)
    )`);
    const insert = database.prepare(
      "INSERT OR IGNORE INTO merchant_assets(mode,match_text,image_data) VALUES('personal',?,?)",
    );
    for (const asset of assets) insert.run(asset.match, asset.src);
    database.prepare("INSERT INTO schema_migrations(version) VALUES(19)").run();
  })();
}

export function listMerchantAssets(
  database: Database.Database,
  mode: string,
): MerchantAsset[] {
  return database
    .prepare(
      "SELECT match_text AS match, image_data AS src FROM merchant_assets WHERE mode=? ORDER BY length(match_text) DESC, rowid",
    )
    .all(mode) as MerchantAsset[];
}
