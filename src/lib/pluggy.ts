import {
  cleanAccountName,
  repairAccountInstitutions,
  resolveInstitution,
} from "./accounts";
import {
  categorizeTransaction,
  cleanTransactionDescription,
  isBillPayment,
} from "./categorize";
import { db } from "./db";
import { AppError } from "./http";
import { parseInstallment, reconcileRecurrings } from "./recurring";
import type { TransactionKind } from "./types";

type RemoteAccount = {
  id: string;
  name: string;
  marketingName?: string | null;
  type: string;
  subtype?: string;
  number?: string | null;
  balance: number;
  currencyCode: string;
  creditData?: {
    availableCreditLimit?: number | null;
    creditLimit?: number | null;
  } | null;
};
type RemoteTransaction = {
  id: string;
  description: string;
  amount: number;
  amountInAccountCurrency?: number;
  currencyCode: string;
  type: "CREDIT" | "DEBIT";
  date: string;
  status: string;
  operationType?: string;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
  } | null;
  paymentData?: {
    paymentMethod?: string | null;
    installmentData?: {
      installmentNumber?: number | null;
      totalInstallments?: number | null;
    } | null;
  } | null;
};
type RemoteInvestment = {
  id: string;
  name: string;
  type: string;
  balance: number;
  amount?: number;
  /** Valor originalmente aplicado; base de custo quando a instituição envia. */
  amountOriginal?: number | null;
  currencyCode: string;
};
type RemoteItem = {
  id: string;
  status: string;
  consentExpiresAt?: string;
  connector?: { name: string };
  error?: { code: string };
};
type Page<T> = { results: T[]; totalPages: number; page: number };
type CursorPage<T> = { results: T[]; next: string | null };
export type SyncResult = {
  itemId: string;
  ok: boolean;
  accounts?: number;
  transactions?: number;
  investments?: number;
  warning?: string;
  error?: string;
};
const endpoint = "https://api.pluggy.ai";
const pageLimit = 1000;
let cachedKey: { key: string; expires: number } | undefined;
/** Movimentos entre conta e investimento/reserva — não entram no resultado do mês. */
const transferOperations = new Set([
  "PAGAMENTO_FATURA",
  "APLICACAO_FINANCEIRA",
  "RESGATE_APLIC_FINANCEIRA",
  "TRANSFERENCIA_SALDO_RESERVADO",
  "TRANSFERENCIA_SALDOS_RESERVADOS",
]);
function remoteInstallment(row: RemoteTransaction) {
  const meta =
    row.creditCardMetadata || row.paymentData?.installmentData || null;
  return parseInstallment(
    row.description || "",
    meta?.installmentNumber,
    meta?.totalInstallments,
  );
}
function investmentMovement(description?: string) {
  if (!description) return false;
  const text = description
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
  // Resgate de cashback é entrada real, não movimento de investimento.
  if (/\bcashback\b/.test(text)) return false;
  return (
    /\baplicacao\b/.test(text) ||
    /\bresgate\b/.test(text) ||
    /\btesouro\b/.test(text) ||
    /\bnu\s*invest/.test(text) ||
    /\bcompra de renda variavel\b/.test(text) ||
    /\bvenda de renda variavel\b/.test(text) ||
    /\bcompra de criptomoedas?\b/.test(text) ||
    /\bvenda de criptomoedas?\b/.test(text)
  );
}
export function transactionKind(
  transaction: Pick<
    RemoteTransaction,
    "type" | "operationType" | "description"
  >,
): TransactionKind {
  if (
    transaction.operationType &&
    transferOperations.has(transaction.operationType)
  )
    return "transfer";
  // Bancos às vezes omitem PAGAMENTO_FATURA ou marcam aplicações como OUTROS.
  if (isBillPayment(transaction.description)) return "transfer";
  if (investmentMovement(transaction.description)) return "transfer";
  return transaction.type === "CREDIT" ? "income" : "expense";
}
export function cents(value: number) {
  if (!Number.isFinite(value))
    throw new AppError("A instituição retornou um valor inválido.", 502);
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result))
    throw new AppError("O valor retornado está fora do limite.", 502);
  return result;
}
async function apiKey() {
  if (cachedKey && cachedKey.expires > Date.now()) return cachedKey.key;
  if (!process.env.PLUGGY_CLIENT_ID || !process.env.PLUGGY_CLIENT_SECRET)
    throw new AppError(
      "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no arquivo .env.local e reinicie o aplicativo.",
      503,
    );
  const response = await fetch(`${endpoint}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new AppError(
      response.status === 401
        ? "Credenciais da Pluggy inválidas. Confira seu Client ID e Client Secret."
        : "Não foi possível autenticar na Pluggy. Tente novamente mais tarde.",
      502,
    );
  const result = await response.json();
  if (typeof result.apiKey !== "string")
    throw new AppError("Resposta de autenticação inválida.", 502);
  cachedKey = { key: result.apiKey, expires: Date.now() + 100 * 60 * 1000 };
  return result.apiKey as string;
}
async function request<T>(path: string): Promise<T> {
  const key = await apiKey();
  let response = await fetch(endpoint + path, {
    headers: { "X-API-KEY": key },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 401) {
    cachedKey = undefined;
    response = await fetch(endpoint + path, {
      headers: { "X-API-KEY": await apiKey() },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  }
  if (!response.ok) {
    if (response.status === 403)
      throw new AppError(
        "A aplicação Pluggy não tem permissão para este recurso.",
        403,
      );
    if (response.status === 404)
      throw new AppError(
        "Conexão não encontrada. Confira o itemId e a aplicação Pluggy.",
        404,
      );
    if (response.status === 410)
      throw new AppError(
        "A Pluggy descontinuou este endpoint. Atualize o aplicativo e tente novamente.",
        410,
      );
    if (response.status === 429)
      throw new AppError(
        "Limite da Pluggy atingido. Aguarde alguns minutos.",
        429,
      );
    throw new AppError(
      "A Pluggy está indisponível no momento. Seus dados locais foram preservados.",
      502,
    );
  }
  return response.json();
}
async function pages<T>(path: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= pageLimit; page++) {
    const result = await request<Page<T>>(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}&pageSize=500`,
    );
    if (!Array.isArray(result.results))
      throw new AppError("A Pluggy retornou uma lista inválida.", 502);
    all.push(...result.results);
    if (!Number.isFinite(result.totalPages) || page >= result.totalPages)
      return all;
  }
  throw new AppError(
    "A conexão excedeu o limite de páginas. A importação foi cancelada sem alterar os dados.",
    502,
  );
}
async function cursorPages<T>(path: string): Promise<T[]> {
  const all: T[] = [];
  let nextPath = path;
  for (let page = 1; page <= pageLimit; page++) {
    const result = await request<CursorPage<T>>(nextPath);
    if (!Array.isArray(result.results))
      throw new AppError("A Pluggy retornou uma lista inválida.", 502);
    all.push(...result.results);
    if (!result.next) return all;
    if (!result.next.startsWith("?"))
      throw new AppError("A Pluggy retornou uma paginação inválida.", 502);
    const base = path.split("?")[0] || path;
    nextPath = `${base}${result.next}`;
  }
  throw new AppError(
    "A conexão excedeu o limite de páginas. A importação foi cancelada sem alterar os dados.",
    502,
  );
}
// Manual sync and webhook deliveries must not overwrite each other with older reads.
const itemQueues = new Map<string, Promise<SyncResult>>();
export function syncItem(itemId: string): Promise<SyncResult> {
  const previous = itemQueues.get(itemId) ?? Promise.resolve();
  const pending = previous
    .catch(() => undefined)
    .then(() => importItem(itemId));
  itemQueues.set(itemId, pending);
  const cleanup = () => {
    if (itemQueues.get(itemId) === pending) itemQueues.delete(itemId);
  };
  void pending.then(cleanup, cleanup);
  return pending;
}
async function importItem(itemId: string): Promise<SyncResult> {
  const database = db();
  try {
    const item = await request<RemoteItem>(
      `/items/${encodeURIComponent(itemId)}`,
    );
    if (
      item.consentExpiresAt &&
      Date.parse(item.consentExpiresAt) <= Date.now()
    )
      throw new AppError(
        "O consentimento expirou. Autorize o MeuPluggy novamente no Dashboard e confira o novo itemId.",
      );
    if (
      item.status === "LOGIN_ERROR" ||
      item.error?.code === "USER_AUTHORIZATION_EXPIRED"
    )
      throw new AppError(
        "A conexão precisa de autorização. Acesse o Meu Pluggy para renová-la.",
      );
    if (!["UPDATED", "OUTDATED"].includes(item.status))
      throw new AppError(
        "A conexão ainda está sendo processada ou precisa de atenção no Meu Pluggy. Tente novamente depois.",
      );
    const accounts = await pages<RemoteAccount>(
      `/accounts?itemId=${encodeURIComponent(itemId)}`,
    );
    const transactions: {
      account: RemoteAccount;
      rows: RemoteTransaction[];
    }[] = [];
    for (const account of accounts)
      transactions.push({
        account,
        rows: await cursorPages<RemoteTransaction>(
          `/v2/transactions?accountId=${encodeURIComponent(account.id)}`,
        ),
      });
    let investments: RemoteInvestment[] | null = null,
      warning: string | undefined;
    try {
      investments = await pages<RemoteInvestment>(
        `/investments?itemId=${encodeURIComponent(itemId)}`,
      );
    } catch (error) {
      if (error instanceof AppError && error.status === 403)
        warning =
          "Contas e transações importadas. Investimentos indisponíveis para esta conexão; posições locais preservadas.";
      else throw error;
    }
    const connection = database
      .prepare("SELECT name FROM connections WHERE id=?")
      .get(itemId) as { name: string } | undefined;
    const institution = resolveInstitution(
      item.connector?.name,
      connection?.name,
    );
    let count = 0;
    database.transaction(() => {
      const accUpsert = database.prepare(
        `INSERT INTO accounts(id,mode,name,institution,type,balance,currency,item_id,available_credit_limit,credit_limit) VALUES(?,'personal',?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,institution=excluded.institution,type=excluded.type,balance=excluded.balance,currency=excluded.currency,item_id=excluded.item_id,available_credit_limit=excluded.available_credit_limit,credit_limit=excluded.credit_limit`,
      );
      for (const account of accounts) {
        const available =
          account.creditData?.availableCreditLimit != null
            ? cents(account.creditData.availableCreditLimit)
            : null;
        const limit =
          account.creditData?.creditLimit != null
            ? cents(account.creditData.creditLimit)
            : null;
        accUpsert.run(
          account.id,
          cleanAccountName(account, institution),
          institution,
          account.type,
          cents(account.balance),
          account.currencyCode || "BRL",
          itemId,
          available,
          limit,
        );
      }
      const txnUpsert = database.prepare(
        `INSERT INTO transactions(id,mode,description,amount,kind,date,status,group_id,category,account_id,source,currency,installment_number,installment_total)
         VALUES(?,'personal',?,?,?,?,?,?,?,?,'pluggy',?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           description=excluded.description,
           amount=excluded.amount,
           kind=CASE WHEN transactions.user_categorized=1 THEN transactions.kind ELSE excluded.kind END,
           date=excluded.date,
           status=excluded.status,
           account_id=excluded.account_id,
           currency=excluded.currency,
           installment_number=excluded.installment_number,
           installment_total=excluded.installment_total,
           group_id=CASE WHEN transactions.user_categorized=1 OR transactions.category!='Sem categoria' THEN transactions.group_id ELSE excluded.group_id END,
           category=CASE WHEN transactions.user_categorized=1 OR transactions.category!='Sem categoria' THEN transactions.category ELSE excluded.category END`,
      );
      for (const { account, rows } of transactions)
        for (const row of rows) {
          const amount = cents(
            Math.abs(row.amountInAccountCurrency ?? row.amount),
          );
          if (!amount) continue;
          const description = cleanTransactionDescription(
            row.description || "Transação importada",
          );
          const kind = transactionKind({ ...row, description });
          const classified = categorizeTransaction({ description, kind });
          const installment = remoteInstallment({ ...row, description });
          txnUpsert.run(
            row.id,
            description,
            amount,
            kind,
            row.date.slice(0, 10),
            row.status === "POSTED" ? "paid" : "pending",
            classified.groupId,
            classified.category,
            account.id,
            account.currencyCode || row.currencyCode || "BRL",
            installment?.current ?? null,
            installment?.total ?? null,
          );
          count++;
        }
      if (investments) {
        const ids = new Set(investments.map((row) => row.id));
        const previous = database
          .prepare(
            "SELECT id FROM investments WHERE item_id=? AND source='pluggy'",
          )
          .all(itemId) as { id: string }[];
        for (const row of previous)
          if (!ids.has(row.id))
            database
              .prepare("DELETE FROM investments WHERE id=? AND source='pluggy'")
              .run(row.id);
        // `amount` is gross balance, not cost. Prefer `amountOriginal` when the bank sends it.
        // If Pluggy has no original, keep any cost the user typed manually.
        const invUpsert = database.prepare(
          `INSERT INTO investments(id,mode,name,institution,type,balance,invested,group_id,currency,source,item_id) VALUES(?,'personal',?,?,?,?,?,'personal-future',?,'pluggy',?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,institution=excluded.institution,type=excluded.type,balance=excluded.balance,invested=COALESCE(excluded.invested,investments.invested),currency=excluded.currency,item_id=excluded.item_id`,
        );
        for (const row of investments) {
          const original =
            row.amountOriginal != null && row.amountOriginal > 0
              ? cents(row.amountOriginal)
              : null;
          invUpsert.run(
            row.id,
            row.name,
            institution,
            row.type,
            Math.max(0, cents(row.balance)),
            original,
            row.currencyCode || "BRL",
            itemId,
          );
        }
      }
      database
        .prepare(
          "UPDATE connections SET status=?,last_sync=?,error=?,consent_expires_at=? WHERE id=?",
        )
        .run(
          item.status,
          new Date().toISOString(),
          warning || null,
          item.consentExpiresAt || null,
          itemId,
        );
    })();
    reconcileRecurrings(database, "personal");
    return {
      itemId,
      ok: true,
      accounts: accounts.length,
      transactions: count,
      investments: investments?.length,
      warning,
    };
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : "Não foi possível acessar a Pluggy. Verifique a conexão e tente novamente.";
    database
      .prepare("UPDATE connections SET status='ERROR',error=? WHERE id=?")
      .run(message, itemId);
    return { itemId, ok: false, error: message };
  }
}
let syncing = false;
export async function syncAll() {
  if (syncing)
    throw new AppError("Uma sincronização já está em andamento.", 409);
  syncing = true;
  try {
    await apiKey();
    const database = db();
    repairAccountInstitutions(database);
    const connections = database
      .prepare("SELECT id FROM connections WHERE mode='personal'")
      .all() as { id: string }[];
    if (!connections.length)
      throw new AppError(
        "Adicione o itemId da sua conexão antes de sincronizar.",
      );
    const results: SyncResult[] = [];
    for (const item of connections) results.push(await syncItem(item.id));
    return results;
  } finally {
    syncing = false;
  }
}
