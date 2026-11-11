import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import {
  receivePluggyWebhook,
  processPendingPluggyWebhooks,
} from "../src/lib/pluggy-webhooks";
import { syncItem } from "../src/lib/pluggy";

fs.mkdirSync("work", { recursive: true });
process.env.DATABASE_PATH = path.join(
  fs.mkdtempSync(path.join(process.cwd(), "work", "webhook-tests-")),
  "test.sqlite",
);
process.env.PLUGGY_CLIENT_ID = randomUUID();
process.env.PLUGGY_CLIENT_SECRET = "test-client-secret";
process.env.PLUGGY_WEBHOOK_SECRET = "test-webhook-secret";
const database = db();
const itemId = randomUUID();
database
  .prepare(
    "INSERT INTO connections(id,mode,name) VALUES(?,'personal','Banco teste')",
  )
  .run(itemId);
after(() => database.close());

function payload(
  event = "item/updated",
  overrides: Record<string, unknown> = {},
) {
  return {
    event,
    eventId: randomUUID(),
    clientId: process.env.PLUGGY_CLIENT_ID,
    itemId,
    ...overrides,
  };
}
function request(
  body: unknown,
  secret: string | null = process.env.PLUGGY_WEBHOOK_SECRET!,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret !== null) headers["x-pluggy-webhook-secret"] = secret;
  // Public host: webhooks use their own authentication, not the local UI guard.
  return new Request("https://webhook.example/api/webhooks/pluggy", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
function scheduled() {
  const tasks: (() => Promise<void>)[] = [];
  return {
    tasks,
    schedule: (task: () => Promise<void>) => {
      tasks.push(task);
    },
  };
}
function stored(id: string) {
  return database
    .prepare("SELECT status,error FROM pluggy_webhook_events WHERE event_id=?")
    .get(id) as { status: string; error: string | null };
}
async function mockPluggy(
  run: (calls: string[]) => Promise<void>,
  options: { status?: string; fail?: boolean } = {},
) {
  const original = global.fetch;
  const calls: string[] = [];
  global.fetch = (async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.pluggy.ai");
    calls.push(url.pathname);
    if (url.pathname === "/auth")
      return Response.json({ apiKey: "test-api-key" });
    if (options.fail) return Response.json({}, { status: 503 });
    if (url.pathname.startsWith("/items/"))
      return Response.json({ id: itemId, status: options.status ?? "UPDATED" });
    return Response.json({ results: [], page: 1, totalPages: 1 });
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    global.fetch = original;
  }
}

test("webhook exige configuração, segredo correto e JSON válido", async () => {
  const { tasks, schedule } = scheduled();
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  delete process.env.PLUGGY_WEBHOOK_SECRET;
  assert.equal(
    (await receivePluggyWebhook(request(payload(), null), schedule)).status,
    503,
  );
  process.env.PLUGGY_WEBHOOK_SECRET = secret;
  for (const supplied of [null, "invalid", "wrong-secret-length"]) {
    assert.equal(
      (await receivePluggyWebhook(request(payload(), supplied), schedule))
        .status,
      401,
    );
  }
  assert.equal(
    (await receivePluggyWebhook(request("{"), schedule)).status,
    400,
  );
  assert.equal(
    (
      await receivePluggyWebhook(
        request({ ...payload(), itemId: "invalid" }),
        schedule,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await receivePluggyWebhook(
        new Request("https://webhook.example", {
          method: "POST",
          headers: { "x-pluggy-webhook-secret": secret! },
          body: "text",
        }),
        schedule,
      )
    ).status,
    415,
  );
  assert.equal(tasks.length, 0);
});

test("ignora outras aplicações, eventos e conexões sem importar ou cadastrar contas", async () => {
  const { tasks, schedule } = scheduled();
  const demoId = randomUUID();
  database
    .prepare("INSERT INTO connections(id,mode,name) VALUES(?,'demo','Demo')")
    .run(demoId);
  await mockPluggy(async (calls) => {
    for (const body of [
      payload("item/updated", { clientId: randomUUID() }),
      payload("connector/status_updated", { itemId: undefined }),
      payload("item/created", { itemId: randomUUID() }),
      payload("item/updated", { itemId: demoId }),
    ]) {
      const response = await receivePluggyWebhook(request(body), schedule);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        received: true,
        ignored: true,
      });
      assert.equal(stored(body.eventId), undefined);
    }
    assert.equal(calls.length, 0);
    assert.equal(tasks.length, 0);
  });
});

