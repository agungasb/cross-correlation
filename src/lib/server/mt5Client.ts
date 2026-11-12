import {
  AccountStatusPayload,
  BridgeHealthPayload,
  OrderResultPayload,
  PositionPayload,
  QuotePayload,
  TradeIntentPayload,
} from "@/types/trade";

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8000";
const DEFAULT_AUTH_TOKEN = "dev_secret_token";

function getBridgeConfig() {
  const url = (process.env.MT5_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/$/, "");
  const token = process.env.MT5_BRIDGE_AUTH_TOKEN || DEFAULT_AUTH_TOKEN;
  return { url, token };
}

async function bridgeFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const { url, token } = getBridgeConfig();
  const targetUrl = `${url}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(targetUrl, {
      ...options,
      headers,
      cache: "no-store",
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: parsed?.error || parsed?.detail || `HTTP ${res.status}: ${text}`,
      };
    }

    return { ok: true, status: res.status, data: parsed as T };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: `Bridge connection failed (${targetUrl}): ${err?.message || String(err)}`,
    };
  }
}

export async function getBridgeHealth(): Promise<BridgeHealthPayload> {
  const res = await bridgeFetch<BridgeHealthPayload>("/health");
  if (!res.ok || !res.data) {
    return {
      status: "offline",
      error: res.error || "Cannot reach MT5 Bridge server",
    };
  }
  return res.data;
}

export async function getAccountStatus(): Promise<{
  account: AccountStatusPayload | null;
  error?: string;
}> {
  const res = await bridgeFetch<AccountStatusPayload>("/account");
  if (!res.ok || !res.data) {
    return { account: null, error: res.error };
  }
  return { account: res.data };
}

export async function getOpenPositions(symbol?: string): Promise<{
  positions: PositionPayload[];
  error?: string;
}> {
  const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
  const res = await bridgeFetch<PositionPayload[]>(`/positions${q}`);
  if (!res.ok || !res.data) {
    return { positions: [], error: res.error };
  }
  return { positions: res.data };
}

export async function getBrokerQuote(symbol: string): Promise<{
  quote: QuotePayload | null;
  error?: string;
}> {
  const res = await bridgeFetch<QuotePayload>(
    `/quote/${encodeURIComponent(symbol)}`
  );
  if (!res.ok || !res.data) {
    return { quote: null, error: res.error };
  }
  return { quote: res.data };
}

export async function sendTradeIntent(
  intent: TradeIntentPayload
): Promise<OrderResultPayload> {
  const res = await bridgeFetch<OrderResultPayload>("/trade", {
    method: "POST",
    body: JSON.stringify(intent),
  });

  if (!res.ok || !res.data) {
    return {
      success: false,
      symbol: intent.symbol,
      volume: intent.volume,
      price: 0,
      retcode: 99998,
      retcode_description: res.error || "Bridge request failed",
      comment: "NETWORK_ERROR",
      timestamp_ms: Date.now(),
    };
  }

  return res.data;
}

export async function closePositionsOnBridge(params: {
  ticket?: number;
  symbol?: string;
  closeAll?: boolean;
}): Promise<{ results: OrderResultPayload[]; error?: string }> {
  const res = await bridgeFetch<OrderResultPayload[]>("/close", {
    method: "POST",
    body: JSON.stringify({
      ticket: params.ticket,
      symbol: params.symbol,
      close_all: !!params.closeAll,
    }),
  });

  if (!res.ok || !res.data) {
    return { results: [], error: res.error };
  }

  return { results: res.data };
}
