import { NextResponse } from "next/server";
import { getCacheSummary, TIMEFRAME_CONFIG } from "@/lib/server/yahoo";

export async function GET() {
  return NextResponse.json({
    status: "online",
    platform: "Next.js + Firebase Market Analyzer",
    timeframes: TIMEFRAME_CONFIG,
    cached: getCacheSummary(),
  });
}
