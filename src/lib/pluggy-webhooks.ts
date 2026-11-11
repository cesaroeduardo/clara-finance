import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { apiError, AppError } from "./http";
import { syncItem } from "./pluggy";

const envelopeSchema = z.object({
  event: z.string().min(1).max(100),
  eventId: z.string().uuid(),
  clientId: z.string().min(1).max(128),
});
const itemSchema = z.object({ itemId: z.string().uuid() });
const supportedEvents = new Set(["item/created", "item/updated", "item/error"]);
type StoredEvent = {
  event_id: string;
  event: string;
  item_id: string;
  status: string;
};
type Schedule = (task: () => Promise<void>) => void;

function authenticate(request: Request) {
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (
    !secret ||
    !process.env.PLUGGY_CLIENT_ID ||
    !process.env.PLUGGY_CLIENT_SECRET
  )
    throw new AppError(
      "Configure as credenciais e PLUGGY_WEBHOOK_SECRET no .env.local.",
      503,
    );
  const supplied = Buffer.from(
    request.headers.get("x-pluggy-webhook-secret") ?? "",
  );
  const expected = Buffer.from(secret);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new AppError("Webhook não autorizado.", 401);
}

export async function receivePluggyWebhook(
  request: Request,
  schedule: Schedule,
) {
  try {
    authenticate(request);
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new AppError("Envie dados no formato JSON.", 415);
    const body: unknown = await request.json();
    const event = envelopeSchema.parse(body);
    if (
      event.clientId !== process.env.PLUGGY_CLIENT_ID ||
      !supportedEvents.has(event.event)
    )
      return Response.json({ received: true, ignored: true });
    const { itemId } = itemSchema.parse(body);
    const database = db();
    // Authorization to import an institution is given by registering it in Clara.
    if (
      !database
        .prepare("SELECT 1 FROM connections WHERE id=? AND mode='personal'")
        .get(itemId)
    )
      return Response.json({ received: true, ignored: true });
    const previous = database
      .prepare("SELECT * FROM pluggy_webhook_events WHERE event_id=?")
      .get(event.eventId) as StoredEvent | undefined;
    if (
      previous &&
      (previous.item_id !== itemId || previous.event !== event.event)
    )
      throw new AppError("O identificador do evento já foi usado.", 409);
    if (previous?.status === "processed")
      return Response.json({ received: true, duplicate: true });

    // Persist before acknowledging: a restart cannot erase a received notification.
    database
      .prepare(
        `INSERT INTO pluggy_webhook_events(event_id,event,item_id) VALUES(?,?,?)
      ON CONFLICT(event_id) DO UPDATE SET status='pending',error=NULL`,
      )
      .run(event.eventId, event.event, itemId);
    console.info("Webhook Pluggy recebido:", event.event, event.eventId);
    schedule(processPendingPluggyWebhooks);
    return Response.json({ received: true });
  } catch (error) {
    return apiError(error);
  }
}

let worker: Promise<void> | undefined;
export function processPendingPluggyWebhooks(): Promise<void> {
  if (worker) return worker;
  worker = drain().finally(() => {
    worker = undefined;
  });
  return worker;
}

async function drain() {
  const database = db();
  let event: StoredEvent | undefined;
  while (
    (event = database
      .prepare(
        "SELECT * FROM pluggy_webhook_events WHERE status='pending' ORDER BY rowid LIMIT 1",
      )
      .get() as StoredEvent | undefined)
  ) {
    try {
      if (
        !database
          .prepare("SELECT 1 FROM connections WHERE id=? AND mode='personal'")
          .get(event.item_id)
      ) {
        database
          .prepare(
            "UPDATE pluggy_webhook_events SET status='processed',processed_at=CURRENT_TIMESTAMP WHERE event_id=?",
          )
          .run(event.event_id);
        continue;
      }
      // All three events are signals. Read the current Item with our API key;
      // never write balances, error messages or URLs supplied in a webhook.
      const result = await syncItem(event.item_id);
      database
        .prepare(
          "UPDATE pluggy_webhook_events SET status=?,processed_at=CURRENT_TIMESTAMP,error=? WHERE event_id=?",
        )
        .run(
          result.ok ? "processed" : "failed",
          result.error ?? null,
          event.event_id,
        );
    } catch {
      database
        .prepare(
          "UPDATE pluggy_webhook_events SET status='failed',error=? WHERE event_id=?",
        )
        .run(
          "Falha ao processar o aviso. Reenvie o evento ou sincronize manualmente.",
          event.event_id,
        );
      console.error("Falha ao processar webhook Pluggy:", event.event_id);
    }
  }
}
