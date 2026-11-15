/**
 * Sobe o sidecar XTTS e, em seguida, o Next (dev ou start).
 * Uso: node scripts/with-xtts.cjs dev
 *      npm run dev:voice
 *
 * Também é acionado por `npm run dev` quando CLARA_XTTS_WITH_DEV=true.
 * Se a porta 8020 já tiver um XTTS saudável, reutiliza (não tenta bind de novo).
 */
const { loadEnvConfig } = require("@next/env");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

loadEnvConfig(process.cwd());

const mode = process.argv[2] || "dev";
if (!["dev", "start"].includes(mode)) {
  console.error("Uso: node scripts/with-xtts.cjs <dev|start>");
  process.exit(1);
}

const root = process.cwd();
const xttsDir = path.join(root, "services", "clara-xtts");
const venvPython = path.join(xttsDir, ".venv", "Scripts", "python.exe");
const venvPythonUnix = path.join(xttsDir, ".venv", "bin", "python");
const pythonBin = fs.existsSync(venvPython)
  ? venvPython
  : fs.existsSync(venvPythonUnix)
    ? venvPythonUnix
    : null;

if (!pythonBin) {
  console.error(
    "[clara-xtts] .venv não encontrado. Rode uma vez: services/clara-xtts/start.ps1",
  );
  process.exit(1);
}

const port = process.env.CLARA_XTTS_PORT || "8020";
const scratch =
  process.env.CLARA_XTTS_SCRATCH ||
  (fs.existsSync("D:\\")
    ? "D:\\clara-xtts-scratch"
    : path.join(xttsDir, ".scratch"));

const env = {
  ...process.env,
  COQUI_TOS_AGREED: "1",
  PORT: port,
  TEMP: path.join(scratch, "tmp"),
  TMP: path.join(scratch, "tmp"),
  HF_HOME: path.join(scratch, "hf"),
  HUGGINGFACE_HUB_CACHE: path.join(scratch, "hf", "hub"),
};

for (const dir of [env.TEMP, env.HUGGINGFACE_HUB_CACHE]) {
  fs.mkdirSync(dir, { recursive: true });
}

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let startedXtts = false;

function killAll() {
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }
  }
}

process.on("SIGINT", () => {
  killAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  killAll();
  process.exit(0);
});

function probeXttsHealth() {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: Number(port),
        path: "/health",
        timeout: 1500,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            resolve(Boolean(json && json.ok));
          } catch {
            resolve(res.statusCode === 200);
          }
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

function startNext() {
  const nextArgs = [
    path.join(root, "scripts", "serve.cjs"),
    mode,
    ...process.argv.slice(3),
  ];
  const next = spawn(process.execPath, nextArgs, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(next);

  next.on("exit", (code) => {
    killAll();
    process.exit(code ?? 1);
  });
  next.on("error", () => {
    killAll();
    process.exit(1);
  });
}

async function main() {
  const alreadyUp = await probeXttsHealth();

  if (alreadyUp) {
    console.log(
      `[clara-xtts] já rodando em http://127.0.0.1:${port} — reutilizando`,
    );
    startNext();
    return;
  }

  console.log(
    `[clara-xtts] subindo sidecar em http://127.0.0.1:${port} (Ctrl+C encerra os dois)`,
  );

  const xtts = spawn(pythonBin, ["server.py"], {
    cwd: xttsDir,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(xtts);
  startedXtts = true;

  xtts.on("exit", (code) => {
    if (!startedXtts) return;
    if (code && code !== 0) {
      console.error(`[clara-xtts] sidecar encerrou com código ${code}`);
    }
    killAll();
    process.exit(code ?? 1);
  });

  // Espera o /health ficar ok (modelo pode demorar a carregar) antes do Next.
  // Se a porta estiver ocupada por outro processo, o sidecar morre e o exit handler encerra.
  const deadline = Date.now() + 180_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (xtts.exitCode != null) return;
    ready = await probeXttsHealth();
    if (ready) break;
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (!ready) {
    console.warn(
      "[clara-xtts] health ainda não ok — subindo o Next mesmo assim (TTS pode falhar até o modelo carregar)",
    );
  } else {
    console.log("[clara-xtts] health ok");
  }

  startNext();
}

main().catch((err) => {
  console.error(err);
  killAll();
  process.exit(1);
});
