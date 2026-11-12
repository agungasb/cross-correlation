import { describe, it, expect, beforeEach } from "vitest";
import { useTradeStore } from "../useTradeStore";
import { StrategySignalEvent } from "@/lib/quant/strategy";

describe("useTradeStore - State & Execution Controls", () => {
  beforeEach(() => {
    useTradeStore.setState({
      executionMode: "OFF",
      lotSize: 0.02,
      minConfidence: 60,
      slippagePoints: 30,
      positions: [],
      dispatchedSignals: {},
      pendingSignalAlert: null,
      error: null,
    });
  });

  it("updates execution modes correctly", () => {
    const { setExecutionMode } = useTradeStore.getState();
    expect(useTradeStore.getState().executionMode).toBe("OFF");

    setExecutionMode("MANUAL");
    expect(useTradeStore.getState().executionMode).toBe("MANUAL");

    setExecutionMode("AUTONOMOUS");
    expect(useTradeStore.getState().executionMode).toBe("AUTONOMOUS");
  });

  it("clamps lot size to valid trading bounds (0.01 to 10.0)", () => {
    const { setLotSize } = useTradeStore.getState();

    setLotSize(0.05);
    expect(useTradeStore.getState().lotSize).toBe(0.05);

    setLotSize(0.001);
    expect(useTradeStore.getState().lotSize).toBe(0.01);

    setLotSize(-5);
    expect(useTradeStore.getState().lotSize).toBe(0.01);

    setLotSize(100);
    expect(useTradeStore.getState().lotSize).toBe(10);
  });

  it("clamps minimum confidence threshold between 1% and 99%", () => {
    const { setMinConfidence } = useTradeStore.getState();

    setMinConfidence(75);
    expect(useTradeStore.getState().minConfidence).toBe(75);

    setMinConfidence(0);
    expect(useTradeStore.getState().minConfidence).toBe(1);

    setMinConfidence(120);
    expect(useTradeStore.getState().minConfidence).toBe(99);
  });

  it("manages pending signal alert state for manual execution", () => {
    const { setPendingSignalAlert, dismissPendingAlert } = useTradeStore.getState();

    const mockSignal: StrategySignalEvent = {
      barIndex: 100,
      timestamp: 1731412800,
      datetime: "2026-11-12 12:00",
      action: "BUY",
      direction: 1,
      setupId: 1,
      setupName: "Coiled Bullion Breakout",
      shortLabel: "S1: Coil Breakout",
      confidence: 84.5,
      priceXauusd: 2650.5,
      priceCross: 2364.2,
      priceFx: 1.085,
      stopLossXauusd: 2640.0,
      takeProfitXauusd: 2670.0,
      spineXauusd: 2648.0,
      isoCutEfficiency: 0.92,
      levyArea: 0.75,
      curvature: 0.12,
      velocity: 1.45,
      basinDist: 0.8,
      regimeId: 2,
      rationale: "Bullion breakout cutting orthogonally across Iso-Contours",
    };

    setPendingSignalAlert(mockSignal);
    expect(useTradeStore.getState().pendingSignalAlert).toEqual(mockSignal);

    dismissPendingAlert();
    expect(useTradeStore.getState().pendingSignalAlert).toBeNull();
  });

  it("blocks duplicate executions if signal is already marked as FILLED", async () => {
    const { dispatchFromSignal } = useTradeStore.getState();

    const mockSignal: StrategySignalEvent = {
      barIndex: 100,
      timestamp: 1731412800,
      datetime: "2026-11-12 12:00",
      action: "BUY",
      direction: 1,
      setupId: 1,
      setupName: "Coiled Bullion Breakout",
      shortLabel: "S1: Coil",
      confidence: 88,
      priceXauusd: 2650.5,
      priceCross: 2364.2,
      priceFx: 1.085,
      stopLossXauusd: 2640.0,
      takeProfitXauusd: 2670.0,
      spineXauusd: 2648.0,
      isoCutEfficiency: 0.92,
      levyArea: 0.75,
      curvature: 0.12,
      velocity: 1.45,
      basinDist: 0.8,
      regimeId: 2,
      rationale: "Bullion breakout",
    };

    const idempotencyKey = `mt5_${mockSignal.setupId}_${mockSignal.timestamp}_${mockSignal.action.toLowerCase()}`;

    // Mark as previously filled
    useTradeStore.setState({
      dispatchedSignals: {
        [idempotencyKey]: {
          key: idempotencyKey,
          timestamp: Date.now(),
          datetime: "2026-11-12 12:00:00",
          action: "BUY",
          setupId: 1,
          setupName: "S1",
          confidence: 88,
          price: 2650.5,
          status: "FILLED",
          ticket: 778899,
          dispatchedAt: Date.now(),
        },
      },
    });

    const res = await dispatchFromSignal(mockSignal);
    expect(res.success).toBe(true);
    expect(res.ticket).toBe(778899);
    expect(res.comment).toBe("REPLAY_BLOCKED");
    expect(res.retcode_description).toBe("ALREADY_DISPATCHED");
  });

  it("calculates relative point distance correctly in RELATIVE_POINTS mode", async () => {
    let capturedIntent: any = null;
    useTradeStore.setState({
      dispatchIntent: async (intent) => {
        capturedIntent = intent;
        return {
          success: true,
          ticket: 12345,
          symbol: intent.symbol,
          volume: intent.volume,
          price: 2650.5,
          retcode: 10009,
          retcode_description: "DONE",
          comment: "TEST",
          timestamp_ms: Date.now(),
        };
      },
      slTpMode: "RELATIVE_POINTS",
      maxBasisPoints: 1200,
    });

    const mockSignal: StrategySignalEvent = {
      barIndex: 101,
      timestamp: 1731412900,
      datetime: "2026-11-12 12:05",
      action: "BUY",
      direction: 1,
      setupId: 1,
      setupName: "Coiled Bullion Breakout",
      shortLabel: "S1: Coil",
      confidence: 90,
      priceXauusd: 2650.5,
      priceCross: 2364.2,
      priceFx: 1.085,
      stopLossXauusd: 2642.0, // Delta = 8.5 USD = 850 points
      takeProfitXauusd: 2668.0, // Delta = 17.5 USD = 1750 points
      spineXauusd: 2648.0,
      isoCutEfficiency: 0.92,
      levyArea: 0.75,
      curvature: 0.12,
      velocity: 1.45,
      basinDist: 0.8,
      regimeId: 2,
      rationale: "Bullion breakout",
    };

    const { dispatchFromSignal } = useTradeStore.getState();
    await dispatchFromSignal(mockSignal);

    expect(capturedIntent).not.toBeNull();
    expect(capturedIntent.sl_tp_mode).toBe("RELATIVE_POINTS");
    expect(capturedIntent.stop_loss_points).toBe(850);
    expect(capturedIntent.take_profit_points).toBe(1750);
    expect(capturedIntent.stop_loss_price).toBeUndefined();
    expect(capturedIntent.signal_price).toBe(2650.5);
    expect(capturedIntent.max_basis_points).toBe(1200);
  });

  it("supports ABSOLUTE_PRICE mode and max basis limit adjustments", () => {
    const { setSlTpMode, setMaxBasisPoints } = useTradeStore.getState();

    setSlTpMode("ABSOLUTE_PRICE");
    expect(useTradeStore.getState().slTpMode).toBe("ABSOLUTE_PRICE");

    setMaxBasisPoints(2500);
    expect(useTradeStore.getState().maxBasisPoints).toBe(2500);

    // Minimum clamp check
    setMaxBasisPoints(50);
    expect(useTradeStore.getState().maxBasisPoints).toBe(100);
  });
});
