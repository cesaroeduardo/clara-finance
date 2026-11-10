const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("node:path");
const file =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), "data", "finances.sqlite");
if (!fs.existsSync(file)) {
  console.error("Abra o aplicativo uma vez antes de criar um backup.");
  process.exit(1);
}
const output = path.join(
  process.cwd(),
  "data",
  "backups",
  `clara-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
fs.mkdirSync(path.dirname(output), { recursive: true });
const db = new Database(file, { readonly: true });
db.backup(output)
  .then(() => {
    db.close();
    console.log(`Backup criado: ${output}`);
  })
  .catch(() => {
    db.close();
    console.error("Não foi possível criar o backup.");
    process.exit(1);
  });
