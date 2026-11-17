import type { Account, Connection } from "./types";

/** Conector agregador (Meu Pluggy) — não é o banco de origem. */
export function isAggregatorInstitution(name?: string | null) {
  return !name?.trim() || /meupluggy|\bpluggy\b/i.test(name);
}

/** Instituição real: nome da conexão do usuário, ou o conector quando não é agregador. */
export function resolveInstitution(
  connectorName?: string | null,
  connectionName?: string | null,
) {
  const connection = connectionName?.trim();
  if (connection && !isAggregatorInstitution(connection)) return connection;
  const connector = connectorName?.trim();
  if (connector && !isAggregatorInstitution(connector)) return connector;
  return connection || connector || "Meu Pluggy";
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

/** Nome curto da conta a partir dos metadados da Pluggy. */
export function cleanAccountName(
  account: {
    name?: string | null;
    marketingName?: string | null;
    type: string;
    subtype?: string | null;
  },
  institution: string,
) {
  const raw = (account.marketingName || account.name || "").trim();
  const text = normalize(raw);
  const credit = account.type === "CREDIT" || account.subtype === "CREDIT_CARD";

  if (credit) {
    if (/ultraviolet/.test(text)) return "Ultravioleta";
    if (/visa/.test(text) && /internacional/.test(text))
      return "Visa Internacional";
    if (raw && !isAggregatorInstitution(raw)) return raw;
    return "Cartão de crédito";
  }

  if (account.subtype === "SAVINGS_ACCOUNT" || /\bpoupanca\b/.test(text))
    return "Poupança";

  if (
    /nu\s*pagamentos|institui[cç]ao de pagamento|conta\s*pre-?paga/.test(text)
  )
    return "Conta";

  if (/conta\s*corrente|checking/.test(text)) return "Conta corrente";
  if (account.subtype === "CHECKING_ACCOUNT") return "Conta corrente";
  if (institution && normalize(raw) === normalize(institution)) return "Conta";
  return raw || "Conta";
}

/** Canal: cartão vs conta (PIX e demais débitos da conta). */
export function accountChannelLabel(account: Pick<Account, "type" | "name">) {
  if (account.type === "CREDIT") return "Cartão";
  if (/poupan/i.test(account.name)) return "Poupança";
  return "Conta";
}

export function displayInstitution(
  account: Pick<Account, "institution" | "name" | "itemId">,
  connections: Pick<Connection, "id" | "name">[] = [],
) {
  if (!isAggregatorInstitution(account.institution))
    return account.institution.trim();
  const connection = connections.find((row) => row.id === account.itemId);
  if (connection && !isAggregatorInstitution(connection.name))
    return connection.name.trim();
  const text = normalize(`${account.institution} ${account.name}`);
  if (/nubank|nu\s*pagamentos|ultraviolet/.test(text)) return "Nubank";
  if (/sicredi|visa\s*internacional/.test(text)) return "Sicredi";
  return account.institution.trim() || "Conta";
}

/** Rótulo da coluna Conta: "Nubank · Cartão", "Sicredi · Conta". */
export function formatAccountLabel(
  account: Pick<Account, "institution" | "name" | "type" | "itemId">,
  connections: Pick<Connection, "id" | "name">[] = [],
) {
  return `${displayInstitution(account, connections)} · ${accountChannelLabel(account)}`;
}

/** Domínios Logo.dev por instituição (match mais específico primeiro). */
const institutionDomains: ReadonlyArray<{ match: string; domain: string }> = [
  { match: "nubank", domain: "nubank.com.br" },
  { match: "nu pagamentos", domain: "nubank.com.br" },
  { match: "sicredi", domain: "sicredi.com.br" },
  { match: "itaú", domain: "itau.com.br" },
  { match: "itau", domain: "itau.com.br" },
  { match: "bradesco", domain: "bradesco.com.br" },
  { match: "santander", domain: "santander.com.br" },
  { match: "banco do brasil", domain: "bb.com.br" },
  { match: "banco brasil", domain: "bb.com.br" },
  { match: "caixa", domain: "caixa.gov.br" },
  { match: "inter", domain: "bancointer.com.br" },
  { match: "c6", domain: "c6bank.com.br" },
  { match: "btg", domain: "btgpactual.com" },
  { match: "xp", domain: "xpi.com.br" },
  { match: "clear", domain: "clear.com.br" },
];

/** Fallback local para preview/demo sem `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY`. */
const institutionLocalLogos: Record<string, string> = {
  "nubank.com.br": "/institutions/nubank.png",
  "sicredi.com.br": "/institutions/sicredi.png",
  "itau.com.br": "/institutions/itau.png",
  "btgpactual.com": "/institutions/btg.png",
  "xpi.com.br": "/institutions/xp.png",
  "clear.com.br": "/institutions/clear.png",
};

export function institutionDomainFor(institution: string) {
  const text = normalize(institution || "");
  for (const rule of institutionDomains) {
    if (text.includes(normalize(rule.match))) return rule.domain;
  }
  return null;
}

export function institutionLogoUrl(institution: string, size = 64) {
  const domain = institutionDomainFor(institution);
  const local = domain ? institutionLocalLogos[domain] || null : null;
  // Arquivo oficial do Sicredi: sempre local.
  if (domain === "sicredi.com.br") return local;
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  if (domain && token) {
    const params = new URLSearchParams({
      token,
      size: String(size),
      format: "png",
      fallback: "404",
    });
    return `https://img.logo.dev/${domain}?${params.toString()}`;
  }
  return local;
}

/** Corrige instituições agregadoras já gravadas, usando o nome da conexão. */
export function repairAccountInstitutions(
  database: import("better-sqlite3").Database,
) {
  database
    .prepare(
      `UPDATE accounts
       SET institution = (
         SELECT connections.name FROM connections WHERE connections.id = accounts.item_id
       )
       WHERE item_id IS NOT NULL
         AND institution GLOB '*[Pp]luggy*'
         AND EXISTS (
           SELECT 1 FROM connections
           WHERE connections.id = accounts.item_id
             AND connections.name NOT GLOB '*[Pp]luggy*'
             AND trim(connections.name) != ''
         )`,
    )
    .run();
  database
    .prepare(
      `UPDATE investments
       SET institution = (
         SELECT connections.name FROM connections WHERE connections.id = investments.item_id
       )
       WHERE item_id IS NOT NULL
         AND source = 'pluggy'
         AND institution GLOB '*[Pp]luggy*'
         AND EXISTS (
           SELECT 1 FROM connections
           WHERE connections.id = investments.item_id
             AND connections.name NOT GLOB '*[Pp]luggy*'
             AND trim(connections.name) != ''
         )`,
    )
    .run();

  const rows = database
    .prepare(
      `SELECT accounts.id, accounts.name, accounts.type, accounts.institution
       FROM accounts
       WHERE accounts.item_id IS NOT NULL`,
    )
    .all() as {
    id: string;
    name: string;
    type: string;
    institution: string;
  }[];
  const update = database.prepare("UPDATE accounts SET name=? WHERE id=?");
  for (const row of rows) {
    const cleaned = cleanAccountName(row, row.institution);
    if (cleaned && cleaned !== row.name) update.run(cleaned, row.id);
  }
}
