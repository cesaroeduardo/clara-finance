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
export function modeOf(request: NextRequest): Mode {
  const host = request.headers.get("host") || request.nextUrl.host;
  const hostname = new URL(`http://${host}`).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname))
    throw new AppError("Este aplicativo aceita apenas acesso local.", 403);
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
