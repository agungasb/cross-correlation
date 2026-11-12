"use client";

import React, { useMemo } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import {
  buildSummaryFromSlice,
  computeVectorMA,
  computeWhitepaperStrategy,
  STRATEGY_SETUP_META,
  StrategySetupId,
  synthesizeCompanionProxySeries,
} from "@/lib/quant/math";
import { TimeframeId, TRIAD_CONFIGS, TriadPairId } from "@/types/market";
import {
  BookOpen,
  ChevronRight,
  Cloud,
  Pause,
  Play,
  SlidersHorizontal,
  Radio,
  Cpu,
  ArrowLeftRight,
  Flame,
  Target,
  RotateCw,
  Zap,
} from "lucide-react";
import { useTradeStore } from "@/store/useTradeStore";

interface TopCommandBarProps {
  onOpenWorkspaceModal: () => void;
  cloudUserEmail?: string | null;
  isFirebaseConfigured: boolean;
}

const TIMEFRAMES: { id: TimeframeId; label: string }[] = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1h" },
  { id: "1d", label: "1D" },
];

const TRIAD_LIST: TriadPairId[] = ["EUR", "JPY", "GBP", "CHF", "AUD", "CAD"];

export default function TopCommandBar({
  onOpenWorkspaceModal,
  cloudUserEmail,
  isFirebaseConfigured,
}: TopCommandBarProps) {
  const triadPair = useAnalyzerStore((s) => s.triadPair);
  const setTriadPair = useAnalyzerStore((s) => s.setTriadPair);
  const timeframe = useAnalyzerStore((s) => s.timeframe);
  const setTimeframe = useAnalyzerStore((s) => s.setTimeframe);
  const dataSeries = useAnalyzerStore((s) => s.dataSeries);
  const replayIndex = useAnalyzerStore((s) => s.replayIndex);
  const isReplaying = useAnalyzerStore((s) => s.isReplaying);
  const mode = useAnalyzerStore((s) => s.mode);
  const setMode = useAnalyzerStore((s) => s.setMode);
  const isLivePlaying = useAnalyzerStore((s) => s.isLivePlaying);
  const toggleLivePlaying = useAnalyzerStore((s) => s.toggleLivePlaying);
  const indicators = useAnalyzerStore((s) => s.indicators);
  const toggleIndicator = useAnalyzerStore((s) => s.toggleIndicator);
  const sidebarOpen = useAnalyzerStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAnalyzerStore((s) => s.setSidebarOpen);
  const setActiveSidebarTab = useAnalyzerStore((s) => s.setActiveSidebarTab);
  const subPaneMode = useAnalyzerStore((s) => s.subPaneMode);
  const setSubPaneMode = useAnalyzerStore((s) => s.setSubPaneMode);
  const setGuideModalOpen = useAnalyzerStore((s) => s.setGuideModalOpen);
  const trailLength = useAnalyzerStore((s) => s.trailLength);
  const setTrailLength = useAnalyzerStore((s) => s.setTrailLength);

  const executionMode = useTradeStore((s) => s.executionMode);
  const bridgeHealth = useTradeStore((s) => s.bridgeHealth);
  const positions = useTradeStore((s) => s.positions);
  const setMT5ModalOpen = useTradeStore((s) => s.setModalOpen);

  const maxTrailBars = timeframe === "1d" ? 250 : 500;

  const triad = TRIAD_CONFIGS[triadPair] ?? TRIAD_CONFIGS.EUR;

  const effectiveEnd = Math.max(
    1,
    Math.min(dataSeries.length, replayIndex || dataSeries.length)
  );
  const effectiveIdx = Math.max(0, effectiveEnd - 1);
  const currentBar = dataSeries[effectiveIdx];

  const maCfg = indicators["vector-ma"];
  const showMA = maCfg?.enabled ?? true;
  const maPeriod = Number(maCfg?.params?.period ?? 20);
  const maType = (
    maCfg?.params?.maType === "EMA" ? "EMA" : "SMA"
  ) as "SMA" | "EMA";
  const stratCfg = indicators["strategy-signals-3d"]?.params;
  const stratPeriod = Number(stratCfg?.period ?? 20);
  const coilThreshold = Number(stratCfg?.coilThreshold ?? 42);
  const curvatureHookThreshold = Number(
    stratCfg?.curvatureHookThreshold ?? 0.34
  );
  const minConfidence = Number(stratCfg?.minConfidence ?? 52);
  const enableSetup1 =
    stratCfg?.enableSetup1 !== undefined ? Boolean(stratCfg.enableSetup1) : true;
  const enableSetup2 =
    stratCfg?.enableSetup2 !== undefined ? Boolean(stratCfg.enableSetup2) : true;
  const enableSetup3 =
    stratCfg?.enableSetup3 !== undefined ? Boolean(stratCfg.enableSetup3) : true;
  const enableSetup4 =
    stratCfg?.enableSetup4 !== undefined ? Boolean(stratCfg.enableSetup4) : true;
  const enableSetup5 =
    stratCfg?.enableSetup5 !== undefined ? Boolean(stratCfg.enableSetup5) : true;

  const stratMemo = useMemo(() => {
    if (dataSeries.length === 0) return null;
    const ma = computeVectorMA(dataSeries, maPeriod, maType);
    const crossProxySeries = synthesizeCompanionProxySeries(
      dataSeries,
      triadPair
    );
    const strat = computeWhitepaperStrategy(dataSeries, {
      pair: triadPair,
      period: stratPeriod,
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
    return { ma, strat };
  }, [
    dataSeries,
    maPeriod,
    maType,
    triadPair,
    stratPeriod,
    coilThreshold,
    curvatureHookThreshold,
    minConfidence,
    enableSetup1,
    enableSetup2,
    enableSetup3,
    enableSetup4,
    enableSetup5,
  ]);

  let phaseDeviation = "OFF";
  if (showMA && stratMemo) {
    const val = stratMemo.ma.displacementPct[effectiveIdx] ?? 0;
    phaseDeviation = `${val.toFixed(2)}%`;
  }

  const stratData = stratMemo?.strat ?? null;
  const stratSummary = stratData
    ? buildSummaryFromSlice(
        stratData.events,
        stratData.trades,
        stratData.equityCurvePct,
        stratData.drawdownPct,
        effectiveEnd
      )
    : null;

  const activePos = stratData?.position[effectiveIdx] ?? 0;
  const activeSetupId = ((stratData?.activeSetupId[effectiveIdx] ||
    1) as StrategySetupId);
  const activeSetupMeta = STRATEGY_SETUP_META[activeSetupId];
  const activeSetupShort = activeSetupMeta?.shortName ?? "S1";
  const activeSetupTitle = activeSetupShort.replace(/^S\d:\s*/, "");
  const activeConfidence = stratData?.confidence[effectiveIdx] ?? 0;
  const activeStop = stratData?.stopLossSeries[effectiveIdx] ?? Number.NaN;
  const activeTp = stratData?.takeProfitSeries[effectiveIdx] ?? Number.NaN;

  const breadthVal = stratData?.crossProxy.bullionBreadth[effectiveIdx] ?? 0;
  const nearestSup =
    stratData?.crossProxy.nearestSupportXauusd[effectiveIdx] ?? 0;
  const nearestRes =
    stratData?.crossProxy.nearestResistanceXauusd[effectiveIdx] ?? 0;

  const latestSignalEvt = stratData
    ? stratData.events.findLast(
        (e) =>
          e.barIndex < effectiveEnd &&
          (e.action === "BUY" || e.action === "SELL")
      ) ?? null
    : null;

  // Realized trade matching the last completed position up to effectiveEnd
  const lastCompletedTrade = stratData
    ? stratData.trades.findLast((t) => t.exitIndex < effectiveEnd) ?? null
    : null;

  // Open position unrealized PnL ($/oz) derived from causal entryPriceSeries
  const entryPriceNow =
    stratData?.entryPriceSeries[effectiveIdx] ??
    (latestSignalEvt?.priceXauusd ?? Number.NaN);
  const openPnlUsd =
    activePos !== 0 && currentBar && Number.isFinite(entryPriceNow)
      ? (currentBar.xauusd - entryPriceNow) * activePos
      : 0;

  const buyCount = stratSummary?.buyCount ?? 0;
  const sellCount = stratSummary?.sellCount ?? 0;
  const winRatePct = stratSummary?.winRatePct ?? 0;
  const profitFactor = stratSummary?.profitFactor ?? 0;

  const signalText =
    activePos === 1
      ? `▲ LONG (${activeSetupShort.slice(0, 2)}) · ${activeConfidence.toFixed(0)}%`
      : activePos === -1
      ? `▼ SHORT (${activeSetupShort.slice(0, 2)}) · ${activeConfidence.toFixed(0)}%`
      : stratSummary
      ? `${buyCount}B / ${sellCount}S · WR ${winRatePct.toFixed(0)}%`
      : "SCANNING";

  return (
    <header className="bg-[#111827] border-b border-[#1f293d] px-2.5 py-1.5 flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between select-none shrink-0">
      {/* Row 1 (Mobile) / Left Group (Desktop): Brand, Proxy Selector & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/icon-192.png"
            alt="3D Triad"
            className="w-5 h-5 rounded-md border border-cyan-500/30 shrink-0"
          />
          <span className="text-xs sm:text-sm font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
            3D TRIAD
          </span>

          {isReplaying ? (
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/40 animate-pulse whitespace-nowrap">
              REPLAY
            </span>
          ) : mode === "sim" ? (
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 animate-pulse whitespace-nowrap">
              SIM 2HZ
            </span>
          ) : currentBar?.source === "simulated" ? (
            <span
              className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap"
              title="Live data feed unreachable; displaying synthetic fallback series"
            >
              SIM FALLBACK
            </span>
          ) : currentBar?.source === "binance" ? (
            <span
              className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse whitespace-nowrap"
              title="Binance Vision Public Market Data CDN (Zero-Key PAXGUSDT + FX)"
            >
              BINANCE LIVE
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse whitespace-nowrap">
              YAHOO LIVE
            </span>
          )}

          {/* Cross-Correlation Proxy Selector (Tablet & Desktop >= md) */}
          <div className="hidden md:flex items-center gap-1 bg-[#0b101b] px-2 py-0.5 rounded border border-amber-500/35 shrink-0">
            <ArrowLeftRight className="w-3 h-3 text-amber-400 shrink-0" />
            <select
              value={triadPair}
              onChange={(e) => setTriadPair(e.target.value as TriadPairId)}
              className="bg-transparent text-[11px] sm:text-xs font-bold text-amber-300 focus:outline-none cursor-pointer"
              title="Select Cross-Correlation Currency Proxy for XAUUSD"
            >
              {TRIAD_LIST.map((id) => {
                const cfg = TRIAD_CONFIGS[id];
                return (
                  <option
                    key={id}
                    value={id}
                    className="bg-[#111827] text-slate-100"
                  >
                    {cfg.label} ({cfg.currencySymbol})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Mobile Quick Action Buttons (Guide Popup, Workspaces & Inspector Drawer) */}
        <div className="flex lg:hidden items-center gap-1 shrink-0">
          <button
            onClick={() => setMT5ModalOpen(true)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition cursor-pointer ${
              executionMode === "AUTONOMOUS"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : executionMode === "MANUAL"
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                : "bg-slate-900 text-slate-300 border-slate-700"
            }`}
            title="MT5 Execution Gateway"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                bridgeHealth?.status === "ok" || bridgeHealth?.connected
                  ? bridgeHealth?.mode === "mock"
                    ? "bg-amber-400"
                    : "bg-emerald-400"
                  : "bg-rose-400"
              }`}
            />
            <Zap className="w-3 h-3 text-amber-400" />
            <span>MT5</span>
          </button>

          <button
            onClick={() => setGuideModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 transition cursor-pointer"
            title="Open Technical Whitepaper & Playbook Popup"
          >
            <BookOpen className="w-3 h-3 text-emerald-400" />
            <span>Guide</span>
          </button>

          <button
            onClick={onOpenWorkspaceModal}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-pointer"
          >
            <Cloud className="w-3 h-3 text-amber-400" />
            <span>{cloudUserEmail ? cloudUserEmail.split("@")[0] : "Cloud"}</span>
          </button>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition cursor-pointer ${
              sidebarOpen
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-[#0b101b] text-slate-300 border-[#1f293d]"
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Tools</span>
          </button>
        </div>
      </div>

      {/* Mobile-Only Dedicated Proxy Triad Selector Bar (< md) so Row 1 never overlaps */}
      <div className="flex md:hidden items-center justify-between bg-[#0b101b] px-2.5 py-1 rounded border border-amber-500/30">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
          <ArrowLeftRight className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Triad Pair:</span>
        </div>
        <select
          value={triadPair}
          onChange={(e) => setTriadPair(e.target.value as TriadPairId)}
          className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer text-right"
          title="Select Cross-Correlation Currency Proxy for XAUUSD"
        >
          {TRIAD_LIST.map((id) => {
            const cfg = TRIAD_CONFIGS[id];
            return (
              <option
                key={id}
                value={id}
                className="bg-[#111827] text-slate-100"
              >
                {cfg.label} ({cfg.currencySymbol})
              </option>
            );
          })}
        </select>
      </div>

      {/* Row 2 (Mobile 4-Col Strip) / Center Group (Desktop): Live Triad Tickers */}
      <div className="grid grid-cols-4 gap-1.5 lg:flex lg:items-center lg:gap-1.5">
        <div className="bg-white/[0.03] border border-[#1f293d] rounded px-2 py-1 lg:px-2.5 lg:py-1 lg:min-w-[92px] flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase text-amber-400/90 truncate">
            X: {triad.xTicker}
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-white truncate">
            {currentBar
              ? `${triad.currencySymbol}${currentBar.xaueur.toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: triad.xDecimals,
                    maximumFractionDigits: triad.xDecimals,
                  }
                )}`
              : "----"}
          </span>
        </div>

        <div className="bg-white/[0.03] border border-[#1f293d] rounded px-2 py-1 lg:px-2.5 lg:py-1 lg:min-w-[92px] flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase text-sky-400/90 truncate">
            Y: {triad.yTicker}
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-white truncate">
            {currentBar ? currentBar.eurusd.toFixed(triad.yDecimals) : "-.----"}
          </span>
        </div>

        <div className="bg-white/[0.03] border border-[#1f293d] rounded px-2 py-1 lg:px-2.5 lg:py-1 lg:min-w-[92px] flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase text-slate-400 truncate">
            XAUUSD ($)
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-white truncate">
            {currentBar ? currentBar.xauusd.toFixed(2) : "----.--"}
          </span>
        </div>

        <button
          onClick={() => toggleIndicator("vector-ma")}
          className={`text-left rounded px-2 py-1 lg:px-2.5 lg:py-1 lg:min-w-[92px] flex flex-col border transition cursor-pointer ${
            showMA
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-white/[0.02] border-[#1f293d] opacity-60"
          }`}
          title="Tap to toggle 3D Moving Average"
        >
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase text-emerald-300/80 truncate">
            MA({maPeriod}) Dev
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 truncate">
            {phaseDeviation}
          </span>
        </button>

        {/* Desktop-Only 5-Setup Signal Card (lg+) */}
        <button
          onClick={() => {
            setSubPaneMode("signals");
            setSidebarOpen(true);
            setActiveSidebarTab("playbook");
          }}
          className={`hidden lg:flex text-left rounded px-2.5 py-1 min-w-[148px] flex-col items-start justify-between border transition cursor-pointer ${
            activePos === 1
              ? "bg-emerald-500/15 border-emerald-500/45"
              : activePos === -1
              ? "bg-rose-500/15 border-rose-500/45"
              : "bg-cyan-500/10 border-cyan-500/30"
          }`}
          title="Open Whitepaper Strategy BUY/SELL Signals & Backtest Panel"
        >
          <span className="text-[10px] font-semibold uppercase text-cyan-300/90 whitespace-nowrap">
            5-Setup Signal · PF {profitFactor.toFixed(2)}
          </span>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`text-xs font-bold font-mono ${
                activePos === 1
                  ? "text-emerald-400"
                  : activePos === -1
                  ? "text-rose-400"
                  : "text-cyan-300"
              }`}
            >
              {signalText}
            </span>
            {activePos !== 0 ? (
              <span
                className={`px-1 py-0.2 rounded text-[9px] font-extrabold border ${
                  openPnlUsd >= 0
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                }`}
                title={`Active Trade Unrealized PnL: ${
                  openPnlUsd >= 0 ? "+" : ""
                }$${openPnlUsd.toFixed(2)}/oz`}
              >
                OPEN {openPnlUsd >= 0 ? "+" : ""}${openPnlUsd.toFixed(1)}
              </span>
            ) : lastCompletedTrade ? (
              <span
                className={`px-1 py-0.2 rounded text-[9px] font-extrabold border ${
                  lastCompletedTrade.pnlUsd >= 0
                    ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/45"
                    : "bg-rose-500/25 text-rose-300 border-rose-500/45"
                }`}
                title={`Last Trade: ${lastCompletedTrade.exitReason} (${
                  lastCompletedTrade.barsHeld
                }b) · PnL: ${
                  lastCompletedTrade.pnlUsd >= 0 ? "+" : ""
                }$${lastCompletedTrade.pnlUsd.toFixed(2)}/oz`}
              >
                {lastCompletedTrade.pnlUsd >= 0 ? "WIN" : "LOSS"}{" "}
                {lastCompletedTrade.pnlUsd >= 0 ? "+" : ""}$
                {lastCompletedTrade.pnlUsd.toFixed(1)}
              </span>
            ) : null}
          </div>
        </button>
      </div>

      {/* Row 2B (Mobile & Tablet < lg): Dedicated Institutional 5-Setup Signal & 6G10 Confluence HUD */}
      <div
        className={`lg:hidden rounded-lg border px-2.5 py-1.5 space-y-1.5 shadow-md transition ${
          activePos === 1
            ? "bg-gradient-to-r from-emerald-950/60 via-[#0c1824] to-[#0b101b] border-emerald-500/45"
            : activePos === -1
            ? "bg-gradient-to-r from-rose-950/60 via-[#1a101d] to-[#0b101b] border-rose-500/45"
            : "bg-gradient-to-r from-[#0c1926] via-[#0d1522] to-[#0b101b] border-cyan-500/35"
        }`}
      >
        {/* Top Header of Mobile Signal Card: Live Signal Badge + Action Pills */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider shrink-0 border ${
                activePos === 1
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : activePos === -1
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : "bg-cyan-500/15 text-cyan-300 border-cyan-500/35"
              }`}
            >
              <Target className="w-3 h-3 shrink-0" />
              {activePos === 1
                ? `▲ LONG · S${activeSetupId}`
                : activePos === -1
                ? `▼ SHORT · S${activeSetupId}`
                : "5-SETUP SIGNAL"}
            </span>

            <span className="text-[11px] font-semibold text-slate-200 truncate flex items-center gap-1">
              {activePos !== 0 ? (
                <>
                  <span className="truncate">{activeSetupTitle}</span>{" "}
                  <span className="font-mono text-cyan-300 shrink-0">
                    ({activeConfidence.toFixed(0)}%)
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border shrink-0 ${
                      openPnlUsd >= 0
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                    title={`Active Open Position · Unrealized PnL: ${
                      openPnlUsd >= 0 ? "+" : ""
                    }$${openPnlUsd.toFixed(2)}/oz`}
                  >
                    OPEN {openPnlUsd >= 0 ? "+" : ""}${openPnlUsd.toFixed(1)}
                  </span>
                </>
              ) : latestSignalEvt ? (
                <>
                  <span className="shrink-0 text-slate-400">Last:</span>{" "}
                  <span
                    className={`shrink-0 font-bold ${
                      latestSignalEvt.action === "BUY"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {latestSignalEvt.action === "BUY" ? "▲ BUY" : "▼ SELL"} S
                    {latestSignalEvt.setupId}
                  </span>{" "}
                  <span className="font-mono text-slate-300 shrink-0">
                    @${latestSignalEvt.priceXauusd.toFixed(0)}
                  </span>
                  {lastCompletedTrade && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border shrink-0 ${
                        lastCompletedTrade.pnlUsd >= 0
                          ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/45"
                          : "bg-rose-500/25 text-rose-300 border-rose-500/45"
                      }`}
                      title={`Last Trade: ${lastCompletedTrade.exitReason} (${
                        lastCompletedTrade.barsHeld
                      }b held) · PnL: ${
                        lastCompletedTrade.pnlUsd >= 0 ? "+" : ""
                      }$${lastCompletedTrade.pnlUsd.toFixed(2)}/oz (${
                        lastCompletedTrade.returnPct >= 0 ? "+" : ""
                      }${lastCompletedTrade.returnPct.toFixed(2)}%)`}
                    >
                      {lastCompletedTrade.pnlUsd >= 0 ? "WIN" : "LOSS"}{" "}
                      {lastCompletedTrade.pnlUsd >= 0 ? "+" : ""}$
                      {lastCompletedTrade.pnlUsd.toFixed(1)}
                    </span>
                  )}
                </>
              ) : (
                "Scanning 6G10 Triads"
              )}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                setSubPaneMode(
                  subPaneMode === "signals" ? "displacement" : "signals"
                )
              }
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                subPaneMode === "signals"
                  ? "bg-emerald-500/25 text-emerald-200 border-emerald-500/45"
                  : "bg-[#111827] text-slate-300 border-white/10 hover:text-white"
              }`}
              title="Toggle 2D Signals & Equity Curve Sub-Pane"
            >
              2D Equity
            </button>

            <button
              onClick={() => {
                setActiveSidebarTab("stats");
                setSidebarOpen(true);
              }}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/30 transition cursor-pointer"
              title="Open Full 5-Setup Signal Playbook & 6-Triad Bounce Matrix"
            >
              <span>Matrix</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Bottom 4-Cell Institutional Telemetry Strip (Never Truncates) */}
        <div className="grid grid-cols-4 gap-1 pt-1 border-t border-white/[0.07] text-[10px] font-mono">
          <div className="bg-[#090d16]/85 px-1.5 py-0.5 rounded border border-white/[0.04] flex items-center justify-between">
            <span className="text-[9px] font-sans font-semibold text-slate-400">
              B/S
            </span>
            <span className="font-bold whitespace-nowrap">
              <span className="text-emerald-400">{buyCount}B</span>
              <span className="text-slate-500 mx-0.5">/</span>
              <span className="text-rose-400">{sellCount}S</span>
            </span>
          </div>

          <div className="bg-[#090d16]/85 px-1.5 py-0.5 rounded border border-white/[0.04] flex items-center justify-between">
            <span className="text-[9px] font-sans font-semibold text-slate-400">
              WR
            </span>
            <span className="font-bold text-emerald-300 whitespace-nowrap">
              {winRatePct.toFixed(0)}%{" "}
              <span className="text-amber-300/90 text-[9px]">
                ({profitFactor.toFixed(1)}x)
              </span>
            </span>
          </div>

          <div className="bg-[#090d16]/85 px-1.5 py-0.5 rounded border border-white/[0.04] flex items-center justify-between">
            <span className="text-[9px] font-sans font-semibold text-slate-400">
              6G10
            </span>
            <span
              className={`font-bold whitespace-nowrap ${
                breadthVal > 0.15
                  ? "text-emerald-400"
                  : breadthVal < -0.15
                  ? "text-rose-400"
                  : "text-teal-300"
              }`}
            >
              {breadthVal >= 0 ? "+" : ""}
              {(breadthVal * 100).toFixed(0)}%{" "}
              <span className="text-[8px]">
                {breadthVal > 0.15
                  ? "BULL"
                  : breadthVal < -0.15
                  ? "BEAR"
                  : "NEUT"}
              </span>
            </span>
          </div>

          <div className="bg-[#090d16]/85 px-1.5 py-0.5 rounded border border-white/[0.04] flex items-center justify-between">
            {activePos !== 0 &&
            Number.isFinite(activeStop) &&
            Number.isFinite(activeTp) ? (
              <>
                <span className="text-[9px] font-sans font-semibold text-slate-400">
                  SL/TP
                </span>
                <span className="font-bold whitespace-nowrap">
                  <span className="text-rose-400">
                    {activeStop.toFixed(0)}
                  </span>
                  <span className="text-slate-500">/</span>
                  <span className="text-emerald-400">
                    {activeTp.toFixed(0)}
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="text-[9px] font-sans font-semibold text-slate-400">
                  S/R
                </span>
                <span
                  className="font-bold whitespace-nowrap"
                  title="Nearest Cross-Proxy Implied XAUUSD Support & Resistance Bounce Zones"
                >
                  <span className="text-emerald-400">
                    {nearestSup > 0 ? nearestSup.toFixed(0) : "--"}
                  </span>
                  <span className="text-slate-500">/</span>
                  <span className="text-rose-400">
                    {nearestRes > 0 ? nearestRes.toFixed(0) : "--"}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 (Mobile Scroll Strip) / Right Group (Desktop): Timeframe & Feed Controls */}
      <div className="flex items-center justify-between lg:justify-end gap-1.5 overflow-x-auto no-scrollbar">
        {/* Timeframe Selector */}
        <div className="flex items-center bg-[#0b101b] p-0.5 rounded border border-[#1f293d] shrink-0">
          {TIMEFRAMES.map((tf) => {
            const active = timeframe === tf.id;
            return (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={`px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-semibold transition cursor-pointer ${
                  active
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>

        {/* Feed Mode */}
        <div className="flex items-center bg-[#0b101b] p-0.5 rounded border border-[#1f293d] shrink-0">
          <button
            onClick={() => setMode("binance")}
            className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-medium transition cursor-pointer ${
              mode === "binance"
                ? "bg-amber-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
            title="Binance Vision Public CDN (Zero-Key 24/7 PAXGUSDT Spot Gold + FX)"
          >
            <Flame className="w-3 h-3" />
            <span>Binance</span>
          </button>
          <button
            onClick={() => setMode("yahoo")}
            className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-medium transition cursor-pointer ${
              mode === "yahoo"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
            title="Yahoo Finance Feed (GC=F + FX)"
          >
            <Radio className="w-3 h-3" />
            <span>Yahoo</span>
          </button>
          <button
            onClick={() => setMode("sim")}
            className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-medium transition cursor-pointer ${
              mode === "sim"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
            title="Synthetic 2Hz Geometric Brownian Motion Simulator"
          >
            <Cpu className="w-3 h-3" />
            <span>Sim 2Hz</span>
          </button>
          <button
            onClick={toggleLivePlaying}
            className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
            title={isLivePlaying ? "Pause Live Stream" : "Resume Live Stream"}
          >
            {isLivePlaying ? (
              <Pause className="w-3 h-3 text-amber-400" />
            ) : (
              <Play className="w-3 h-3 text-emerald-400" />
            )}
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href =
                  window.location.origin +
                  window.location.pathname +
                  "?v=" +
                  Date.now();
              }
            }}
            className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-medium text-slate-300 hover:text-cyan-300 hover:bg-white/5 cursor-pointer"
            title="Force Reload & Sync Latest App Version"
          >
            <RotateCw className="w-3 h-3 text-cyan-400" />
          </button>
        </div>

        {/* MT5 Gateway Execution & Risk Button */}
        <button
          onClick={() => setMT5ModalOpen(true)}
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition cursor-pointer shrink-0 ${
            executionMode === "AUTONOMOUS"
              ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-950/40"
              : executionMode === "MANUAL"
              ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-950/40"
              : "bg-slate-900/80 text-slate-300 border-slate-700/60 hover:border-slate-500"
          }`}
          title="MT5 Broker Execution & Risk Gateway"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              bridgeHealth?.status === "ok" || bridgeHealth?.connected
                ? bridgeHealth?.mode === "mock"
                  ? "bg-amber-400"
                  : "bg-emerald-400"
                : "bg-rose-400"
            }`}
          />
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>
            MT5: {executionMode}
            {positions.length > 0 ? ` (${positions.length})` : ""}
          </span>
        </button>

        {/* Desktop-only Guide Popup, Firebase & Inspector Buttons */}
        <button
          onClick={() => setGuideModalOpen(true)}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 transition cursor-pointer shrink-0"
          title="Open Technical Whitepaper & 5-Setup Playbook Popup"
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span>Guide</span>
        </button>

        <button
          onClick={onOpenWorkspaceModal}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition cursor-pointer shrink-0"
          title="Firebase Cloud Workspaces & Auth"
        >
          <Cloud className="w-3.5 h-3.5 text-amber-400" />
          <span>
            {cloudUserEmail
              ? cloudUserEmail.split("@")[0]
              : isFirebaseConfigured
              ? "Cloud Sync"
              : "Workspaces"}
          </span>
        </button>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`hidden lg:flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition cursor-pointer shrink-0 ${
            sidebarOpen
              ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
              : "bg-[#0b101b] text-slate-400 border-[#1f293d] hover:text-white"
          }`}
          title="Toggle Quant Inspector Sidebar"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </button>
      </div>

      {/* Row 4 (Main Page Always-Visible Bar): Sliding Window Trail Bars */}
      <div className="flex items-center gap-2 bg-[#0b101b] border border-[#1f293d] rounded px-2.5 py-1">
        <span className="text-[10px] sm:text-xs font-semibold text-slate-300 whitespace-nowrap">
          Sliding Trail:
        </span>
        <span className="text-[11px] sm:text-xs font-mono font-bold text-cyan-400 min-w-[54px]">
          {trailLength}b
        </span>
        <input
          type="range"
          min={10}
          max={maxTrailBars}
          step={10}
          value={Math.min(trailLength, maxTrailBars)}
          onChange={(e) => setTrailLength(parseInt(e.target.value, 10))}
          className="flex-1 h-1.5 accent-cyan-400 cursor-pointer"
          title="Sliding Window Trail Bars"
        />
        <div className="flex items-center gap-1 shrink-0">
          {(timeframe === "1d" ? [60, 120, 250] : [60, 120, 250, 500]).map(
            (preset) => (
              <button
                key={preset}
                onClick={() => setTrailLength(preset)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition cursor-pointer ${
                  trailLength === preset
                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40"
                    : "bg-white/[0.03] text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                {preset}
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
