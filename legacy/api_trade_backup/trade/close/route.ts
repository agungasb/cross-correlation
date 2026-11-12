import { NextResponse } from "next/server";
import { closePositionsOnBridge } from "@/lib/server/mt5Client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const ticket = body.ticket ? Number(body.ticket) : undefined;
    const symbol = body.symbol ? String(body.symbol).trim().toUpperCase() : undefined;
    const closeAll = Boolean(body.close_all || body.closeAll);

    if (!ticket && !symbol && !closeAll) {
      return NextResponse.json(
        { error: "Must specify ticket, symbol, or close_all: true" },
        { status: 400 }
      );
    }

    const { results, error } = await closePositionsOnBridge({
      ticket,
      symbol,
      closeAll,
    });

    if (error && results.length === 0) {
      return NextResponse.json({ error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      closedCount: results.filter((r) => r.success).length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Close request failed: ${err?.message || String(err)}` },
      { status: 500 }
    );
  }
}
