const { loadEnvConfig } = require("@next/env");
const { spawn } = require("node:child_process");
const path = require("node:path");
loadEnvConfig(process.cwd());
const mode = process.argv[2];
if (!["dev", "start"].includes(mode)) throw new Error("Modo invalido.");

// Opt-in: sobe XTTS + Next juntos (requer voz sintética ligada).
if (
  process.env.CLARA_XTTS_WITH_DEV === "true" &&
  process.env.NEXT_PUBLIC_CLARA_XTTS === "true" &&
  process.env.CLARA_XTTS_NESTED !== "1"
) {
  const child = spawn(
    process.execPath,
    [path.join(__dirname, "with-xtts.cjs"), mode, ...process.argv.slice(3)],
    {
      stdio: "inherit",
      env: { ...process.env, CLARA_XTTS_NESTED: "1" },
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
  child.on("error", () => process.exit(1));
} else {
  const args = process.argv.slice(3);
  if (args.some((arg) => /^(--hostname(?:=|$)|-H(?:=|$))/.test(arg))) {
    console.error(
      "Configure ALLOW_LAN_ACCESS em .env.local para alterar o acesso de rede.",
    );
    process.exit(1);
  }
  const lan = process.env.ALLOW_LAN_ACCESS === "true";
  if (lan)
    console.warn(
      "Acesso pela rede ativado, sem login. Use apenas em uma rede confiavel.",
    );
  const child = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      mode,
      "--hostname",
      lan ? "0.0.0.0" : "127.0.0.1",
      ...args,
    ],
    { stdio: "inherit" },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
  child.on("error", () => process.exit(1));
}

