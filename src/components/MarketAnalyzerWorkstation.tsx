"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import TopCommandBar from "./TopCommandBar";
import PhaseSpace3DCanvas from "./PhaseSpace3DCanvas";
import SynchronizedSubPane2D from "./SynchronizedSubPane2D";
import InspectorSidebar from "./InspectorSidebar";
import ReplayTransportBar from "./ReplayTransportBar";
import FirebaseWorkspaceModal from "./FirebaseWorkspaceModal";
import TechnicalGuideModal from "./TechnicalGuideModal";
import MT5ExecutionModal from "./MT5ExecutionModal";
import MT5TradeSignalNotification from "./MT5TradeSignalNotification";
import { useTradeStore } from "@/store/useTradeStore";
import {
  computeWhitepaperStrategy,
  synthesizeCompanionProxySeries,
} from "@/lib/quant/math";
import { subscribeAuthState } from "@/lib/firebase/client";
import { getMarketBarsClient } from "@/lib/client/yahooBrowser";
import {
  getMarketBarsBinanceClient,
  subscribeBinanceLiveStream,
} from "@/lib/client/binanceBrowser";
import { MarketBar, TRIAD_CONFIGS, TriadPairId } from "@/types/market";

const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "1d": 86400,
};

function formatUtcBarTime(unixSec: number, isDaily: boolean): string {
  const d = new Date(unixSec * 1000);
  if (isDaily) {
    return d.toISOString().slice(0, 10);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function MarketAnalyzerWorkstation() {
  const triadPair = useAnalyzerStore((s) => s.triadPair);
  const timeframe = useAnalyzerStore((s) => s.timeframe);
  const mode = useAnalyzerStore((s) => s.mode);
  const isLivePlaying = useAnalyzerStore((s) => s.isLivePlaying);
  const setDataSeries = useAnalyzerStore((s) => s.setDataSeries);
  const setIsLoading = useAnalyzerStore((s) => s.setIsLoading);
  const appendLiveBar = useAnalyzerStore((s) => s.appendLiveBar);
  const setSidebarOpen = useAnalyzerStore((s) => s.setSidebarOpen);

  // Auto-collapse Inspector drawer on mobile viewports on first mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(false);
  const [fbConfigTick, setFbConfigTick] = useState(0);

  const lastSimPriceRef = useRef({
    xauusd: 4010.0,
    eurusd: 1.1212,
    timestamp: Math.floor(Date.now() / 1000),
  });

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsub = subscribeAuthState((user, configured) => {
      setIsFirebaseConfigured(configured);
      setUserId(user?.uid ?? null);
      setUserEmail(user?.email ?? null);
    });
    return () => unsub();
  }, [fbConfigTick]);

  // MT5 Broker Store Hooks & Background Sync
  const pollBridgeStatus = useTradeStore((s) => s.pollBridgeStatus);
  const sendHeartbeat = useTradeStore((s) => s.sendHeartbeat);
  const executionMode = useTradeStore((s) => s.executionMode);
  const minConfidence = useTradeStore((s) => s.minConfidence);
  const dispatchFromSignal = useTradeStore((s) => s.dispatchFromSignal);
  const setPendingSignalAlert = useTradeStore((s) => s.setPendingSignalAlert);
  const dispatchedSignals = useTradeStore((s) => s.dispatchedSignals);

  const dataSeries = useAnalyzerStore((s) => s.dataSeries);
  const indicators = useAnalyzerStore((s) => s.indicators);
  const lastProcessedBarTimeRef = useRef<number>(0);

  // Background MT5 Bridge Status Poll (every 8s) & Dead-Man Heartbeat (every 10s)
  useEffect(() => {
    pollBridgeStatus();
    sendHeartbeat();
    const pollId = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        pollBridgeStatus();
      }
    }, 8000);

    const hbId = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        sendHeartbeat();
      }
    }, 10000);

    return () => {
      clearInterval(pollId);
      clearInterval(hbId);
    };
  }, [pollBridgeStatus, sendHeartbeat]);

  // Automated Signal Surveillance Loop (AUTONOMOUS / MANUAL Execution)
  useEffect(() => {
    if (executionMode === "OFF" || dataSeries.length === 0) return;

    const latestBar = dataSeries[dataSeries.length - 1];
    if (!latestBar || latestBar.timestamp === lastProcessedBarTimeRef.current) return;
    lastProcessedBarTimeRef.current = latestBar.timestamp;

    const maCfg = indicators["vector-ma"];
    const maPeriod = Number(maCfg?.params?.period ?? 20);
    const maType = (maCfg?.params?.maType === "EMA" ? "EMA" : "SMA") as
      | "SMA"
      | "EMA";
    const stratCfg = indicators["strategy-signals-3d"]?.params;
    const stratPeriod = Number(stratCfg?.period ?? 20);
    const coilThreshold = Number(stratCfg?.coilThreshold ?? 42);
    const curvatureHookThreshold = Number(
      stratCfg?.curvatureHookThreshold ?? 0.34
    );
    const enableSetup1 =
      stratCfg?.enableSetup1 !== undefined
        ? Boolean(stratCfg.enableSetup1)
        : true;
    const enableSetup2 =
      stratCfg?.enableSetup2 !== undefined
        ? Boolean(stratCfg.enableSetup2)
        : true;
    const enableSetup3 =
      stratCfg?.enableSetup3 !== undefined
        ? Boolean(stratCfg.enableSetup3)
        : true;
    const enableSetup4 =
      stratCfg?.enableSetup4 !== undefined
        ? Boolean(stratCfg.enableSetup4)
        : true;
    const enableSetup5 =
      stratCfg?.enableSetup5 !== undefined
        ? Boolean(stratCfg.enableSetup5)
        : true;

    const crossProxySeries = synthesizeCompanionProxySeries(
      dataSeries,
      triadPair
    );
    const stratResult = computeWhitepaperStrategy(dataSeries, {
      pair: triadPair,
      period: stratPeriod,
      maType,
      coilThreshold,
      curvatureHookThreshold,
      minConfidence,
      enableSetup1,
      enableSetup2,
      enableSetup3,
      enableSetup4,
      enableSetup5,
      crossProxySeries,
    });

    const events = stratResult.events;
    if (events.length === 0) return;
    const latestEvent = events[events.length - 1];

    if (latestEvent.barIndex < dataSeries.length - 2) return;
    if (latestEvent.action !== "BUY" && latestEvent.action !== "SELL") return;
    if (latestEvent.confidence < minConfidence) return;

    const eventKey = `mt5_${latestEvent.setupId}_${latestEvent.timestamp}_${latestEvent.action.toLowerCase()}`;
    if (dispatchedSignals[eventKey]) return;

    if (executionMode === "AUTONOMOUS") {
      dispatchFromSignal(latestEvent).catch(() => {});
    } else if (executionMode === "MANUAL") {
      setPendingSignalAlert(latestEvent);
    }
  }, [
    dataSeries,
    executionMode,
    triadPair,
    minConfidence,
    indicators,
    dispatchedSignals,
    dispatchFromSignal,
    setPendingSignalAlert,
  ]);

  // Client-side fallback generator if network fails completely
  const generateLocalFallback = useCallback(
    (tf: string, pair: TriadPairId): MarketBar[] => {
      const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
      const count = tf === "1d" ? 200 : 250;
      const intervalSec = INTERVAL_SECONDS[tf] ?? 60;
      const now = Math.floor(Date.now() / 1000);
      let xau = 4010.0;
      let fx = triad.defaultFxRate;
      const volScale = Math.sqrt(intervalSec / 60.0);
      const out: MarketBar[] = [];

      for (let i = count; i >= 0; i--) {
        const t = now - i * intervalSec;
        xau *= Math.exp((Math.random() - 0.495) * 0.0003 * volScale);
        fx *= Math.exp((Math.random() - 0.495) * 0.00018 * volScale);
        const cross =
          triad.quoteMode === "CCY_USD" ? xau / fx : xau * fx;
        out.push({
          timestamp: t,
          datetime: formatUtcBarTime(t, tf === "1d"),
          xauusd: Number(xau.toFixed(2)),
          eurusd: Number(fx.toFixed(triad.yDecimals + 1)),
          xaueur: Number(cross.toFixed(triad.xDecimals)),
          usdeur: Number((1 / fx).toFixed(6)),
          source: "simulated",
        });
      }
      lastSimPriceRef.current = { xauusd: xau, eurusd: fx, timestamp: now };
      return out;
    },
    []
  );

  // Fetch timeframe & triad pair history for the active provider ("binance" default or "yahoo")
  const activeFeedProvider = mode === "yahoo" ? "yahoo" : "binance";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const bars =
          activeFeedProvider === "binance"
            ? await getMarketBarsBinanceClient(timeframe, triadPair, false)
            : await getMarketBarsClient(timeframe, triadPair, false);

        if (!cancelled && bars.length > 0) {
          setDataSeries(bars);
          const latest = bars[bars.length - 1];
          lastSimPriceRef.current = {
            xauusd: latest.xauusd,
            eurusd: latest.eurusd,
            timestamp: latest.timestamp,
          };
        } else if (!cancelled) {
          setDataSeries(generateLocalFallback(timeframe, triadPair));
        }
      } catch {
        if (!cancelled) {
          setDataSeries(generateLocalFallback(timeframe, triadPair));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [
    timeframe,
    triadPair,
    activeFeedProvider,
    setDataSeries,
    setIsLoading,
    generateLocalFallback,
  ]);

  // Yahoo Live Feed Auto-Update Polling (10s + Instant Mobile Wakeup Refresh)
  useEffect(() => {
    if (!isLivePlaying || mode !== "yahoo") return;

    const refreshLiveYahoo = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const bars = await getMarketBarsClient(timeframe, triadPair, true);
        if (bars.length > 0 && bars[0].source === "yahoo") {
          const state = useAnalyzerStore.getState();
          if (state.isReplaying) {
            useAnalyzerStore.setState({ dataSeries: bars });
          } else {
            state.setDataSeries(bars);
          }
          const latest = bars[bars.length - 1];
          lastSimPriceRef.current = {
            xauusd: latest.xauusd,
            eurusd: latest.eurusd,
            timestamp: latest.timestamp,
          };
        }
      } catch {
        // ignore transient poll errors
      }
    };

    const id = setInterval(refreshLiveYahoo, 10000);
    const onVisibilityChange = () => {
      if (!document.hidden) {
        refreshLiveYahoo();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [timeframe, triadPair, isLivePlaying, mode]);

  // Binance Vision Public CDN Live Stream + Background Sync
  useEffect(() => {
    if (!isLivePlaying || mode !== "binance") return;

    const unsubStream = subscribeBinanceLiveStream(
      triadPair,
      timeframe,
      () => lastSimPriceRef.current.eurusd,
      (liveBar) => {
        lastSimPriceRef.current = {
          xauusd: liveBar.xauusd,
          eurusd: liveBar.eurusd,
          timestamp: liveBar.timestamp,
        };
        appendLiveBar(liveBar);
      }
    );

    const refreshBinanceHistory = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const bars = await getMarketBarsBinanceClient(
          timeframe,
          triadPair,
          true
        );
        if (bars.length > 0 && bars[0].source === "binance") {
          const state = useAnalyzerStore.getState();
          if (state.isReplaying) {
            useAnalyzerStore.setState({ dataSeries: bars });
          } else {
            state.setDataSeries(bars);
          }
          const latest = bars[bars.length - 1];
          lastSimPriceRef.current = {
            xauusd: latest.xauusd,
            eurusd: latest.eurusd,
            timestamp: latest.timestamp,
          };
        }
      } catch {
        // ignore transient poll errors
      }
    };

    const id = setInterval(refreshBinanceHistory, 20000);
    const onVisibilityChange = () => {
      if (!document.hidden) {
        refreshBinanceHistory();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unsubStream();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [timeframe, triadPair, isLivePlaying, mode, appendLiveBar]);

  // Timeframe-Aware & Triad-Pair-Aware Simulation Feed (650ms / ~2Hz)
  useEffect(() => {
    if (!isLivePlaying || mode !== "sim") return;
    const triad = TRIAD_CONFIGS[triadPair] ?? TRIAD_CONFIGS.EUR;
    const intervalSec = INTERVAL_SECONDS[timeframe] ?? 60;
    const volScale = Math.sqrt(intervalSec / 60.0);
    const rho = triad.quoteMode === "CCY_USD" ? 0.35 : -0.35;
    const rhoComp = Math.sqrt(1 - rho * rho);

    const id = setInterval(() => {
      const z1 = (Math.random() + Math.random() + Math.random() - 1.5) * 0.6;
      const zIndep =
        (Math.random() + Math.random() + Math.random() - 1.5) * 0.6;
      const z2 = rho * z1 + rhoComp * zIndep;

      lastSimPriceRef.current.xauusd *= Math.exp(0.00015 * volScale * z1);
      lastSimPriceRef.current.eurusd *= Math.exp(0.00008 * volScale * z2);
      lastSimPriceRef.current.timestamp += intervalSec;

      const xau = lastSimPriceRef.current.xauusd;
      const fx = lastSimPriceRef.current.eurusd;
      const cross =
        triad.quoteMode === "CCY_USD" ? xau / fx : xau * fx;
      const nextTs = lastSimPriceRef.current.timestamp;

      appendLiveBar({
        timestamp: nextTs,
        datetime: formatUtcBarTime(nextTs, timeframe === "1d"),
        xauusd: Number(xau.toFixed(2)),
        eurusd: Number(fx.toFixed(triad.yDecimals + 1)),
        xaueur: Number(cross.toFixed(triad.xDecimals)),
        usdeur: Number((1 / fx).toFixed(6)),
        source: "simulated",
      });
    }, 650);
    return () => clearInterval(id);
  }, [timeframe, triadPair, isLivePlaying, mode, appendLiveBar]);

  // Global Workstation Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const s = useAnalyzerStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        s.toggleReplay();
      } else if (e.key === "m" || e.key === "M") {
        s.toggleIndicator("vector-ma");
      } else if (e.key === "ArrowRight") {
        s.stepReplay(e.shiftKey ? 10 : 1);
      } else if (e.key === "ArrowLeft") {
        s.stepReplay(e.shiftKey ? -10 : -1);
      } else if (e.key === "l" || e.key === "L") {
        s.toggleReplayLoop();
      } else if (e.key === "]" || e.key === "}") {
        s.setStretch({ z: s.stretch.z + 0.2 });
      } else if (e.key === "[" || e.key === "{") {
        s.setStretch({ z: s.stretch.z - 0.2 });
      } else if (e.key === "+" || e.key === "=") {
        s.setStretch({ x: s.stretch.x + 0.2, y: s.stretch.y + 0.2 });
      } else if (e.key === "-" || e.key === "_") {
        s.setStretch({ x: s.stretch.x - 0.2, y: s.stretch.y - 0.2 });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-[#0a0e17] text-[#f3f4f6]">
      <TopCommandBar
        onOpenWorkspaceModal={() => setWorkspaceModalOpen(true)}
        cloudUserEmail={userEmail}
        isFirebaseConfigured={isFirebaseConfigured}
      />

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Center Multi-Panel Viewport (3D Phase Space + Synchronized 2D Sub-Pane) */}
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          <PhaseSpace3DCanvas />
          <SynchronizedSubPane2D />
        </div>

        {/* Right Docked Quant Inspector Sidebar (Bottom Drawer on Mobile) */}
        <InspectorSidebar />
      </div>

      <ReplayTransportBar />

      <FirebaseWorkspaceModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        userId={userId}
        userEmail={userEmail}
        isFirebaseConfigured={isFirebaseConfigured}
        onFirebaseConfigUpdated={() => setFbConfigTick((t) => t + 1)}
      />

      <TechnicalGuideModal />
      <MT5ExecutionModal />
      <MT5TradeSignalNotification />
    </div>
  );
}
