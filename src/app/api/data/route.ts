import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/db";
import { apiError, modeOf } from "@/lib/http";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  try {
    return NextResponse.json(getData(modeOf(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
