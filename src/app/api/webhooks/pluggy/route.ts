import { after } from "next/server";
import { receivePluggyWebhook } from "@/lib/pluggy-webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return receivePluggyWebhook(request, after);
}
