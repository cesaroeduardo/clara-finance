import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { privateReason } = require("../scripts/check-private-data.cjs");

test("bloqueia bancos e exportacoes mesmo renomeados", () => {
  for (const file of [
    "copy.db",
    "backup.sqlite-wal",
    "export.csv",
    ".env.local",
    ".cursor/debug.log",
    "outside/backup.sql",
  ]) {
    assert.ok(privateReason(file, Buffer.from("")), file);
  }
  assert.ok(
    privateReason("photo.png", Buffer.from("SQLite format 3\0private")),
  );
  assert.ok(
    privateReason(
      "notes.txt",
      Buffer.from("INSERT INTO transactions VALUES (1);"),
    ),
  );
  assert.ok(
    privateReason(
      "notes.json",
      Buffer.from(JSON.stringify([{ description: "Teste", amount: 100 }])),
    ),
  );
  assert.ok(
    privateReason(
      "notes.txt",
      Buffer.from("description;amount;date\nTeste;100;2026-01-01"),
    ),
  );
  assert.ok(
    privateReason(
      "src/example.ts",
      Buffer.from('const key = "private-test-secret"'),
      ["private-test-secret"],
    ),
  );
  assert.equal(
    privateReason(".env.example", Buffer.from("PLUGGY_CLIENT_SECRET=")),
    null,
  );
  assert.equal(
    privateReason(
      "src/db.ts",
      Buffer.from('const sql = "INSERT INTO transactions VALUES (?)";'),
    ),
    null,
  );
});

test("hook inspeciona staging mesmo quando o arquivo de trabalho foi limpo", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { execFileSync, spawnSync } = await import("node:child_process");
  const directory = fs.mkdtempSync(
    path.join(process.cwd(), "work", "staging-test-"),
  );
  const scanner = path.resolve("scripts/check-private-data.cjs");
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: directory, stdio: "pipe" });
  git("init");
  fs.writeFileSync(
    path.join(directory, "innocent.txt"),
    Buffer.from("SQLite format 3\0private"),
  );
  git("add", "innocent.txt");
  fs.writeFileSync(path.join(directory, "innocent.txt"), "Arquivo limpo");
  const blocked = spawnSync(process.execPath, [scanner], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /conteudo SQLite/);
  git("add", "innocent.txt");
  const accepted = spawnSync(process.execPath, [scanner], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(accepted.status, 0, accepted.stderr);
});
