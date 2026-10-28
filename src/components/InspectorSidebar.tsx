"use client";

import React, { useMemo } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { BUILTIN_INDICATOR_PLUGINS } from "@/lib/quant/plugins";
import {
  calculateCorrelation,
  calculateLogReturnCorrelation,
  computeMarkovTransitionMatrix,
  computePhaseClusters,
  computePhaseGeometry3D,
  computeSpatialAttractorBasins,
  computeVectorMA,
  getTimeUnitConfig,
  PHASE_REGIME_META,
} from "@/lib/quant/math";
import { CameraPreset, PhaseRegimeId, TRIAD_CONFIGS } from "@/types/market";
import {
  BookOpen,
  Box,
  Compass,
  Layers,
  RotateCcw,
  Sliders,
  Sparkles,
  X,
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
  const setSidebarOpen = useAnalyzerStore((s) => s.setSidebarOpen);
  const setGuideModalOpen = useAnalyzerStore((s) => s.setGuideModalOpen);
  const activeTab = useAnalyzerStore((s) => s.activeSidebarTab);
  const setActiveTab = useAnalyzerStore((s) => s.setActiveSidebarTab);

  const triadPair = useAnalyzerStore((s) => s.triadPair);
  const timeframe = useAnalyzerStore((s) => s.timeframe);
  const triad = TRIAD_CONFIGS[triadPair] ?? TRIAD_CONFIGS.EUR;
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

  const maCfg = indicators["vector-ma"];
  const maPeriod = Number(maCfg?.params?.period ?? 20);
  const maType = (
    maCfg?.params?.maType === "EMA" ? "EMA" : "SMA"
  ) as "SMA" | "EMA";

  const memoQuant = useMemo(() => {
    if (dataSeries.length === 0) return null;
    const ma = computeVectorMA(dataSeries, maPeriod, maType);
    const geo = computePhaseGeometry3D(dataSeries, maPeriod, maPeriod);
    const clusters = computePhaseClusters(dataSeries, maPeriod, geo);
    return { ma, geo, clusters };
  }, [dataSeries, maPeriod, maType]);

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

  const refCross = latest ? latest.marketXaueur ?? latest.xaueur : 1;
  const impliedFX = latest
    ? triad.quoteMode === "CCY_USD"
      ? latest.xauusd / refCross
      : refCross / latest.xauusd
    : 0;
  const basisPips = latest
    ? (latest.eurusd - impliedFX) * triad.pipMultiplier
    : 0;

  const spanSeconds =
    activeSlice.length > 1
      ? Math.max(1, latest.timestamp - activeSlice[0].timestamp)
      : 0;
  const timeCfg = getTimeUnitConfig(timeframe);

  const maData = memoQuant?.ma ?? null;
  const latestIdx = effectiveEnd - 1;
  const latestMA_X = maData?.xMA[latestIdx] ?? 0;
  const latestMA_Y = maData?.yMA[latestIdx] ?? 0;
  const latestDispPct = maData?.displacementPct[latestIdx] ?? 0;
  const latestDispZ = maData?.displacementZScore[latestIdx] ?? 0;

  // Differential Geometry (#2) & Cluster Analysis (#6) readouts
  const latestVel = memoQuant?.geo.velocity[latestIdx] ?? 0;
  const latestCurv = memoQuant?.geo.curvature[latestIdx] ?? 0;
  const latestLevy = memoQuant?.geo.levyArea[latestIdx] ?? 0;
  const latestCoil = memoQuant?.geo.coilScore[latestIdx] ?? 0;

  const latestRegimeId = ((memoQuant?.clusters.regime[latestIdx] ?? 0) &
    3) as PhaseRegimeId;
  const latestRegimeMeta = PHASE_REGIME_META[latestRegimeId];
  const markovMatrix = memoQuant
    ? computeMarkovTransitionMatrix(memoQuant.clusters.regime, effectiveEnd)
    : [
        [0.25, 0.25, 0.25, 0.25],
        [0.25, 0.25, 0.25, 0.25],
        [0.25, 0.25, 0.25, 0.25],
        [0.25, 0.25, 0.25, 0.25],
      ];
  const nextStateProbs = markovMatrix[latestRegimeId] ?? [0.25, 0.25, 0.25, 0.25];

  const kBasinsParam = Number(
    indicators["cluster-attractors-3d"]?.params?.kBasins ?? 3
  );
  const spatialBasins =
    activeTab === "stats" && activeSlice.length > 0
      ? computeSpatialAttractorBasins(activeSlice, kBasinsParam)
      : [];
  const activeBasin =
    spatialBasins.find((b) => b.isCurrentBasin) ?? spatialBasins[0] ?? null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={() => setSidebarOpen(false)}
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
      />

      <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[76dvh] rounded-t-2xl border-t border-cyan-500/30 shadow-2xl md:static md:z-auto md:w-80 md:h-full md:max-h-none md:rounded-none md:border-t-0 md:border-l md:border-[#1f293d] bg-[#0d131f] flex flex-col select-none shrink-0 overflow-hidden">
        {/* Mobile Sheet Header & Close Button */}
        <div className="flex md:hidden items-center justify-between px-4 py-2 border-b border-[#1f293d] bg-[#090d16]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Analyzer Tools & Indicators
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-white bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
                      STRETCH X ({triad.currencySymbol} {triad.xTicker})
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
                      STRETCH Y ({triad.fxUnitLabel} {triad.yTicker})
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
                <span className="text-slate-400">
                  Implied {triad.yTicker}:
                </span>
                <span className="font-mono font-semibold text-white">
                  {impliedFX
                    ? impliedFX.toFixed(triad.yDecimals + 1)
                    : "-.-----"}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">
                  Market {triad.yTicker}:
                </span>
                <span className="font-mono font-semibold text-white">
                  {latest
                    ? latest.eurusd.toFixed(triad.yDecimals + 1)
                    : "-.-----"}
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
                    ? `${triad.currencySymbol}${latestMA_X.toFixed(
                        triad.xDecimals
                      )} / ${latestMA_Y.toFixed(triad.yDecimals)}`
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

            {/* Pillar #2: Differential Geometry & Spiral Chirality Diagnostics */}
            <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="font-bold text-cyan-400">
                  3D Geometry & Chirality (#2)
                </span>
                <span className="text-[10px] font-mono text-cyan-300">
                  Frenet-Serret
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Phase Velocity (v):</span>
                <span className="font-mono font-semibold text-amber-300">
                  {latestVel.toFixed(3)} σ/bar
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">3D Curvature (κ):</span>
                <span className="font-mono font-semibold text-purple-300">
                  {latestCurv.toFixed(3)}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span className="text-slate-400">Compression Coil Score:</span>
                <span
                  className={`font-mono font-bold ${
                    latestCoil >= 45 ? "text-cyan-300" : "text-slate-200"
                  }`}
                >
                  {latestCoil.toFixed(1)} / 100
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Lévy Area (Lz Lead-Lag):</span>
                <span
                  className={`font-mono font-semibold ${
                    latestLevy >= 0 ? "text-emerald-400" : "text-sky-400"
                  }`}
                >
                  {latestLevy >= 0 ? "+" : ""}
                  {latestLevy.toFixed(2)} (
                  {latestLevy >= 0
                    ? `CCW ${triad.xTicker}`
                    : `CW ${triad.yTicker}`}
                  )
                </span>
              </div>
            </div>

            {/* Pillar #6: Unsupervised Phase Cluster & Markov Transition Diagnostics */}
            <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="font-bold text-pink-400">
                  Phase Cluster & Markov (#6)
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                  style={{
                    backgroundColor: `${latestRegimeMeta.color}22`,
                    color: latestRegimeMeta.color,
                    border: `1px solid ${latestRegimeMeta.color}55`,
                  }}
                >
                  C{latestRegimeId}: {latestRegimeMeta.shortLabel}
                </span>
              </div>

              <div className="text-[11px] text-slate-300 leading-snug">
                <span className="font-semibold text-white">
                  {latestRegimeMeta.label}:
                </span>{" "}
                {latestRegimeMeta.description}
              </div>

              {/* Next-Bar Markov Transition Probabilities */}
              <div className="space-y-1 pt-1 border-t border-white/[0.05]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Markov Next-State Odds P(S_t+1 | C{latestRegimeId}):
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {([0, 1, 2, 3] as PhaseRegimeId[]).map((cid) => {
                    const meta = PHASE_REGIME_META[cid];
                    const probPct = (nextStateProbs[cid] ?? 0.25) * 100;
                    return (
                      <div
                        key={cid}
                        className="flex items-center justify-between bg-[#090d16] px-2 py-1 rounded border border-white/[0.05]"
                      >
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: meta.color }}
                        >
                          → {meta.shortLabel}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-white">
                          {probPct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Spatial 3D Attractor Basin Summary */}
              {activeBasin && (
                <div className="pt-1.5 border-t border-white/[0.05] space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Active 3D Basin (#{activeBasin.id}):
                    </span>
                    <span className="font-mono font-semibold text-pink-300">
                      {activeBasin.dwellPct.toFixed(1)}% Dwell
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Basin Center:</span>
                    <span className="font-mono text-white">
                      {triad.currencySymbol}
                      {activeBasin.centerX.toFixed(triad.xDecimals)} /{" "}
                      {activeBasin.centerY.toFixed(triad.yDecimals)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Basin Distance:</span>
                    <span
                      className={`font-mono font-semibold ${
                        activeBasin.latestSigmaDist > 2.0
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {activeBasin.latestSigmaDist.toFixed(2)}σ{" "}
                      {activeBasin.latestSigmaDist > 2.0
                        ? "(Vacuum)"
                        : "(Equilibrium)"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Mathematical Cross-Rate Note */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-[11px] text-amber-200/90 space-y-1">
              <div className="font-bold text-amber-400">
                {triad.label} Cross Identities:
              </div>
              <div className="font-mono text-[10px]">
                • {triad.formulaPrimary}
              </div>
              <div className="font-mono text-[10px]">
                • {triad.formulaInverse}
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

      {/* Persistent Bottom Button to Open Technical Whitepaper & Playbook Popup */}
      <div className="p-2.5 border-t border-[#1f293d] bg-[#090d16] shrink-0">
        <button
          onClick={() => setGuideModalOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 transition cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span>Whitepaper &amp; 5-Setup Playbook Guide</span>
        </button>
      </div>
    </aside>
    </>
  );
}
