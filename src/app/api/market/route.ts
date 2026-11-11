import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { getMarketQuotes } from "@/lib/market";

export async function GET(request: NextRequest) {
  try {
    const tickers =
      request.nextUrl.searchParams.get("tickers")?.split(",").filter(Boolean) ||
      [];
    const quotes = await getMarketQuotes({ tickers });
    return NextResponse.json(
      { quotes, updatedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
