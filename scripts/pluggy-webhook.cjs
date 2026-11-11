const fs = require("node:fs");
const { randomBytes, randomUUID } = require("node:crypto");

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (command === "setup") {
    if (!process.env.PLUGGY_WEBHOOK_SECRET) {
      fs.appendFileSync(
        ".env.local",
        `\nPLUGGY_WEBHOOK_SECRET=${randomBytes(32).toString("hex")}\n`,
      );
      console.log(
        "Segredo do webhook criado no .env.local. Reinicie o aplicativo.",
      );
    } else console.log("O segredo do webhook já está configurado.");
    return;
  }
  const {
    PLUGGY_CLIENT_ID: clientId,
    PLUGGY_CLIENT_SECRET: clientSecret,
    PLUGGY_WEBHOOK_SECRET: secret,
  } = process.env;
  if (!clientId || !clientSecret || !secret)
    throw new Error(
      "Configure as credenciais e execute o comando setup primeiro.",
    );
  const headers = {
    "content-type": "application/json",
    "x-pluggy-webhook-secret": secret,
  };
  if (command === "test") {
    const port = argument ?? "3000";
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
      throw new Error("Informe apenas a porta local do aplicativo.");
    const response = await fetch(
      `http://127.0.0.1:${port}/api/webhooks/pluggy`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: "item/updated",
          eventId: randomUUID(),
          itemId: randomUUID(),
          clientId,
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Teste recusado: HTTP ${response.status}. Confira as variáveis e reinicie o app.`,
      );
    const result = await response.json();
    if (result.received !== true || result.ignored !== true)
      throw new Error("Resposta inesperada no teste do receptor.");
    console.log(
      "Webhook local recebido: HTTP 200. Item fictício ignorado; nenhum dado bancário foi importado.",
    );
    return;
  }
  if (command === "register") {
    const url = new URL(argument);
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/api/webhooks/pluggy" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "Informe a URL HTTPS pública terminando em /api/webhooks/pluggy, sem parâmetros.",
      );
    const auth = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
      signal: AbortSignal.timeout(20000),
    });
    if (!auth.ok)
      throw new Error(`Autenticação Pluggy recusada: HTTP ${auth.status}.`);
    const { apiKey } = await auth.json();
    if (typeof apiKey !== "string")
      throw new Error("Resposta de autenticação inválida.");
    const response = await fetch("https://api.pluggy.ai/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({
        url: url.href,
        event: "all",
        headers: { "x-pluggy-webhook-secret": secret },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(`Cadastro do webhook recusado: HTTP ${response.status}.`);
    console.log(
      "Webhook cadastrado na Pluggy. Confira as entregas na página Eventos do Dashboard.",
    );
    return;
  }
  throw new Error("Use setup, test [porta] ou register <URL HTTPS pública>.");
}
main().catch((error) => {
  console.error(
    error instanceof TypeError
      ? "Confira a URL e a conexão com o servidor."
      : error.message,
  );
  process.exitCode = 1;
});
