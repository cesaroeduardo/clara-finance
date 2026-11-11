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
  PlanSettings,
  Transaction,
} from "./types";
import { planForMonth } from "./analytics";
import { repairAccountInstitutions } from "./accounts";
import { cleanTransactionDescription } from "./categorize";
import {
  listRecurrings,
  normalizeMatchKey,
  reconcileRecurrings,
} from "./recurring";

const emptyPlan = (): PlanSettings => ({
  monthlyLimit: 0,
  fixedCost: 0,
  monthlySavings: 0,
  expectedSalary: 0,
  expectedFreelance: 0,
});

function mapPlanRow(row: Record<string, unknown> | undefined): PlanSettings {
  if (!row) return emptyPlan();
  return {
    monthlyLimit: Number(row.monthlyLimit ?? row.monthly_limit ?? 0),
    fixedCost: Number(row.fixedCost ?? row.fixed_cost ?? 0),
    monthlySavings: Number(row.monthlySavings ?? row.monthly_savings ?? 0),
    expectedSalary: Number(row.expectedSalary ?? row.expected_salary ?? 0),
    expectedFreelance: Number(
      row.expectedFreelance ?? row.expected_freelance ?? 0,
    ),
  };
}

export function listPlanMonths(
  database: Database.Database,
  mode: Mode,
): Record<string, PlanSettings> {
  const rows = database
    .prepare(
      `SELECT month,
              monthly_limit AS monthlyLimit,
              fixed_cost AS fixedCost,
              monthly_savings AS monthlySavings,
              expected_salary AS expectedSalary,
              expected_freelance AS expectedFreelance
       FROM plan_months WHERE mode=? ORDER BY month`,
    )
    .all(mode) as Array<Record<string, unknown> & { month: string }>;
  const plans: Record<string, PlanSettings> = {};
  for (const row of rows) plans[row.month] = mapPlanRow(row);
  return plans;
}


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
  if (
    !database.prepare("SELECT 1 FROM schema_migrations WHERE version=5").get()
  )
    database.transaction(() => {
      database.exec(`
        CREATE TABLE plan_settings (
          mode TEXT PRIMARY KEY,
          monthly_limit INTEGER NOT NULL DEFAULT 0 CHECK(monthly_limit >= 0),
          fixed_cost INTEGER NOT NULL DEFAULT 0 CHECK(fixed_cost >= 0),
          monthly_savings INTEGER NOT NULL DEFAULT 0 CHECK(monthly_savings >= 0)
        );
        INSERT OR IGNORE INTO plan_settings(mode, monthly_limit, fixed_cost, monthly_savings)
          VALUES ('personal', 0, 0, 0);
        INSERT OR IGNORE INTO plan_settings(mode, monthly_limit, fixed_cost, monthly_savings)
          VALUES ('demo', 700000, 250000, 150000);
        INSERT INTO schema_migrations(version) VALUES(5);
      `);
    })();
  if (
    !database.prepare("SELECT 1 FROM schema_migrations WHERE version=6").get()
  )
    database.transaction(() => {
      database.exec(`
        ALTER TABLE transactions ADD COLUMN installment_number INTEGER;
        ALTER TABLE transactions ADD COLUMN installment_total INTEGER;
        CREATE TABLE recurrings (
          id TEXT PRIMARY KEY,
          mode TEXT NOT NULL,
          kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
          type TEXT NOT NULL CHECK(type IN ('fixed','installment')),
          description TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK(amount > 0),
          day_of_month INTEGER NOT NULL CHECK(day_of_month BETWEEN 1 AND 31),
          frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency='monthly'),
          category TEXT NOT NULL,
          group_id TEXT NOT NULL REFERENCES groups(id),
          account_id TEXT REFERENCES accounts(id),
          installment_current INTEGER CHECK(installment_current IS NULL OR installment_current >= 1),
          installment_total INTEGER CHECK(installment_total IS NULL OR installment_total >= 2),
          start_date TEXT,
          end_date TEXT,
          source TEXT NOT NULL CHECK(source IN ('detected','manual')),
          match_key TEXT NOT NULL,
          ignored INTEGER NOT NULL DEFAULT 0 CHECK(ignored IN (0,1)),
          active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
          user_edited INTEGER NOT NULL DEFAULT 0 CHECK(user_edited IN (0,1)),
          currency TEXT NOT NULL DEFAULT 'BRL'
        );
        CREATE INDEX IF NOT EXISTS recurrings_mode_active ON recurrings(mode, active, ignored);
        CREATE UNIQUE INDEX IF NOT EXISTS recurrings_mode_identity
          ON recurrings(mode, kind, type, match_key, ifnull(installment_total, 0));
        INSERT INTO schema_migrations(version) VALUES(6);
      `);
    })();
  if (
    !database.prepare("SELECT 1 FROM schema_migrations WHERE version=7").get()
  )
    database.transaction(() => {
      database.exec(`
        ALTER TABLE plan_settings ADD COLUMN expected_salary INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE plan_settings ADD COLUMN expected_freelance INTEGER NOT NULL DEFAULT 0;
        UPDATE plan_settings
          SET expected_salary=880000, expected_freelance=200000
          WHERE mode='personal';
        UPDATE plan_settings
          SET expected_salary=900000, expected_freelance=100000
          WHERE mode='demo';
        INSERT INTO schema_migrations(version) VALUES(7);
      `);
    })();
  if (
    !database.prepare("SELECT 1 FROM schema_migrations WHERE version=8").get()
  )
    database.transaction(() => {
      database.exec(`
        CREATE TABLE plan_months (
          mode TEXT NOT NULL,
          month TEXT NOT NULL,
          monthly_limit INTEGER NOT NULL DEFAULT 0,
          fixed_cost INTEGER NOT NULL DEFAULT 0,
          monthly_savings INTEGER NOT NULL DEFAULT 0,
          expected_salary INTEGER NOT NULL DEFAULT 0,
          expected_freelance INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (mode, month)
        );
      `);
      const current = monthKey();
      const legacy = database
        .prepare(
          `SELECT mode, monthly_limit, fixed_cost, monthly_savings,
                  expected_salary, expected_freelance
           FROM plan_settings`,
        )
        .all() as Array<{
        mode: string;
        monthly_limit: number;
        fixed_cost: number;
        monthly_savings: number;
        expected_salary: number;
        expected_freelance: number;
      }>;
      const insert = database.prepare(
        `INSERT OR IGNORE INTO plan_months(
           mode, month, monthly_limit, fixed_cost, monthly_savings,
           expected_salary, expected_freelance
         ) VALUES(?,?,?,?,?,?,?)`,
      );
      for (const row of legacy) {
        insert.run(
          row.mode,
          current,
          row.monthly_limit,
          row.fixed_cost,
          row.monthly_savings,
          row.expected_salary,
          row.expected_freelance,
        );
      }
      database
        .prepare("INSERT INTO schema_migrations(version) VALUES(8)")
        .run();
    })();
  if (
    !database.prepare("SELECT 1 FROM schema_migrations WHERE version=9").get()
  )
    database.transaction(() => {
      const txns = database
        .prepare("SELECT id, description FROM transactions WHERE description LIKE '%|%'")
        .all() as Array<{ id: string; description: string }>;
      const updateTxn = database.prepare(
        "UPDATE transactions SET description=? WHERE id=?",
      );
      for (const row of txns) {
        const cleaned = cleanTransactionDescription(row.description);
        if (cleaned !== row.description) updateTxn.run(cleaned, row.id);
      }
      const recurrings = database
        .prepare("SELECT id, description, match_key FROM recurrings")
        .all() as Array<{
        id: string;
        description: string;
        match_key: string;
      }>;
      const updateRecurring = database.prepare(
        "UPDATE recurrings SET description=?, match_key=? WHERE id=?",
      );
      for (const row of recurrings) {
        const cleaned = cleanTransactionDescription(row.description);
        const matchKey = normalizeMatchKey(cleaned);
        if (!matchKey) continue;
        if (cleaned === row.description && matchKey === row.match_key) continue;
        updateRecurring.run(cleaned, matchKey, row.id);
      }
      database
        .prepare("INSERT INTO schema_migrations(version) VALUES(9)")
        .run();
    })();
  if (
    !database.prepare("SELECT 1 FROM schema_migrations WHERE version=10").get()
  )
    database.transaction(() => {
      repairAccountInstitutions(database);
      database
        .prepare("INSERT INTO schema_migrations(version) VALUES(10)")
        .run();
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
      "INSERT INTO transactions(id,mode,description,amount,kind,date,status,group_id,category,account_id,installment_number,installment_total) VALUES(?,'demo',?,?,?,?,?,?,?,?,?,?)",
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
        null,
        null,
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
        null,
        null,
      ],
      [
        "rent",
        "Aluguel",
        180000,
        "expense",
        "02",
        "paid",
        "home",
        "Moradia",
        "demo-nubank",
        null,
        null,
      ],
      [
        "smartfit",
        "Smart Fit",
        10990,
        "expense",
        "02",
        "paid",
        "life",
        "Saúde",
        "demo-nubank",
        null,
        null,
      ],
      [
        "amil",
        "AMIL Saúde",
        45000,
        "expense",
        "04",
        "paid",
        "home",
        "Saúde",
        "demo-nubank",
        null,
        null,
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
        null,
        null,
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
        null,
        null,
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
        null,
        null,
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
        null,
        null,
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
        null,
        null,
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
        null,
        null,
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
        null,
        null,
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
        null,
        null,
      ],
      [
        "iphone",
        "iPhone 14 11/12",
        40000,
        "expense",
        "06",
        "paid",
        "life",
        "Compras",
        "demo-credit",
        11,
        12,
      ],
      [
        "sofa",
        "TokStok Sofá 1/10",
        25000,
        "expense",
        "10",
        "pending",
        "home",
        "Moradia",
        "demo-credit",
        1,
        10,
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
        null,
        null,
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
        null,
        null,
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
        null,
        null,
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
      installmentNumber,
      installmentTotal,
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
        installmentNumber,
        installmentTotal,
      );
    const previousRows = rows.filter((row) =>
      [
        "salary",
        "rent",
        "smartfit",
        "amil",
        "netflix",
        "electric",
        "internet",
        "gym",
        "condo",
        "iphone",
      ].includes(String(row[0])),
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
      installmentNumber,
      installmentTotal,
    ] of previousRows) {
      const prevInstallment =
        installmentNumber != null ? Number(installmentNumber) - 1 : null;
      const prevDesc =
        id === "iphone" && prevInstallment
          ? `iPhone 14 ${prevInstallment}/12`
          : desc;
      add.run(
        `demo-prev-${id}`,
        prevDesc,
        id === "salary" || id === "rent" || id === "smartfit" || id === "amil"
          ? amount
          : Math.round(amount * 0.94),
        kind,
        `${prev}-${day}`,
        status === "pending" ? "paid" : status,
        `demo-${group}`,
        category,
        acc,
        prevInstallment,
        installmentTotal,
      );
    }
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
    database
      .prepare(
        `INSERT INTO plan_settings(
           mode, monthly_limit, fixed_cost, monthly_savings, expected_salary, expected_freelance
         )
         VALUES('demo', 700000, 250000, 150000, 900000, 100000)
         ON CONFLICT(mode) DO UPDATE SET
           monthly_limit=excluded.monthly_limit,
           fixed_cost=excluded.fixed_cost,
           monthly_savings=excluded.monthly_savings,
           expected_salary=excluded.expected_salary,
           expected_freelance=excluded.expected_freelance`,
      )
      .run();
    const current = monthKey();
    database
      .prepare(
        `INSERT INTO plan_months(
           mode, month, monthly_limit, fixed_cost, monthly_savings,
           expected_salary, expected_freelance
         ) VALUES('demo', ?, 700000, 250000, 150000, 900000, 100000)
         ON CONFLICT(mode, month) DO UPDATE SET
           monthly_limit=excluded.monthly_limit,
           fixed_cost=excluded.fixed_cost,
           monthly_savings=excluded.monthly_savings,
           expected_salary=excluded.expected_salary,
           expected_freelance=excluded.expected_freelance`,
      )
      .run(current);
  })();
}

