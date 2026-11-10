import { NextRequest, NextResponse } from "next/server";
import { apiError, AppError, guardWrite, modeOf } from "@/lib/http";
import { syncAll } from "@/lib/pluggy";
export async function POST(request: NextRequest) {
  try {
    guardWrite(request);
    if (modeOf(request) !== "personal")
      throw new AppError("A sincronização está disponível no modo pessoal.");
    const results = await syncAll();
    return NextResponse.json(
      { results },
      { status: results.every((row) => !row.ok) ? 502 : 200 },
    );
  } catch (error) {
    return apiError(error);
  }
}
