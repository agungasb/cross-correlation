"use client";

import React from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { computeVectorMA } from "@/lib/quant/math";
import { TimeframeId, TRIAD_CONFIGS, TriadPairId } from "@/types/market";
import {
  BookOpen,
  Cloud,
  Pause,
  Play,
  SlidersHorizontal,
  Radio,
  Cpu,
  ArrowLeftRight,
  Zap,
  Flame,
} from "lucide-react";

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
  const setGuideModalOpen = useAnalyzerStore((s) => s.setGuideModalOpen);
  const trailLength = useAnalyzerStore((s) => s.trailLength);
  const setTrailLength = useAnalyzerStore((s) => s.setTrailLength);

  const maxTrailBars = timeframe === "1d" ? 250 : 500;

  const triad = TRIAD_CONFIGS[triadPair] ?? TRIAD_CONFIGS.EUR;

  const effectiveIdx = Math.max(
    0,
    Math.min(dataSeries.length - 1, (replayIndex || dataSeries.length) - 1)
  );
  const currentBar = dataSeries[effectiveIdx];

  const maCfg = indicators["vector-ma"];
  const showMA = maCfg?.enabled ?? true;
  const maPeriod = Number(maCfg?.params?.period ?? 20);
  const maType = (
    maCfg?.params?.maType === "EMA" ? "EMA" : "SMA"
  ) as "SMA" | "EMA";

  let phaseDeviation = "OFF";
  if (showMA && dataSeries.length > 0) {
    const { displacementPct } = computeVectorMA(dataSeries, maPeriod, maType);
    const val = displacementPct[effectiveIdx] ?? 0;
    phaseDeviation = `${val.toFixed(2)}%`;
  }

  return (
    <header className="bg-[#111827] border-b border-[#1f293d] px-2.5 py-1.5 flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between select-none shrink-0">
      {/* Row 1 (Mobile) / Left Group (Desktop): Brand, Proxy Selector & Action Buttons */}
      <div className="flex items-center justify-between gap-2">
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
          ) : currentBar?.source === "pyth" ? (
            <span
              className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse whitespace-nowrap"
              title="Pyth Network Institutional Spot Oracle (Hermes + Pyth Pro History)"
            >
              PYTH LIVE
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

          {/* Cross-Correlation Proxy Selector (Tablet & Desktop >= sm) */}
          <div className="hidden sm:flex items-center gap-1 bg-[#0b101b] px-2 py-0.5 rounded border border-amber-500/35 shrink-0">
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

      {/* Mobile-Only Dedicated Proxy Triad Selector Bar (< sm) so Row 1 never overlaps */}
      <div className="flex sm:hidden items-center justify-between bg-[#0b101b] px-2.5 py-1 rounded border border-amber-500/30">
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
      <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center sm:gap-1.5">
        <div className="bg-white/[0.03] border border-[#1f293d] rounded px-2 py-0.5 sm:px-2.5 sm:py-1 sm:min-w-[92px] flex flex-col">
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

        <div className="bg-white/[0.03] border border-[#1f293d] rounded px-2 py-0.5 sm:px-2.5 sm:py-1 sm:min-w-[92px] flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase text-sky-400/90 truncate">
            Y: {triad.yTicker}
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-white truncate">
            {currentBar ? currentBar.eurusd.toFixed(triad.yDecimals) : "-.----"}
          </span>
        </div>

        <div className="bg-white/[0.03] border border-[#1f293d] rounded px-2 py-0.5 sm:px-2.5 sm:py-1 sm:min-w-[92px] flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase text-slate-400 truncate">
            XAUUSD ($)
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-white truncate">
            {currentBar ? currentBar.xauusd.toFixed(2) : "----.--"}
          </span>
        </div>

        <button
          onClick={() => toggleIndicator("vector-ma")}
          className={`text-left rounded px-2 py-0.5 sm:px-2.5 sm:py-1 sm:min-w-[92px] flex flex-col border transition cursor-pointer ${
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
            onClick={() => setMode("pyth")}
            className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-medium transition cursor-pointer ${
              mode === "pyth"
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
            title="Pyth Network Real-Time Spot Oracle (Spot XAU/USD + FX)"
          >
            <Zap className="w-3 h-3" />
            <span>Pyth</span>
          </button>
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
        </div>

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
          min={30}
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