export function getData(mode: Mode): FinanceData {
  const database = db();
  reconcileRecurrings(database, mode);
  const query = <T>(sql: string) => database.prepare(sql).all(mode) as T[];
  const legacy = mapPlanRow(
    database
      .prepare(
        `SELECT monthly_limit AS monthlyLimit, fixed_cost AS fixedCost,
                monthly_savings AS monthlySavings,
                expected_salary AS expectedSalary,
                expected_freelance AS expectedFreelance
         FROM plan_settings WHERE mode=?`,
      )
      .get(mode) as Record<string, unknown> | undefined,
  );
  const plans = listPlanMonths(database, mode);
  const plan = planForMonth({ plan: legacy, plans }, monthKey());
  return {
    mode,
    groups: query<Group>(
      "SELECT id,name,color,icon,budget FROM groups WHERE mode=? ORDER BY rowid",
    ),
    accounts: query<Account>(
      "SELECT id,name,institution,type,balance,available_credit_limit AS availableCreditLimit,credit_limit AS creditLimit,color,currency,item_id AS itemId FROM accounts WHERE mode=? ORDER BY rowid",
    ),
    transactions: query<Transaction>(
      `SELECT id,description,amount,kind,date,status,group_id AS groupId,category,account_id AS accountId,source,currency,
              installment_number AS installmentNumber, installment_total AS installmentTotal
       FROM transactions WHERE mode=? ORDER BY date DESC,rowid DESC`,
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
    recurrings: listRecurrings(database, mode),
    plan,
    plans,
    pluggyConfigured: !!(
      process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET
    ),
    updatedAt: new Date().toISOString(),
  };
}
