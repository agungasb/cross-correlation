import { create } from "zustand";
import {
  AccountStatusPayload,
  BridgeHealthPayload,
  DispatchedSignalRecord,
  ExecutionMode,
  OrderResultPayload,
  PositionPayload,
  QuotePayload,
  TradeIntentPayload,
} from "@/types/trade";
import { StrategySignalEvent } from "@/lib/quant/strategy";

export interface TradeState {
  executionMode: ExecutionMode;
  lotSize: number;
  minConfidence: number;
  slippagePoints: number;
  slTpMode: "RELATIVE_POINTS" | "ABSOLUTE_PRICE";
  maxBasisPoints: number;
  bridgeUrl: string;
  authToken: string;
  useDirectBridge: boolean;

  bridgeHealth: BridgeHealthPayload | null;
  account: AccountStatusPayload | null;
  positions: PositionPayload[];
  brokerQuote: QuotePayload | null;
  dispatchedSignals: Record<string, DispatchedSignalRecord>;
  pendingSignalAlert: StrategySignalEvent | null;

  isPolling: boolean;
  isDispatching: boolean;
  error: string | null;
  lastUpdatedMs: number;
  modalOpen: boolean;

  // Actions
  setExecutionMode: (mode: ExecutionMode) => void;
  setLotSize: (size: number) => void;
  setMinConfidence: (conf: number) => void;
  setSlippagePoints: (pts: number) => void;
  setSlTpMode: (mode: "RELATIVE_POINTS" | "ABSOLUTE_PRICE") => void;
  setMaxBasisPoints: (pts: number) => void;
  setBridgeUrl: (url: string) => void;
  setAuthToken: (token: string) => void;
  setModalOpen: (open: boolean) => void;
  setPendingSignalAlert: (sig: StrategySignalEvent | null) => void;
  dismissPendingAlert: () => void;

  pollBridgeStatus: () => Promise<void>;
  sendHeartbeat: () => Promise<void>;
  dispatchIntent: (intent: TradeIntentPayload) => Promise<OrderResultPayload>;
  dispatchFromSignal: (
    signal: StrategySignalEvent,
    customVolume?: number
  ) => Promise<OrderResultPayload>;
  closePosition: (ticket: number) => Promise<boolean>;
  triggerKillSwitch: () => Promise<boolean>;
}