test("confirma antes da importação, persiste e não repete evento já processado", async () => {
  const { tasks, schedule } = scheduled();
  const event = payload("item/created");
  await mockPluggy(async (calls) => {
    const response = await receivePluggyWebhook(request(event), schedule);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true });
    assert.equal(
      calls.length,
      0,
      "nenhuma chamada à Pluggy antes de responder",
    );
    assert.equal(stored(event.eventId).status, "pending");
    assert.equal(tasks.length, 1);
    await tasks[0]();
    assert.equal(stored(event.eventId).status, "processed");
    assert.ok(calls.some((call) => call === `/items/${itemId}`));
    const count = calls.length;
    const duplicate = await receivePluggyWebhook(request(event), schedule);
    assert.deepEqual(await duplicate.json(), {
      received: true,
      duplicate: true,
    });
    assert.equal(tasks.length, 1);
    assert.equal(calls.length, count);
    assert.equal(
      (
        await receivePluggyWebhook(
          request({ ...event, event: "item/updated" }),
          schedule,
        )
      ).status,
      409,
    );
  });
});

test("falha após o recebimento fica registrada e pode ser reenviada", async () => {
  const { tasks, schedule } = scheduled();
  const event = payload();
  await mockPluggy(
    async () => {
      assert.equal(
        (await receivePluggyWebhook(request(event), schedule)).status,
        200,
      );
      await tasks[0]();
      assert.equal(stored(event.eventId).status, "failed");
    },
    { fail: true },
  );
  await mockPluggy(async () => {
    await receivePluggyWebhook(request(event), schedule);
    await tasks[1]();
    assert.equal(stored(event.eventId).status, "processed");
    assert.equal(stored(event.eventId).error, null);
  });
});

test("item/error consulta o estado atual e não grava mensagem arbitrária do webhook", async () => {
  const { tasks, schedule } = scheduled();
  await mockPluggy(
    async (calls) => {
      await receivePluggyWebhook(
        request(
          payload("item/error", { error: { message: "MENSAGEM FORJADA" } }),
        ),
        schedule,
      );
      await tasks[0]();
      assert.deepEqual(calls, [`/items/${itemId}`]);
      const connection = database
        .prepare("SELECT status,error FROM connections WHERE id=?")
        .get(itemId) as { status: string; error: string };
      assert.equal(connection.status, "ERROR");
      assert.match(connection.error, /autorização/);
      assert.ok(!connection.error.includes("MENSAGEM FORJADA"));
    },
    { status: "LOGIN_ERROR" },
  );
});

test("avisos pendentes podem ser retomados sem o corpo original", async () => {
  const { schedule } = scheduled();
  const event = payload();
  await receivePluggyWebhook(request(event), schedule);
  await mockPluggy(async () => {
    await processPendingPluggyWebhooks();
    assert.equal(stored(event.eventId).status, "processed");
  });
});

test("sincronização manual e webhook da mesma instituição são serializados", async () => {
  const { tasks, schedule } = scheduled();
  await receivePluggyWebhook(request(payload()), schedule);
  const original = global.fetch;
  let reads = 0;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const firstRead = new Promise<void>((resolve) => {
    started = resolve;
  });
  global.fetch = (async (input) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith("/items/")) {
      reads++;
      if (reads === 1) {
        started();
        await blocked;
      }
      return Response.json({ id: itemId, status: "UPDATED" });
    }
    return Response.json({ results: [], totalPages: 1, page: 1 });
  }) as typeof fetch;
  try {
    const manual = syncItem(itemId);
    await firstRead;
    const webhook = tasks[0]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(reads, 1, "o webhook aguarda a leitura manual terminar");
    release();
    await Promise.all([manual, webhook]);
    assert.equal(reads, 2);
  } finally {
    release();
    global.fetch = original;
  }
});
