"use client";

import React from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { computeVectorMA } from "@/lib/quant/math";
import { TimeframeId } from "@/types/market";
import {
  Cloud,
  Pause,
  Play,
  PanelRightClose,
  PanelRightOpen,
  Radio,
  Cpu,
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

export default function TopCommandBar({
  onOpenWorkspaceModal,
  cloudUserEmail,
  isFirebaseConfigured,
}: TopCommandBarProps) {
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
  const sidebarOpen = useAnalyzerStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAnalyzerStore((s) => s.setSidebarOpen);

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
    <header className="bg-[#111827] border-b border-[#1f293d] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 select-none shrink-0">
      {/* Brand & Status */}
      <div className="flex items-center gap-2.5">
        <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-400 bg-clip-text text-transparent">
          3D TRIAD MARKET ANALYZER
        </span>
        {isReplaying ? (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/40 animate-pulse">
            REPLAYING
          </span>
        ) : (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
            LIVE FEED
          </span>
        )}
      </div>

      {/* Live Triad Tickers */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="bg-white/[0.03] border border-[#1f293d] rounded px-2.5 py-1 min-w-[92px] flex flex-col">
          <span className="text-[10px] font-semibold uppercase text-amber-400/90">
            X: XAUEUR (€)
          </span>
          <span className="text-sm font-bold font-mono text-white">
            {currentBar ? currentBar.xaueur.toFixed(2) : "----.--"}
          </span>
        </div>

        <div className="bg-white/[0.03] border border-[#1f293d] rounded px-2.5 py-1 min-w-[92px] flex flex-col">
          <span className="text-[10px] font-semibold uppercase text-sky-400/90">
            Y: EURUSD ($)
          </span>
          <span className="text-sm font-bold font-mono text-white">
            {currentBar ? currentBar.eurusd.toFixed(4) : "-.----"}
          </span>
        </div>

        <div className="bg-white/[0.03] border border-[#1f293d] rounded px-2.5 py-1 min-w-[92px] flex flex-col">
          <span className="text-[10px] font-semibold uppercase text-slate-400">
            XAUUSD ($/oz)
          </span>
          <span className="text-sm font-bold font-mono text-white">
            {currentBar ? currentBar.xauusd.toFixed(2) : "----.--"}
          </span>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-1 min-w-[100px] flex flex-col">
          <span className="text-[10px] font-semibold uppercase text-emerald-300/80">
            MA({maPeriod}) Dev
          </span>
          <span className="text-sm font-bold font-mono text-emerald-400">
            {phaseDeviation}
          </span>
        </div>
      </div>

      {/* Timeframe & Feed Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Timeframe Selector */}
        <div className="flex items-center bg-[#0b101b] p-0.5 rounded border border-[#1f293d]">
          {TIMEFRAMES.map((tf) => {
            const active = timeframe === tf.id;
            return (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={`px-2 py-1 rounded text-xs font-semibold transition cursor-pointer ${
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
        <div className="flex items-center bg-[#0b101b] p-0.5 rounded border border-[#1f293d]">
          <button
            onClick={() => setMode("yahoo")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
              mode === "yahoo"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>Yahoo</span>
          </button>
          <button
            onClick={() => setMode("sim")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
              mode === "sim"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span>Sim 2Hz</span>
          </button>
          <button
            onClick={toggleLivePlaying}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
            title={isLivePlaying ? "Pause Live Stream" : "Resume Live Stream"}
          >
            {isLivePlaying ? (
              <Pause className="w-3 h-3 text-amber-400" />
            ) : (
              <Play className="w-3 h-3 text-emerald-400" />
            )}
          </button>
        </div>

        {/* Firebase Workspace & Auth Button */}
        <button
          onClick={onOpenWorkspaceModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition cursor-pointer"
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

        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition cursor-pointer ${
            sidebarOpen
              ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
              : "bg-[#0b101b] text-slate-400 border-[#1f293d] hover:text-white"
          }`}
          title="Toggle Quant Inspector Sidebar"
        >
          {sidebarOpen ? (
            <PanelRightClose className="w-3.5 h-3.5" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Inspector</span>
        </button>
      </div>
    </header>
  );
}