export const useTradeStore = create<TradeState>((set, get) => ({
  executionMode: "OFF",
  lotSize: 0.02,
  minConfidence: 60,
  slippagePoints: 30,
  slTpMode: "RELATIVE_POINTS",
  maxBasisPoints: 1500,
  bridgeUrl:
    typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? "http://localhost:8000"
      : "http://127.0.0.1:8000",
  authToken: "dev_secret_token",
  useDirectBridge: true,

  bridgeHealth: null,
  account: null,
  positions: [],
  brokerQuote: null,
  dispatchedSignals: {},
  pendingSignalAlert: null,

  isPolling: false,
  isDispatching: false,
  error: null,
  lastUpdatedMs: 0,
  modalOpen: false,

  setExecutionMode: (mode) => set({ executionMode: mode }),
  setLotSize: (size) => set({ lotSize: Math.max(0.01, Math.min(10, size)) }),
  setMinConfidence: (conf) => set({ minConfidence: Math.max(1, Math.min(99, conf)) }),
  setSlippagePoints: (pts) => set({ slippagePoints: Math.max(1, pts) }),
  setSlTpMode: (mode) => set({ slTpMode: mode }),
  setMaxBasisPoints: (pts) => set({ maxBasisPoints: Math.max(100, pts) }),
  setBridgeUrl: (url) => set({ bridgeUrl: url.trim().replace(/\/$/, "") }),
  setAuthToken: (token) => set({ authToken: token.trim() }),
  setModalOpen: (open) => set({ modalOpen: open }),
  setPendingSignalAlert: (sig) => set({ pendingSignalAlert: sig }),
  dismissPendingAlert: () => set({ pendingSignalAlert: null }),

  pollBridgeStatus: async () => {
    const { bridgeUrl, authToken, useDirectBridge } = get();
    set({ isPolling: true });

    try {
      if (useDirectBridge) {
        // Direct call to local/remote Python bridge
        const headers = { Authorization: `Bearer ${authToken}` };
        const [hRes, aRes, pRes, qRes] = await Promise.all([
          fetch(`${bridgeUrl}/health`, { headers }).then((r) => r.json()).catch(() => null),
          fetch(`${bridgeUrl}/account`, { headers }).then((r) => r.json()).catch(() => null),
          fetch(`${bridgeUrl}/positions`, { headers }).then((r) => r.json()).catch(() => []),
          fetch(`${bridgeUrl}/quote/XAUUSD`, { headers }).then((r) => r.json()).catch(() => null),
        ]);

        if (hRes) {
          set({
            bridgeHealth: hRes,
            account: aRes && !aRes.error ? aRes : null,
            positions: Array.isArray(pRes) ? pRes : [],
            brokerQuote: qRes && !qRes.error ? qRes : null,
            lastUpdatedMs: Date.now(),
            error: null,
          });
        } else {
          set({
            bridgeHealth: { status: "offline", error: "Connection refused" },
            account: null,
            positions: [],
            brokerQuote: null,
            lastUpdatedMs: Date.now(),
          });
        }
      } else {
        // Through Next.js server proxy API
        const res = await fetch("/api/trade/status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          set({
            bridgeHealth: data.health ?? { status: "offline" },
            account: data.account ?? null,
            positions: Array.isArray(data.positions) ? data.positions : [],
            brokerQuote: data.quote ?? null,
            lastUpdatedMs: Date.now(),
            error: data.error ?? null,
          });
        } else {
          // If server API route is not available (e.g. static export mode), fallback to direct bridge
          set({ useDirectBridge: true });
        }
      }
    } catch (err: any) {
      set({
        bridgeHealth: { status: "offline", error: err?.message || String(err) },
        lastUpdatedMs: Date.now(),
      });
    } finally {
      set({ isPolling: false });
    }
  },

  sendHeartbeat: async () => {
    const { bridgeUrl, authToken, useDirectBridge, executionMode } = get();
    const payload = {
      client_id: "analyzer_webapp_v2",
      active_mode: executionMode,
      timestamp_ms: Date.now(),
    };

    try {
      if (useDirectBridge) {
        await fetch(`${bridgeUrl}/heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/trade/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
    } catch {
      // transient heartbeat failure, will retry next tick
    }
  },

  dispatchIntent: async (intent: TradeIntentPayload) => {
    const { bridgeUrl, authToken, useDirectBridge, dispatchedSignals } = get();
    set({ isDispatching: true, error: null });

    // Mark as PENDING in local audit log
    const key = intent.idempotency_key;
    const now = Date.now();
    const newRecord: DispatchedSignalRecord = {
      key,
      timestamp: now,
      datetime: new Date(now).toISOString().replace("T", " ").slice(0, 19),
      action: intent.action,
      setupId: intent.setup_id || 0,
      setupName: `Setup ${intent.setup_id || "Manual"}`,
      confidence: 100,
      price: 0,
      status: "PENDING",
      dispatchedAt: now,
    };
    set({ dispatchedSignals: { ...dispatchedSignals, [key]: newRecord } });

    try {
      let result: OrderResultPayload;

      if (useDirectBridge) {
        const res = await fetch(`${bridgeUrl}/trade`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(intent),
        });
        result = await res.json();
      } else {
        const res = await fetch("/api/trade/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(intent),
        });
        result = await res.json();
      }

      // Update audit record
      const updatedRecord: DispatchedSignalRecord = {
        ...newRecord,
        status: result.success ? "FILLED" : "REJECTED",
        ticket: result.ticket,
        price: result.price,
        retcode: result.retcode,
        retcodeDesc: result.retcode_description,
      };

      set((s) => ({
        dispatchedSignals: { ...s.dispatchedSignals, [key]: updatedRecord },
      }));

      // Refresh positions and balance immediately
      get().pollBridgeStatus();

      return result;
    } catch (err: any) {
      const errDesc = err?.message || String(err);
      set((s) => ({
        error: errDesc,
        dispatchedSignals: {
          ...s.dispatchedSignals,
          [key]: { ...newRecord, status: "REJECTED", retcodeDesc: errDesc },
        },
      }));

      return {
        success: false,
        symbol: intent.symbol,
        volume: intent.volume,
        price: 0,
        retcode: 99997,
        retcode_description: errDesc,
        comment: "DISPATCH_FAIL",
        timestamp_ms: Date.now(),
      };
    } finally {
      set({ isDispatching: false });
    }
  },

  dispatchFromSignal: async (signal: StrategySignalEvent, customVolume?: number) => {
    const { lotSize, slippagePoints, dispatchedSignals, slTpMode, maxBasisPoints } = get();

    if (signal.action !== "BUY" && signal.action !== "SELL") {
      throw new Error(`Cannot execute non-directional signal: ${signal.action}`);
    }

    const volume = customVolume ?? lotSize;
    const idempotencyKey = `mt5_${signal.setupId}_${signal.timestamp}_${signal.action.toLowerCase()}`;

    // Prevent re-dispatching already processed signals
    if (dispatchedSignals[idempotencyKey]?.status === "FILLED") {
      return {
        success: true,
        ticket: dispatchedSignals[idempotencyKey].ticket,
        symbol: "XAUUSD",
        volume,
        price: dispatchedSignals[idempotencyKey].price,
        retcode: 10009,
        retcode_description: "ALREADY_DISPATCHED",
        comment: "REPLAY_BLOCKED",
        timestamp_ms: Date.now(),
      };
    }

    const price = signal.priceXauusd;
    let stopLossPoints: number | undefined;
    let takeProfitPoints: number | undefined;

    // Standardize delta into points ($1.00 = 100 points on standard 2-digit gold)
    if (!Number.isNaN(signal.stopLossXauusd) && signal.stopLossXauusd > 0) {
      const slDelta = Math.abs(price - signal.stopLossXauusd);
      stopLossPoints = Math.round(slDelta * 100);
    }

    if (!Number.isNaN(signal.takeProfitXauusd) && signal.takeProfitXauusd > 0) {
      const tpDelta = Math.abs(signal.takeProfitXauusd - price);
      takeProfitPoints = Math.round(tpDelta * 100);
    }

    const intent: TradeIntentPayload = {
      idempotency_key: idempotencyKey,
      symbol: "XAUUSD",
      action: signal.action,
      volume,
      setup_id: signal.setupId,
      signal_price: price,
      max_basis_points: maxBasisPoints,
      sl_tp_mode: slTpMode,
      stop_loss_points: stopLossPoints,
      take_profit_points: takeProfitPoints,
      stop_loss_price:
        slTpMode === "ABSOLUTE_PRICE" && !Number.isNaN(signal.stopLossXauusd)
          ? signal.stopLossXauusd
          : undefined,
      take_profit_price:
        slTpMode === "ABSOLUTE_PRICE" && !Number.isNaN(signal.takeProfitXauusd)
          ? signal.takeProfitXauusd
          : undefined,
      slippage_points: slippagePoints,
      comment: `S${signal.setupId}:${signal.shortLabel.slice(0, 10)}`,
    };

    return get().dispatchIntent(intent);
  },

  closePosition: async (ticket: number) => {
    const { bridgeUrl, authToken, useDirectBridge } = get();
    try {
      if (useDirectBridge) {
        await fetch(`${bridgeUrl}/close`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ ticket }),
        });
      } else {
        await fetch("/api/trade/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket }),
        });
      }
      await get().pollBridgeStatus();
      return true;
    } catch {
      return false;
    }
  },

  triggerKillSwitch: async () => {
    const { bridgeUrl, authToken, useDirectBridge } = get();
    try {
      if (useDirectBridge) {
        await fetch(`${bridgeUrl}/close`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ close_all: true }),
        });
      } else {
        await fetch("/api/trade/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ close_all: true }),
        });
      }
      await get().pollBridgeStatus();
      return true;
    } catch {
      return false;
    }
  },
}));
