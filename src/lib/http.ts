import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Mode } from "./types";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
/** Loopback, rede privada (RFC1918) ou nome local (.lan / PC da LAN). */
export function isLocalNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1")
    return true;
  if (process.env.ALLOW_LAN_ACCESS !== "true") return false;
  if (/^10(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host)) return true;
  if (/\.(lan|local|home|internal|localdomain)$/.test(host)) return true;
  // Nome curto da máquina na LAN (NetBIOS / mDNS)
  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(host)) return true;
  return false;
}

/** Preview público (Vercel): libera hosts remotos só com opt-in explícito. */
export function isAllowedRequestHost(hostname: string): boolean {
  if (process.env.ALLOW_PUBLIC_PREVIEW === "true") return true;
  return isLocalNetworkHost(hostname);
}

export function modeOf(request: NextRequest): Mode {
  const host = request.headers.get("host") || request.nextUrl.host;
  const hostname = new URL(`http://${host}`).hostname;
  if (!isAllowedRequestHost(hostname))
    throw new AppError(
      "Este aplicativo aceita apenas acesso na rede local.",
      403,
    );
  const mode = request.nextUrl.searchParams.get("mode") || "personal";
  if (mode !== "personal" && mode !== "demo")
    throw new AppError("Modo inválido.");
  return mode;
}
export function guardWrite(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && new URL(origin).host !== host)
  )
    throw new AppError("Origem não permitida.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("Envie dados no formato JSON.", 415);
}
export function apiError(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: "Confira os campos informados.",
        fields: error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  if (error instanceof AppError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  console.error(
    "Falha interna na operação financeira",
    error instanceof Error ? error.name : "Unknown",
  );
  return NextResponse.json(
    { error: "Não foi possível concluir. Tente novamente." },
    { status: 500 },
  );
}
