import { NextResponse } from "next/server";
import {
  getAccountStatus,
  getBridgeHealth,
  getBrokerQuote,
  getOpenPositions,
} from "@/lib/server/mt5Client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "XAUUSD";

  const [health, accResult, posResult, quoteResult] = await Promise.all([
    getBridgeHealth(),
    getAccountStatus(),
    getOpenPositions(symbol),
    getBrokerQuote(symbol),
  ]);

  return NextResponse.json({
    health,
    account: accResult.account,
    positions: posResult.positions,
    quote: quoteResult.quote,
    error: health.error || accResult.error || posResult.error,
  });
}
