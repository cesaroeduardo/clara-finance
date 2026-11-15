import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_CHARS = 900;
const DEFAULT_XTTS_URL = "http://127.0.0.1:8020/tts";

type Body = { text?: unknown };

function xttsEnabled() {
  return (
    process.env.NEXT_PUBLIC_CLARA_XTTS === "true" ||
    process.env.CLARA_XTTS_ENABLED === "true"
  );
}

export async function POST(request: NextRequest) {
  if (!xttsEnabled()) {
    return NextResponse.json(
      {
        error:
          "Voz sintética desligada. Defina NEXT_PUBLIC_CLARA_XTTS=true em .env.local.",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const text =
    typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (!text) {
    return NextResponse.json({ error: "Texto vazio." }, { status: 400 });
  }

  const xttsUrl = (
    process.env.CLARA_XTTS_URL?.trim() || DEFAULT_XTTS_URL
  ).replace(/\/$/, "");

  try {
    const upstream = await fetch(xttsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(110_000),
      cache: "no-store",
    });

    if (!upstream.ok) {
      let detail = `tts_${upstream.status}`;
      try {
        const payload = (await upstream.json()) as { detail?: unknown };
        if (typeof payload.detail === "string") detail = payload.detail;
      } catch {
        /* ignore non-JSON */
      }
      return NextResponse.json(
        { error: detail },
        { status: upstream.status === 503 ? 503 : 502 },
      );
    }

    const bytes = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get("Content-Type") ?? "audio/wav";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Clara-TTS": upstream.headers.get("X-Clara-TTS") ?? "xtts",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "TTS indisponível. Suba o sidecar em services/clara-xtts (porta 8020).",
      },
      { status: 503 },
    );
  }
}
