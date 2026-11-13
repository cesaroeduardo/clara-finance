const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function privateReason(name, content, privateValues = []) {
  const file = name.replaceAll("\\", "/");
  if (/^(data|exports|backups|\.cursor)(\/|$)/i.test(file))
    return "diretorio privado";
  if (/(^|\/)\.env(?:\..*)?$/i.test(file) && file !== ".env.example")
    return "arquivo de ambiente";
  if (
    /\.(sqlite3?|db)(?:-.*)?$|\.(sql|dump|bak|backup|csv|tsv|ofx|qfx|qif|log|pem|key)$|\.legacy-(category-rules|merchants)\.json$/i.test(
      file,
    )
  )
    return "banco, exportacao, log ou chave";
  if (content.subarray(0, 16).equals(Buffer.from("SQLite format 3\0")))
    return "conteudo SQLite";
  const text = content.toString("utf8");
  if (
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}/.test(
      text,
    )
  )
    return "possivel chave privada";
  if (
    /(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|COPY)\s+["`\[]?(transactions|accounts|connections|investments|goals|category_rules|merchant_assets)\b/i.test(
      text,
    ) &&
    !/\.(?:[cm]?[jt]sx?)$/i.test(file)
  )
    return "dump financeiro";
  // Exports renamed to .txt/.json are also blocked; source and synthetic test fixtures stay reviewable.
  if (!/\.(?:[cm]?[jt]sx?|md)$/i.test(file)) {
    if (
      /^["']?(?:description|descricao|descri\S*o)["']?[,;\t].*(?:amount|valor)/im.test(
        text,
      )
    )
      return "exportacao financeira";
    try {
      const value = JSON.parse(text);
      const rows = Array.isArray(value)
        ? value
        : (value?.transactions ?? value?.accounts ?? value?.categoryRules);
      if (
        Array.isArray(rows) &&
        rows.some(
          (row) =>
            row &&
            typeof row === "object" &&
            (("description" in row && "amount" in row) ||
              ("balance" in row &&
                ("institution" in row || "accountId" in row)) ||
              ("match" in row && ("groupId" in row || "src" in row))),
        )
      )
        return "dados financeiros em JSON";
    } catch {
      /* not JSON */
    }
  }
  if (privateValues.some((value) => value.length >= 8 && text.includes(value)))
    return "valor privado local";
  return null;
}

function localPrivateValues(root) {
  const values = [];
  for (const file of [
    ".env.local",
    ".env",
    ".env.production.local",
    ".env.development.local",
  ]) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) continue;
    for (const line of fs.readFileSync(target, "utf8").split(/\r?\n/)) {
      const match = line.match(
        /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/,
      );
      if (match && /SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CLIENT_ID/.test(match[1]))
        values.push(match[2].replace(/^(['"])(.*)\1$/, "$2"));
    }
  }
  // Consult the local database without opening or creating another database.
  try {
    require("@next/env").loadEnvConfig(root, true, { info() {}, error() {} });
    const file =
      process.env.DATABASE_PATH || path.join(root, "data", "finances.sqlite");
    if (fs.existsSync(file)) {
      const Database = require("better-sqlite3");
      const db = new Database(file, { readonly: true, fileMustExist: true });
      try {
        if (
          db
            .prepare("SELECT 1 FROM sqlite_master WHERE name='merchant_assets'")
            .get()
        ) {
          for (const row of db
            .prepare(
              "SELECT match_text FROM merchant_assets WHERE mode='personal'",
            )
            .all()) {
            if (row.match_text.length >= 12) values.push(row.match_text);
          }
        }
      } finally {
        db.close();
      }
    }
  } catch {
    throw new Error(
      "Nao foi possivel verificar os dados privados locais. Confira o banco antes de commitar.",
    );
  }
  return values;
}

function main() {
  const git = (args) =>
    execFileSync("git", args, { maxBuffer: 128 * 1024 * 1024 });
  const root = git(["rev-parse", "--show-toplevel"]).toString().trim();
  process.chdir(root);
  const all = process.argv.includes("--all");
  const files = git(
    all
      ? ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]
      : ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
  )
    .toString()
    .split("\0")
    .filter(Boolean);
  const values = localPrivateValues(root);
  const problems = [];
  for (const file of files) {
    // Always inspect the index: a clean working copy must not hide staged secrets.
    if (all && !fs.existsSync(file)) continue;
    const content = all ? fs.readFileSync(file) : git(["show", `:${file}`]);
    const reason = privateReason(file, content, values);
    if (reason) problems.push(`${file}: ${reason}`);
  }
  if (problems.length) {
    console.error(
      "Commit bloqueado: remova os arquivos privados da area de staging.\n" +
        problems.join("\n"),
    );
    process.exitCode = 1;
  } else console.log("Verificacao de dados privados concluida.");
}
module.exports = { privateReason };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
