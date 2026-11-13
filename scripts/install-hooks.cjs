const { execFileSync } = require("node:child_process");
try {
  const current = execFileSync("git", ["config", "--get", "core.hooksPath"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (current && current !== ".githooks") {
    console.error(
      "Hook existente preservado. Adicione node scripts/check-private-data.cjs ao seu pre-commit.",
    );
    process.exit(1);
  }
} catch (error) {
  if (error.status !== 1) throw error;
}
require("node:fs").chmodSync(".githooks/pre-commit", 0o755);
execFileSync("git", ["config", "core.hooksPath", ".githooks"]);
console.log("Protecao pre-commit instalada.");
