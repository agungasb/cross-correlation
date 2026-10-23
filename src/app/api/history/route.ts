import { NextRequest, NextResponse } from "next/server";
import { getOrUpdateTimeframe, TIMEFRAME_CONFIG } from "@/lib/server/yahoo";
import { TimeframeId } from "@/types/market";

export async function GET(request: NextRequest) {
  const tfParam = request.nextUrl.searchParams.get("timeframe") ?? "1m";
  const forceParam = request.nextUrl.searchParams.get("force") === "1";
  const tf: TimeframeId =
    tfParam in TIMEFRAME_CONFIG ? (tfParam as TimeframeId) : "1m";

  const data = await getOrUpdateTimeframe(tf, forceParam);
  const cfg = TIMEFRAME_CONFIG[tf];

  return NextResponse.json(
    {
      timeframe: tf,
      label: cfg.label,
      count: data.length,
      data,
    },
    {
      headers: {
        "Cache-Control": `public, max-age=15, s-maxage=${cfg.ttl}, stale-while-revalidate=60`,
      },
    }
  );
}
