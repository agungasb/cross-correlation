"use client";

import React from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { BUILTIN_INDICATOR_PLUGINS } from "@/lib/quant/plugins";
import {
  calculateCorrelation,
  calculateLogReturnCorrelation,
  computeVectorMA,
  getTimeUnitConfig,
} from "@/lib/quant/math";
import { CameraPreset } from "@/types/market";
import {
  Box,
  Compass,
  Layers,
  RotateCcw,
  Sliders,
  Sparkles,
} from "lucide-react";

const TF_LABELS: Record<string, string> = {
  "1m": "1m (1 Day)",
  "5m": "5m (5 Days)",
  "15m": "15m (1 Month)",
  "1h": "1h (3 Months)",
  "1d": "Daily (1 Year)",
};

export default function InspectorSidebar() {
  const sidebarOpen = useAnalyzerStore((s) => s.sidebarOpen);
  const activeTab = useAnalyzerStore((s) => s.activeSidebarTab);
  const setActiveTab = useAnalyzerStore((s) => s.setActiveSidebarTab);

  const timeframe = useAnalyzerStore((s) => s.timeframe);
  const dataSeries = useAnalyzerStore((s) => s.dataSeries);
  const trailLength = useAnalyzerStore((s) => s.trailLength);
  const setTrailLength = useAnalyzerStore((s) => s.setTrailLength);
  const stretch = useAnalyzerStore((s) => s.stretch);
  const setStretch = useAnalyzerStore((s) => s.setStretch);
  const applyStretchPreset = useAnalyzerStore((s) => s.applyStretchPreset);
  const cameraPreset = useAnalyzerStore((s) => s.cameraPreset);
  const setCameraPreset = useAnalyzerStore((s) => s.setCameraPreset);
  const autoRotate = useAnalyzerStore((s) => s.autoRotate);
  const toggleAutoRotate = useAnalyzerStore((s) => s.toggleAutoRotate);

  const indicators = useAnalyzerStore((s) => s.indicators);
  const toggleIndicator = useAnalyzerStore((s) => s.toggleIndicator);
  const setIndicatorParam = useAnalyzerStore((s) => s.setIndicatorParam);
  const resetIndicators = useAnalyzerStore((s) => s.resetIndicators);

  const replayIndex = useAnalyzerStore((s) => s.replayIndex);
  const replayTraceMode = useAnalyzerStore((s) => s.replayTraceMode);

  if (!sidebarOpen) return null;

  const effectiveEnd = Math.max(
    1,
    Math.min(dataSeries.length, replayIndex || dataSeries.length)
  );
  const startIdx =
    replayTraceMode === "accumulate"
      ? Math.max(0, effectiveEnd - 1000)
      : Math.max(0, effectiveEnd - trailLength);
  const activeSlice = dataSeries.slice(startIdx, effectiveEnd);
  const latest = activeSlice[activeSlice.length - 1];

  // Quantitative stats calculation
  const xVals = activeSlice.map((d) => d.xaueur);
  const yVals = activeSlice.map((d) => d.eurusd);
  const levelCorr = calculateCorrelation(xVals, yVals);
  const returnCorr = calculateLogReturnCorrelation(activeSlice);

  const refXaueur = latest ? latest.marketXaueur ?? latest.xaueur : 1;
  const impliedEUR = latest ? latest.xauusd / refXaueur : 0;
  const basisPips = latest ? (latest.eurusd - impliedEUR) * 10000 : 0;

  const spanSeconds =
    activeSlice.length > 1
      ? Math.max(1, latest.timestamp - activeSlice[0].timestamp)
      : 0;
  const timeCfg = getTimeUnitConfig(timeframe);

  const maCfg = indicators["vector-ma"];
  const maPeriod = Number(maCfg?.params?.period ?? 20);
  const maType = (
    maCfg?.params?.maType === "EMA" ? "EMA" : "SMA"
  ) as "SMA" | "EMA";
  const maData =
    dataSeries.length > 0
      ? computeVectorMA(dataSeries, maPeriod, maType)
      : null;
  const latestIdx = effectiveEnd - 1;
  const latestMA_X = maData?.xMA[latestIdx] ?? 0;
  const latestMA_Y = maData?.yMA[latestIdx] ?? 0;
  const latestDispPct = maData?.displacementPct[latestIdx] ?? 0;
  const latestDispZ = maData?.displacementZScore[latestIdx] ?? 0;

  return (
    <aside className="w-80 bg-[#0d131f] border-l border-[#1f293d] flex flex-col h-full select-none shrink-0 overflow-hidden">
      {/* Sidebar Navigation Tabs */}
      <div className="grid grid-cols-3 border-b border-[#1f293d] bg-[#090d16] p-1 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab("indicators")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
            activeTab === "indicators"
              ? "bg-[#1e293b] text-emerald-400 border border-emerald-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Indicators</span>
        </button>

        <button
          onClick={() => setActiveTab("scene")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
            activeTab === "scene"
              ? "bg-[#1e293b] text-sky-400 border border-sky-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D Scene</span>
        </button>

        <button
          onClick={() => setActiveTab("stats")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
            activeTab === "stats"
              ? "bg-[#1e293b] text-amber-400 border border-amber-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Metrics</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === "indicators" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Indicator Plugin Stack
              </span>
              <button
                onClick={resetIndicators}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5 cursor-pointer"
                title="Reset all indicators to default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Defaults</span>
              </button>
            </div>

            {BUILTIN_INDICATOR_PLUGINS.map((plugin) => {
              const inst = indicators[plugin.id];
              const enabled = inst?.enabled ?? plugin.defaultEnabled;
              const params = inst?.params ?? plugin.defaultParams;

              return (
                <div
                  key={plugin.id}
                  className={`rounded-lg border transition p-2.5 ${
                    enabled
                      ? "bg-[#111827] border-[#28354f]"
                      : "bg-[#0a0f1a]/60 border-[#182132] opacity-75"
                  }`}
                >
                  {/* Plugin Header & Toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: plugin.accentColor }}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-100">
                          {plugin.name}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                          {plugin.description}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleIndicator(plugin.id)}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 transition cursor-pointer ${
                        enabled
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {enabled ? "ON" : "OFF"}
                    </button>
                  </div>

                  {/* Dynamic Parameter Controls */}
                  {enabled && plugin.paramSchema.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] space-y-2">
                      {plugin.paramSchema.map((field) => {
                        const val = params[field.key];

                        if (field.type === "number") {
                          return (
                            <div key={field.key} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">
                                  {field.label}:
                                </span>
                                <input
                                  type="number"
                                  min={field.min}
                                  max={field.max}
                                  step={field.step ?? 1}
                                  value={Number(val)}
                                  onChange={(e) => {
                                    const num = parseFloat(e.target.value);
                                    if (!Number.isNaN(num)) {
                                      setIndicatorParam(
                                        plugin.id,
                                        field.key,
                                        Math.max(
                                          field.min ?? 1,
                                          Math.min(field.max ?? 500, num)
                                        )
                                      );
                                    }
                                  }}
                                  className="w-16 bg-[#090d16] border border-[#263248] rounded px-1.5 py-0.5 text-right font-mono text-xs text-white"
                                />
                              </div>

                              {field.presets && (
                                <div className="flex items-center gap-1 justify-end">
                                  {field.presets.map((p) => (
                                    <button
                                      key={p}
                                      onClick={() =>
                                        setIndicatorParam(
                                          plugin.id,
                                          field.key,
                                          p
                                        )
                                      }
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                                        Number(val) === p
                                          ? "bg-emerald-600 text-white font-bold"
                                          : "bg-[#1a2234] text-slate-400 hover:text-white"
                                      }`}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (field.type === "select" && field.options) {
                          return (
                            <div
                              key={field.key}
                              className="flex items-center justify-between text-[11px]"
                            >
                              <span className="text-slate-400">
                                {field.label}:
                              </span>
                              <div className="flex items-center gap-1 bg-[#090d16] p-0.5 rounded border border-[#263248]">
                                {field.options.map((opt) => (
                                  <button
                                    key={String(opt.value)}
                                    onClick={() =>
                                      setIndicatorParam(
                                        plugin.id,
                                        field.key,
                                        opt.value
                                      )
                                    }
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                                      val === opt.value
                                        ? "bg-emerald-600 text-white"
                                        : "text-slate-400 hover:text-white"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        if (field.type === "boolean") {
                          return (
                            <div
                              key={field.key}
                              className="flex items-center justify-between text-[11px]"
                            >
                              <span className="text-slate-400">
                                {field.label}:
                              </span>
                              <button
                                onClick={() =>
                                  setIndicatorParam(
                                    plugin.id,
                                    field.key,
                                    !Boolean(val)
                                  )
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                                  val
                                    ? "bg-sky-600/30 text-sky-300 border border-sky-500/40"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {val ? "Enabled" : "Hidden"}
                              </button>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {activeTab === "scene" && (
          <div className="space-y-4">
            {/* Axis Stretch Controls */}
            <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <Sliders className="w-3.5 h-3.5" />
                <span>3D Axis Stretch Ratios</span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                      STRETCH X (€ XAUEUR)
                    </span>
                    <span className="font-mono font-bold text-white text-xs">
                      {stretch.x.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="3.5"
                    step="0.1"
                    value={stretch.x}
                    onChange={(e) =>
                      setStretch({ x: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-bold">
                      STRETCH Y ($ EURUSD)
                    </span>
                    <span className="font-mono font-bold text-white text-xs">
                      {stretch.y.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="3.5"
                    step="0.1"
                    value={stretch.y}
                    onChange={(e) =>
                      setStretch({ y: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold">
                      STRETCH Z (TIME)
                    </span>
                    <span className="font-mono font-bold text-white text-xs">
                      {stretch.z.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="4.0"
                    step="0.1"
                    value={stretch.z}
                    onChange={(e) =>
                      setStretch({ z: parseFloat(e.target.value) })
                    }
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => applyStretchPreset("time_long")}
                  className="px-2 py-1.5 rounded bg-[#1a2234] hover:bg-[#253048] text-xs text-slate-200 font-medium cursor-pointer"
                >
                  Elongate Time ⏳
                </button>
                <button
                  onClick={() => applyStretchPreset("wide_phase")}
                  className="px-2 py-1.5 rounded bg-[#1a2234] hover:bg-[#253048] text-xs text-slate-200 font-medium cursor-pointer"
                >
                  Wide Phase ↔️
                </button>
                <button
                  onClick={() => applyStretchPreset("equal")}
                  className="px-2 py-1.5 rounded bg-[#1a2234] hover:bg-[#253048] text-xs text-slate-200 font-medium cursor-pointer"
                >
                  1:1:1 Cube ⚖️
                </button>
                <button
                  onClick={() => applyStretchPreset("reset")}
                  className="px-2 py-1.5 rounded bg-[#1a2234] hover:bg-[#253048] text-xs text-slate-200 font-medium cursor-pointer"
                >
                  Reset 🔄
                </button>
              </div>
            </div>

            {/* Camera Viewpoint Controls */}
            <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Compass className="w-3.5 h-3.5" />
                <span>Camera Projections</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "orbit", label: "3D Orbit" },
                    { id: "top", label: "Top (X-Y Floor)" },
                    { id: "side", label: "Side (EUR-Time)" },
                    { id: "front", label: "Front (XAU-Time)" },
                  ] as { id: CameraPreset; label: string }[]
                ).map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => setCameraPreset(cam.id)}
                    className={`px-2 py-1.5 rounded text-xs font-medium border transition cursor-pointer ${
                      cameraPreset === cam.id
                        ? "bg-sky-600 text-white border-sky-400"
                        : "bg-[#1a2234] text-slate-300 border-transparent hover:bg-[#253048]"
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              <button
                onClick={toggleAutoRotate}
                className={`w-full py-1.5 rounded text-xs font-semibold border transition cursor-pointer ${
                  autoRotate
                    ? "bg-pink-600 text-white border-pink-400"
                    : "bg-[#1a2234] text-slate-300 border-[#28354f] hover:text-white"
                }`}
              >
                {autoRotate ? "⟳ Auto-Orbit: ACTIVE" : "⟳ Toggle Auto-Orbit"}
              </button>
            </div>

            {/* Trail Window Control */}
            <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">
                  Sliding Window Trail Bars:
                </span>
                <span className="font-mono font-bold text-cyan-400">
                  {trailLength} bars
                </span>
              </div>
              <input
                type="range"
                min="30"
                max={timeframe === "1d" ? 250 : 800}
                step="10"
                value={trailLength}
                onChange={(e) => setTrailLength(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-3">
            <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="font-bold text-cyan-400">
                  Triad Phase Diagnostics
                </span>
                <span className="text-[10px] font-mono text-amber-400">
                  {timeframe.toUpperCase()}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Active Bar Time:</span>
                <span className="font-mono font-semibold text-pink-400">
                  {latest ? latest.datetime : "--"}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Timeframe Horizon:</span>
                <span className="font-mono font-semibold text-purple-400">
                  {TF_LABELS[timeframe] ?? timeframe}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Implied EURUSD:</span>
                <span className="font-mono font-semibold text-white">
                  {impliedEUR ? impliedEUR.toFixed(5) : "-.-----"}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Market EURUSD:</span>
                <span className="font-mono font-semibold text-white">
                  {latest ? latest.eurusd.toFixed(5) : "-.-----"}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Arbitrage Basis (Δ):</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {basisPips.toFixed(2)} pips
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400" title="Stationary correlation of first log differences">
                  Return Corr r(ΔlnX, ΔlnY):
                </span>
                <span
                  className={`font-mono font-semibold ${
                    returnCorr < 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {returnCorr.toFixed(3)}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400" title="Raw level correlation across visible slice">
                  Level Corr r(X, Y):
                </span>
                <span
                  className={`font-mono font-semibold ${
                    levelCorr < 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {levelCorr.toFixed(3)}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Trail Span:</span>
                <span className="font-mono font-semibold text-slate-200">
                  {timeCfg.fmtSpan(spanSeconds)}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">
                  {maType}({maPeriod}) Center:
                </span>
                <span className="font-mono font-semibold text-emerald-400">
                  {maCfg?.enabled
                    ? `€${latestMA_X.toFixed(1)} / $${latestMA_Y.toFixed(4)}`
                    : "OFF"}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Phase Z-Score:</span>
                <span className="font-mono font-semibold text-amber-300">
                  {maCfg?.enabled
                    ? `${latestDispPct.toFixed(2)}% (${
                        latestDispZ >= 0 ? "+" : ""
                      }${latestDispZ.toFixed(2)}σ)`
                    : "OFF"}
                </span>
              </div>
            </div>

            {/* Mathematical Cross-Rate Note */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-[11px] text-amber-200/90 space-y-1">
              <div className="font-bold text-amber-400">
                Triangular Cross-Rate Identities:
              </div>
              <div className="font-mono text-[10px]">
                • XAUUSD / XAUEUR = EURUSD
              </div>
              <div className="font-mono text-[10px]">
                • XAUEUR / XAUUSD = USDEUR (1 / EURUSD)
              </div>
            </div>

            {/* Keyboard Shortcuts Box */}
            <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-2.5 text-[11px] text-slate-300 space-y-1">
              <div className="font-bold text-slate-200 mb-1">
                Workstation Shortcuts:
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Play / Pause Replay:</span>
                <code className="text-amber-400 font-mono">Space</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Step 1 / 10 Bars:</span>
                <code className="text-amber-400 font-mono">←/→ (Shift)</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Toggle 3D MA:</span>
                <code className="text-amber-400 font-mono">M</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stretch Z / XY:</span>
                <code className="text-amber-400 font-mono">[ ] / + -</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
