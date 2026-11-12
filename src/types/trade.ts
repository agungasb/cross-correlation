export type ExecutionMode = "OFF" | "MANUAL" | "AUTONOMOUS";

export interface TradeIntentPayload {
  idempotency_key: string;
  symbol: string;
  action: "BUY" | "SELL";
  volume: number;
  setup_id?: number;
  signal_price?: number;
  stop_loss_price?: number;
  take_profit_price?: number;
  stop_loss_points?: number;
  take_profit_points?: number;
  max_basis_points?: number;
  sl_tp_mode?: "RELATIVE_POINTS" | "ABSOLUTE_PRICE";
  slippage_points?: number;
  comment?: string;
}

export interface QuotePayload {
  symbol: string;
  bid: number;
  ask: number;
  spread_points: number;
  digits: number;
  point: number;
  timestamp_ms: number;
}

export interface OrderResultPayload {
  success: boolean;
  ticket?: number;
  deal_id?: number;
  order_id?: number;
  symbol: string;
  volume: number;
  price: number;
  retcode: number;
  retcode_description: string;
  comment: string;
  timestamp_ms: number;
}

export interface PositionPayload {
  ticket: number;
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  price_open: number;
  price_current: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  magic: number;
  comment: string;
  time_setup_ms: number;
}

export interface AccountStatusPayload {
  connected: boolean;
  login: number;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  margin_level: number;
  leverage: number;
}

export interface BridgeHealthPayload {
  status: "ok" | "degraded" | "offline";
  mode?: "live" | "mock" | string;
  connected?: boolean;
  account_login?: number;
  server?: string;
  error?: string;
}

export interface DispatchedSignalRecord {
  key: string;
  timestamp: number;
  datetime: string;
  action: "BUY" | "SELL";
  setupId: number;
  setupName: string;
  confidence: number;
  price: number;
  status: "PENDING" | "FILLED" | "REJECTED" | "DUPLICATE_BLOCKED";
  ticket?: number;
  retcode?: number;
  retcodeDesc?: string;
  dispatchedAt: number;
}
