import { NextRequest, NextResponse } from "next/server";
import { getOrUpdateTimeframe, TIMEFRAME_CONFIG } from "@/lib/server/yahoo";
import { TimeframeId } from "@/types/market";

export async function GET(request: NextRequest) {
  const tfParam = request.nextUrl.searchParams.get("timeframe") ?? "1m";
  const tf: TimeframeId =
    tfParam in TIMEFRAME_CONFIG ? (tfParam as TimeframeId) : "1m";

  const data = await getOrUpdateTimeframe(tf, false);
  const latest = data.length > 0 ? data[data.length - 1] : null;

  return NextResponse.json(
    {
      timeframe: tf,
      latest,
      server_time: Date.now() / 1000,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=10, s-maxage=15, stale-while-revalidate=30",
      },
    }
  );
}
