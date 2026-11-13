const { loadEnvConfig } = require("@next/env");
const { spawn } = require("node:child_process");
loadEnvConfig(process.cwd());
const mode = process.argv[2];
if (!["dev", "start"].includes(mode)) throw new Error("Modo invalido.");
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
