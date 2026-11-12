import { NextResponse } from "next/server";

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8000";
const DEFAULT_AUTH_TOKEN = "dev_secret_token";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const bridgeUrl = (process.env.MT5_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/$/, "");
    const token = process.env.MT5_BRIDGE_AUTH_TOKEN || DEFAULT_AUTH_TOKEN;

    const res = await fetch(`${bridgeUrl}/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        client_id: body.client_id || "webapp_nextjs",
        active_mode: body.active_mode || "OFF",
        timestamp_ms: Date.now(),
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Bridge returned status ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Heartbeat failed: ${err?.message || String(err)}` },
      { status: 500 }
    );
  }
}
