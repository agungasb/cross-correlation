import { NextResponse } from "next/server";
import { sendTradeIntent } from "@/lib/server/mt5Client";
import { TradeIntentPayload } from "@/types/trade";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TradeIntentPayload;

    if (!body || !body.idempotency_key) {
      return NextResponse.json(
        { error: "Missing required parameter: idempotency_key" },
        { status: 400 }
      );
    }

    if (!body.symbol || !body.action) {
      return NextResponse.json(
        { error: "Missing required parameters: symbol, action" },
        { status: 400 }
      );
    }

    if (body.action !== "BUY" && body.action !== "SELL") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'BUY' or 'SELL'" },
        { status: 400 }
      );
    }

    // Fat-finger protection & sizing clamp
    const volume = Math.max(0.01, Math.min(10.0, Number(body.volume) || 0.01));

    const sanitizedIntent: TradeIntentPayload = {
      idempotency_key: String(body.idempotency_key).trim(),
      symbol: String(body.symbol).trim().toUpperCase(),
      action: body.action,
      volume: Number(volume.toFixed(2)),
      setup_id: body.setup_id ? Number(body.setup_id) : undefined,
      signal_price: body.signal_price ? Number(body.signal_price) : undefined,
      stop_loss_price: body.stop_loss_price ? Number(body.stop_loss_price) : undefined,
      take_profit_price: body.take_profit_price ? Number(body.take_profit_price) : undefined,
      stop_loss_points: body.stop_loss_points ? Number(body.stop_loss_points) : undefined,
      take_profit_points: body.take_profit_points ? Number(body.take_profit_points) : undefined,
      max_basis_points: body.max_basis_points ? Number(body.max_basis_points) : undefined,
      sl_tp_mode: body.sl_tp_mode === "ABSOLUTE_PRICE" ? "ABSOLUTE_PRICE" : "RELATIVE_POINTS",
      slippage_points: body.slippage_points ? Number(body.slippage_points) : 30,
      comment: body.comment ? String(body.comment).slice(0, 31) : undefined,
    };

    const result = await sendTradeIntent(sanitizedIntent);

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Dispatch server error: ${err?.message || String(err)}` },
      { status: 500 }
    );
  }
}
