import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { monthKey } from "./format";
import type {
  Account,
  Connection,
  FinanceData,
  Goal,
  Group,
  Investment,
  Mode,
  Transaction,
} from "./types";

const globalDb = globalThis as unknown as { financeDb?: Database.Database };
export function db() {
  if (globalDb.financeDb) return globalDb.financeDb;
  const file =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), "data", "finances.sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const database = new Database(file);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL,
      icon TEXT NOT NULL, budget INTEGER NOT NULL DEFAULT 0 CHECK(budget >= 0));
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'personal', name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING', last_sync TEXT, error TEXT, consent_expires_at TEXT);
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL, name TEXT NOT NULL, institution TEXT NOT NULL,
      type TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, color TEXT NOT NULL DEFAULT '#2563eb',
      currency TEXT NOT NULL DEFAULT 'BRL', item_id TEXT REFERENCES connections(id));
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL, description TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0), kind TEXT NOT NULL CHECK(kind IN ('income','expense','transfer')),
      date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('paid','pending')),
      group_id TEXT NOT NULL REFERENCES groups(id), category TEXT NOT NULL,
      account_id TEXT REFERENCES accounts(id), source TEXT NOT NULL DEFAULT 'manual',
      currency TEXT NOT NULL DEFAULT 'BRL', user_categorized INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS transactions_mode_date ON transactions(mode,date);
    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL, name TEXT NOT NULL, institution TEXT NOT NULL,
      type TEXT NOT NULL, balance INTEGER NOT NULL CHECK(balance >= 0), invested INTEGER CHECK(invested >= 0),
      group_id TEXT NOT NULL REFERENCES groups(id), currency TEXT NOT NULL DEFAULT 'BRL', source TEXT NOT NULL DEFAULT 'manual', item_id TEXT REFERENCES connections(id));
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL, name TEXT NOT NULL, target INTEGER NOT NULL CHECK(target > 0),
      current INTEGER NOT NULL DEFAULT 0 CHECK(current >= 0), deadline TEXT NOT NULL,
      group_id TEXT NOT NULL REFERENCES groups(id), icon TEXT NOT NULL, color TEXT NOT NULL);
    INSERT OR IGNORE INTO schema_migrations(version) VALUES(1);
  `);
  if (
    !database.prepare("SELECT 1 FROM schema_migrations WHERE version=2").get()
  ) {
    const columns = database.pragma("table_info(investments)") as {
      name: string;
      notnull: number;
    }[];
    if (columns.find((column) => column.name === "invested")?.notnull)
      database.transaction(() => {
        database.exec(`CREATE TABLE investments_new (
        id TEXT PRIMARY KEY, mode TEXT NOT NULL, name TEXT NOT NULL, institution TEXT NOT NULL,
        type TEXT NOT NULL, balance INTEGER NOT NULL CHECK(balance >= 0), invested INTEGER CHECK(invested >= 0),
        group_id TEXT NOT NULL REFERENCES groups(id), currency TEXT NOT NULL DEFAULT 'BRL', source TEXT NOT NULL DEFAULT 'manual', item_id TEXT REFERENCES connections(id));
        INSERT INTO investments_new SELECT id,mode,name,institution,type,balance,CASE WHEN source='pluggy' THEN NULL ELSE invested END,group_id,currency,source,item_id FROM investments;
        DROP TABLE investments;
        ALTER TABLE investments_new RENAME TO investments;`);
      })();
    database.prepare("INSERT INTO schema_migrations(version) VALUES(2)").run();
  }
  if (
    !database.prepare("SELECT 1 FROM schema_migrations WHERE version=3").get()
  )
    database.transaction(() => {
      database.exec(`
        CREATE TABLE pluggy_webhook_events (
          event_id TEXT PRIMARY KEY, event TEXT NOT NULL, item_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed','failed')),
          received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TEXT, error TEXT);
        INSERT INTO schema_migrations(version) VALUES(3);
      `);
    })();
  if (
    !database.prepare("SELECT 1 FROM schema_migrations WHERE version=4").get()
  )
    database.transaction(() => {
      database.exec(`
        ALTER TABLE accounts ADD COLUMN available_credit_limit INTEGER;
        ALTER TABLE accounts ADD COLUMN credit_limit INTEGER;
        UPDATE accounts SET credit_limit=1500000, available_credit_limit=1285210 WHERE id='demo-credit';
        UPDATE accounts SET credit_limit=500000, available_credit_limit=401350 WHERE id='demo-credit-sicredi';
        INSERT INTO schema_migrations(version) VALUES(4);
      `);
    })();
  globalDb.financeDb = database;
  for (const mode of ["personal", "demo"] as const) {
    const insert = database.prepare(
      "INSERT OR IGNORE INTO groups(id,mode,name,color,icon,budget) VALUES(?,?,?,?,?,?)",
    );
    for (const [slug, name, color, icon, budget] of [
      ["home", "Casa & rotina", "#2563eb", "house", 500000],
      ["life", "Estilo de vida", "#8b5cf6", "coffee", 200000],
      ["future", "Meu futuro", "#10a36b", "sprout", 300000],
      ["work", "Trabalho", "#f4a52b", "briefcase", 0],
      ["other", "Sem grupo", "#94a3b8", "layers", 0],
    ] as const)
      insert.run(
        `${mode}-${slug}`,
        mode,
        name,
        color,
        icon,
        mode === "demo" ? budget : 0,
      );
  }
  if (!database.prepare("SELECT 1 FROM accounts WHERE mode='demo'").get())
    seedDemo(database);
  return database;
}

function seedDemo(database: Database.Database) {
  const month = monthKey();
  const previous = new Date(month + "-15T12:00:00");
  previous.setMonth(previous.getMonth() - 1);
  const prev = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
  database.transaction(() => {
    const account = database.prepare(
      "INSERT INTO accounts(id,mode,name,institution,type,balance,color,available_credit_limit,credit_limit) VALUES(?,'demo',?,?,?,?,?,?,?)",
    );
    account.run(
      "demo-nubank",
      "Conta principal",
      "Nubank",
      "BANK",
      830428,
      "#820ad1",
      null,
      null,
    );
    account.run(
      "demo-itau",
      "Conta corrente",
      "Itaú",
      "BANK",
      245000,
      "#f58220",
      null,
      null,
    );
    account.run(
      "demo-credit",
      "Ultravioleta",
      "Nubank",
      "CREDIT",
      -214790,
      "#5a1a8f",
      1285210,
      1500000,
    );
    account.run(
      "demo-credit-sicredi",
      "Visa Internacional",
      "Sicredi",
      "CREDIT",
      -98650,
      "#3fb449",
      401350,
      500000,
    );
    const add = database.prepare(
      "INSERT INTO transactions(id,mode,description,amount,kind,date,status,group_id,category,account_id) VALUES(?,'demo',?,?,?,?,?,?,?,?)",
    );
    const rows = [
      [
        "salary",
        "Salário",
        1250000,
        "income",
        "05",
        "paid",
        "work",
        "Salário",
        "demo-nubank",
      ],
      [
        "freelance",
        "Projeto freelance",
        180000,
        "income",
        "08",
        "paid",
        "work",
        "Freelance",
        "demo-itau",
      ],
      [
        "rent",
        "Aluguel",
        240000,
        "expense",
        "05",
        "paid",
        "home",
        "Moradia",
        "demo-nubank",
      ],
      [
        "market",
        "Mercado Natural",
        48762,
        "expense",
        "09",
        "paid",
        "home",
        "Alimentação",
        "demo-nubank",
      ],
      [
        "coffee",
        "Café do Centro",
        2890,
        "expense",
        "10",
        "paid",
        "life",
        "Restaurantes",
        "demo-nubank",
      ],
      [
        "uber",
        "Uber",
        2470,
        "expense",
        "09",
        "paid",
        "life",
        "Transporte",
        "demo-nubank",
      ],
      [
        "netflix",
        "Netflix",
        5590,
        "expense",
        "08",
        "paid",
        "life",
        "Assinaturas",
        "demo-nubank",
      ],
      [
        "electric",
        "Energia elétrica",
        18690,
        "expense",
        "12",
        "pending",
        "home",
        "Contas da casa",
        "demo-nubank",
      ],
      [
        "internet",
        "Internet fibra",
        12990,
        "expense",
        "15",
        "pending",
        "home",
        "Contas da casa",
        "demo-nubank",
      ],
      [
        "gym",
        "Academia",
        14990,
        "expense",
        "18",
        "pending",
        "life",
        "Saúde",
        "demo-nubank",
      ],
      [
        "condo",
        "Condomínio",
        65000,
        "expense",
        "20",
        "pending",
        "home",
        "Moradia",
        "demo-nubank",
      ],
      [
        "dinner",
        "Jantar com amigos",
        18650,
        "expense",
        "07",
        "paid",
        "life",
        "Restaurantes",
        "demo-nubank",
      ],
      [
        "pharmacy",
        "Farmácia",
        9780,
        "expense",
        "06",
        "paid",
        "home",
        "Saúde",
        "demo-nubank",
      ],
      [
        "investment",
        "Aporte na reserva",
        200000,
        "transfer",
        "06",
        "paid",
        "future",
        "Investimentos",
        "demo-nubank",
      ],
    ] as const;
    for (const [
      id,
      desc,
      amount,
      kind,
      day,
      status,
      group,
      category,
      acc,
    ] of rows)
      add.run(
        `demo-${id}`,
        desc,
        amount,
        kind,
        `${month}-${day}`,
        status,
        `demo-${group}`,
        category,
        acc,
      );
    for (const [
      id,
      desc,
      amount,
      kind,
      day,
      status,
      group,
      category,
      acc,
    ] of rows.slice(0, 10))
      add.run(
        `demo-prev-${id}`,
        desc,
        Math.round(amount * 0.94),
        kind,
        `${prev}-${day}`,
        status,
        `demo-${group}`,
        category,
        acc,
      );
    const inv = database.prepare(
      "INSERT INTO investments(id,mode,name,institution,type,balance,invested,group_id) VALUES(?,'demo',?,?,?,?,?,'demo-future')",
    );
    inv.run(
      "demo-cdb",
      "CDB 110% do CDI",
      "Nubank",
      "FIXED_INCOME",
      2845000,
      2600000,
    );
    inv.run(
      "demo-tesouro",
      "Tesouro IPCA+ 2029",
      "Itaú",
      "FIXED_INCOME",
      1687500,
      1500000,
    );
    inv.run("demo-etf", "IVVB11", "XP Investimentos", "ETF", 842000, 800000);
    const goal = database.prepare(
      "INSERT INTO goals(id,mode,name,target,current,deadline,group_id,icon,color) VALUES(?,'demo',?,?,?,?,?,?,?)",
    );
    goal.run(
      "demo-reserve",
      "Reserva de emergência",
      4000000,
      2845000,
      `${Number(month.slice(0, 4)) + 1}-06-30`,
      "demo-future",
      "shield",
      "#2563eb",
    );
    goal.run(
      "demo-travel",
      "Próxima viagem",
      1500000,
      620000,
      `${Number(month.slice(0, 4)) + 1}-09-01`,
      "demo-life",
      "plane",
      "#f4a52b",
    );
    goal.run(
      "demo-home-goal",
      "Meu cantinho",
      8000000,
      1687500,
      `${Number(month.slice(0, 4)) + 2}-12-01`,
      "demo-home",
      "house",
      "#8b5cf6",
    );
  })();
}

export function getData(mode: Mode): FinanceData {
  const database = db();
  const query = <T>(sql: string) => database.prepare(sql).all(mode) as T[];
  return {
    mode,
    groups: query<Group>(
      "SELECT id,name,color,icon,budget FROM groups WHERE mode=? ORDER BY rowid",
    ),
    accounts: query<Account>(
      "SELECT id,name,institution,type,balance,available_credit_limit AS availableCreditLimit,credit_limit AS creditLimit,color,currency,item_id AS itemId FROM accounts WHERE mode=? ORDER BY rowid",
    ),
    transactions: query<Transaction>(
      "SELECT id,description,amount,kind,date,status,group_id AS groupId,category,account_id AS accountId,source,currency FROM transactions WHERE mode=? ORDER BY date DESC,rowid DESC",
    ),
    investments: query<Investment>(
      "SELECT id,name,institution,type,balance,invested,group_id AS groupId,currency,source FROM investments WHERE mode=? ORDER BY balance DESC",
    ),
    goals: query<Goal>(
      "SELECT id,name,target,current,deadline,group_id AS groupId,icon,color FROM goals WHERE mode=? ORDER BY rowid",
    ),
    connections: query<Connection>(
      "SELECT id,name,status,last_sync AS lastSync,error,consent_expires_at AS consentExpiresAt FROM connections WHERE mode=? ORDER BY rowid",
    ),
    pluggyConfigured: !!(
      process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET
    ),
    updatedAt: new Date().toISOString(),
  };
}
