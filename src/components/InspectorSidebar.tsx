"use client";

import React, { useMemo } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { BUILTIN_INDICATOR_PLUGINS } from "@/lib/quant/plugins";
import {
  buildSummaryFromSlice,
  calculateCorrelation,
  calculateLogReturnCorrelation,
  computeCrossProxyConfluence,
  computeMarkovTransitionMatrix,
  computePhaseClusters,
  computePhaseEntropy,
  computePhaseGeometry3D,
  computeSpatialAttractorBasins,
  computeVectorMA,
  computeWhitepaperStrategy,
  getTimeUnitConfig,
  PHASE_REGIME_META,
  STRATEGY_SETUP_META,
  StrategySetupId,
  synthesizeCompanionProxySeries,
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
  Target,
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
  const setReplayIndex = useAnalyzerStore((s) => s.setReplayIndex);
  const setSubPaneMode = useAnalyzerStore((s) => s.setSubPaneMode);
  const replayTraceMode = useAnalyzerStore((s) => s.replayTraceMode);

  const maCfg = indicators["vector-ma"];
  const maPeriod = Number(maCfg?.params?.period ?? 20);
  const maType = (
    maCfg?.params?.maType === "EMA" ? "EMA" : "SMA"
  ) as "SMA" | "EMA";
  const stratCfg = indicators["strategy-signals-3d"]?.params;
  const coilThreshold = Number(stratCfg?.coilThreshold ?? 42);
  const curvatureHookThreshold = Number(
    stratCfg?.curvatureHookThreshold ?? 0.34
  );
  const minConfidence = Number(stratCfg?.minConfidence ?? 52);

  const memoQuant = useMemo(() => {
    if (dataSeries.length === 0) return null;
    const ma = computeVectorMA(dataSeries, maPeriod, maType);
    const geo = computePhaseGeometry3D(dataSeries, maPeriod, maPeriod);
    const clusters = computePhaseClusters(dataSeries, maPeriod, geo);
    const entropy = computePhaseEntropy(dataSeries, maPeriod, geo, clusters);
    const crossProxySeries = synthesizeCompanionProxySeries(
      dataSeries,
      triadPair
    );
    const strategy = computeWhitepaperStrategy(dataSeries, {
      pair: triadPair,
      period: maPeriod,
      maType,
      coilThreshold,
      curvatureHookThreshold,
      minConfidence,
      crossProxySeries,
      precomputedMA: ma,
      precomputedGeo: geo,
      precomputedClusters: clusters,
      precomputedEntropy: entropy,
    });
    return { ma, geo, clusters, entropy, strategy, crossProxySeries };
  }, [
    dataSeries,
    maPeriod,
    maType,
    triadPair,
    coilThreshold,
    curvatureHookThreshold,
    minConfidence,
  ]);

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
  const latestTurnAngle = memoQuant?.geo.turningAngleDeg[latestIdx] ?? 0;
  const latestHairpinPct = memoQuant?.geo.hairpinRatioPct[latestIdx] ?? 0;

  // Phase-Space Entropy readouts
  const latestPermEnt = memoQuant?.entropy.permutationEntropy[latestIdx] ?? 0;
  const latestTurnEnt = memoQuant?.entropy.turningEntropy[latestIdx] ?? 0;
  const latestMarkovEnt = memoQuant?.entropy.markovRegimeEntropy[latestIdx] ?? 0;
  const latestCompEntPct = memoQuant?.entropy.compositeEntropyPct[latestIdx] ?? 0;
  const latestQualCoil =
    memoQuant?.entropy.entropyQualityCoilScore[latestIdx] ?? 0;

  // Slice-wide Signal-to-Noise regime distribution over [startIdx..effectiveEnd)
  let orderedBarCount = 0;
  let chopBarCount = 0;
  const sliceCount = Math.max(1, effectiveEnd - startIdx);
  if (memoQuant?.entropy) {
    const compArr = memoQuant.entropy.compositeEntropyPct;
    for (let i = startIdx; i < effectiveEnd; i++) {
      const v = compArr[i];
      if (v < 45) orderedBarCount++;
      else if (v >= 75) chopBarCount++;
    }
  }
  const orderedSharePct = (orderedBarCount / sliceCount) * 100;
  const chopSharePct = (chopBarCount / sliceCount) * 100;
  const transSharePct = Math.max(0, 100 - orderedSharePct - chopSharePct);

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

  // Strategy Engine readouts at effectiveEnd
  const stratData = memoQuant?.strategy ?? null;
  const activePos = stratData?.position[latestIdx] ?? 0;
  const activeSetupId = ((stratData?.activeSetupId[latestIdx] || 1) as StrategySetupId);
  const activeSetupMeta = STRATEGY_SETUP_META[activeSetupId];
  const latestConfidence = stratData?.confidence[latestIdx] ?? 0;
  const latestCutEff = stratData?.isoCutEfficiency[latestIdx] ?? 0.5;
  const latestSpineXau = stratData?.spineXauusd[latestIdx] ?? 0;
  const latestStop = stratData?.stopLossSeries[latestIdx] ?? Number.NaN;
  const latestTp = stratData?.takeProfitSeries[latestIdx] ?? Number.NaN;

  const stratSummary = stratData
    ? buildSummaryFromSlice(
        stratData.events,
        stratData.trades,
        stratData.equityCurvePct,
        stratData.drawdownPct,
        effectiveEnd
      )
    : null;

  const visibleSignalEvents = stratData
    ? stratData.events.filter((e) => e.barIndex < effectiveEnd)
    : [];
  const latestEntryOrFilterEvt =
    visibleSignalEvents.findLast(
      (e) => e.action === "BUY" || e.action === "SELL" || e.action === "FILTERED"
    ) ?? null;
  const recentSignals = visibleSignalEvents
    .filter((e) => e.action === "BUY" || e.action === "SELL" || e.action === "FILTERED")
    .slice(-5)
    .reverse();

  const activeCrossProxy =
    memoQuant && activeTab === "stats"
      ? effectiveEnd === dataSeries.length
        ? memoQuant.strategy.crossProxy
        : computeCrossProxyConfluence(dataSeries, {
            primaryPair: triadPair,
            period: maPeriod,
            maType,
            crossProxySeries: memoQuant.crossProxySeries,
            effectiveEnd,
            precomputedMA: memoQuant.ma,
            precomputedGeo: memoQuant.geo,
            precomputedClusters: memoQuant.clusters,
          })
      : memoQuant?.strategy.crossProxy ?? null;
  const latestBreadth = activeCrossProxy?.bullionBreadth[latestIdx] ?? 0;
  const latestChiralityConsensus =
    activeCrossProxy?.chiralityConsensus[latestIdx] ?? 0;
  const latestConsensusSpine =
    activeCrossProxy?.consensusSpineXauusd[latestIdx] ?? 0;
  const latestConsensusZ = activeCrossProxy?.consensusSpineZ[latestIdx] ?? 0;
  const latestBounceBias = activeCrossProxy?.bounceSignalBias[latestIdx] ?? 0;
  const topBounceZones = activeCrossProxy?.latestBounceZones.slice(0, 4) ?? [];
  const triadSnapshots = activeCrossProxy?.latestTriadSnapshots ?? [];

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
            {/* Whitepaper 5-Setup Strategy & Signal Engine Card */}
            {stratData && stratSummary && (
              <div className="bg-[#111827] border border-emerald-500/35 rounded-lg p-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold text-emerald-300">
                      Whitepaper Strategy Signals
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                      activePos === 1
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : activePos === -1
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}
                  >
                    {activePos === 1
                      ? "▲ BUY / LONG"
                      : activePos === -1
                      ? "▼ SELL / SHORT"
                      : "● FLAT / SCAN"}
                  </span>
                </div>

                {/* Active Position / Latest Setup Readout */}
                <div className="bg-[#090d16] border border-[#1e293b] rounded-md p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white">
                      {activePos !== 0
                        ? activeSetupMeta.shortName
                        : latestEntryOrFilterEvt
                        ? `Last: ${latestEntryOrFilterEvt.shortLabel}`
                        : "Awaiting Setup Trigger"}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-cyan-300">
                      Conviction: {latestConfidence.toFixed(0)}%
                    </span>
                  </div>

                  {activePos !== 0 &&
                    Number.isFinite(latestStop) &&
                    Number.isFinite(latestTp) && (
                      <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono">
                        <div className="bg-[#111827] px-1.5 py-1 rounded border border-white/[0.04]">
                          <div className="text-slate-400">Stop (SL)</div>
                          <div className="text-rose-400 font-bold">
                            ${latestStop.toFixed(1)}
                          </div>
                        </div>
                        <div className="bg-[#111827] px-1.5 py-1 rounded border border-white/[0.04]">
                          <div className="text-slate-400">Target (TP)</div>
                          <div className="text-emerald-400 font-bold">
                            ${latestTp.toFixed(1)}
                          </div>
                        </div>
                        <div className="bg-[#111827] px-1.5 py-1 rounded border border-white/[0.04]">
                          <div className="text-slate-400">3D Spine</div>
                          <div className="text-cyan-300 font-bold">
                            ${latestSpineXau.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    )}

                  {latestEntryOrFilterEvt && (
                    <p className="text-[10px] text-slate-300 leading-relaxed pt-1 border-t border-white/[0.05]">
                      {latestEntryOrFilterEvt.rationale}
                    </p>
                  )}
                </div>

                {/* Iso-Contour Orthogonal Efficiency */}
                <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                  <span className="text-slate-400">
                    Iso-XAUUSD Cut Efficiency:
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      latestCutEff >= 0.55
                        ? "text-emerald-400"
                        : "text-sky-400"
                    }`}
                  >
                    {(latestCutEff * 100).toFixed(0)}% (
                    {latestCutEff >= 0.55 ? "Orthogonal Cut" : "FX Slide"})
                  </span>
                </div>

                {/* Causal Backtest Performance Grid */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05] flex justify-between">
                    <span className="text-slate-400">Signals (B/S):</span>
                    <span className="font-mono font-bold text-white">
                      {stratSummary.buyCount}B / {stratSummary.sellCount}S
                    </span>
                  </div>
                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05] flex justify-between">
                    <span className="text-slate-400">Win Rate:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {stratSummary.winRatePct.toFixed(0)}% ({stratSummary.winningTrades}/{stratSummary.totalTrades})
                    </span>
                  </div>
                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05] flex justify-between">
                    <span className="text-slate-400">Profit Factor:</span>
                    <span className="font-mono font-bold text-amber-300">
                      {stratSummary.profitFactor.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05] flex justify-between">
                    <span className="text-slate-400">Net PnL ($/oz):</span>
                    <span
                      className={`font-mono font-bold ${
                        stratSummary.totalNetPnlUsd >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {stratSummary.totalNetPnlUsd >= 0 ? "+" : ""}$
                      {stratSummary.totalNetPnlUsd.toFixed(1)}
                    </span>
                  </div>
                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05] flex justify-between">
                    <span className="text-slate-400">Sharpe / MaxDD:</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {stratSummary.sharpeRatio.toFixed(2)} / -{stratSummary.maxDrawdownPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05] flex justify-between">
                    <span className="text-slate-400" title="Setup 2 Fake Dollar-Induced Spikes Blocked">
                      S2 Blocked:
                    </span>
                    <span className="font-mono font-bold text-sky-400">
                      {stratSummary.blockedFakeouts} spikes
                    </span>
                  </div>
                </div>

                {/* Recent Signal Log (Click to Scrub 3D/2D Replay) */}
                {recentSignals.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <span>Recent Signals (Click to Inspect Bar)</span>
                      <button
                        onClick={() => {
                          setSubPaneMode("signals");
                          if (
                            typeof window !== "undefined" &&
                            window.innerWidth < 768
                          ) {
                            setSidebarOpen(false);
                          }
                        }}
                        className="text-emerald-400 hover:underline cursor-pointer"
                      >
                        2D Equity Chart →
                      </button>
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                      {recentSignals.map((evt) => (
                        <button
                          key={`${evt.barIndex}_${evt.action}`}
                          onClick={() => {
                            setReplayIndex(evt.barIndex + 1);
                            setSubPaneMode("signals");
                            if (
                              typeof window !== "undefined" &&
                              window.innerWidth < 768
                            ) {
                              setSidebarOpen(false);
                            }
                          }}
                          className="w-full text-left bg-[#090d16] hover:bg-[#162033] px-2 py-1 rounded border border-white/[0.05] flex items-center justify-between gap-1.5 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold shrink-0 ${
                                evt.action === "BUY"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : evt.action === "SELL"
                                  ? "bg-rose-500/20 text-rose-300"
                                  : "bg-sky-500/20 text-sky-300"
                              }`}
                            >
                              {evt.action === "BUY"
                                ? "▲ BUY"
                                : evt.action === "SELL"
                                ? "▼ SELL"
                                : "✕ S2"}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-200 truncate">
                              S{evt.setupId}: {STRATEGY_SETUP_META[evt.setupId].shortName.replace(/^S\d:\s*/, "")}
                            </span>
                          </div>
                          <div className="text-right font-mono text-[10px] shrink-0">
                            <span className="text-white font-bold">
                              ${evt.priceXauusd.toFixed(1)}
                            </span>
                            <span className="text-slate-400 ml-1">
                              ({evt.confidence}%)
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cross-Proxy Confluence & Implied XAUUSD Bounce Matrix */}
            {activeCrossProxy && (
              <div className="bg-gradient-to-b from-[#0e1a24] to-[#111827] border border-teal-500/35 rounded-lg p-3 space-y-2.5 text-xs shadow-lg">
                <div className="flex items-center justify-between border-b border-teal-500/20 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-teal-400" />
                    <span className="font-bold text-teal-300">
                      Cross-Proxy & Bounce Matrix
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-[10px] font-mono font-bold text-teal-300">
                    {activeCrossProxy.proxyCount}G10 Triads
                  </span>
                </div>

                {/* 2x2 Multi-Proxy Telemetry Grid */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05]">
                    <div className="text-[10px] text-slate-400">
                      Bullion Breadth
                    </div>
                    <div
                      className={`font-mono font-bold ${
                        latestBreadth > 0.15
                          ? "text-emerald-400"
                          : latestBreadth < -0.15
                          ? "text-rose-400"
                          : "text-slate-200"
                      }`}
                    >
                      {latestBreadth >= 0 ? "+" : ""}
                      {(latestBreadth * 100).toFixed(0)}% (
                      {latestBreadth > 0.15
                        ? "BULL"
                        : latestBreadth < -0.15
                        ? "BEAR"
                        : "NEUT"}
                      )
                    </div>
                  </div>

                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05]">
                    <div className="text-[10px] text-slate-400">
                      Chirality Consensus
                    </div>
                    <div
                      className={`font-mono font-bold ${
                        latestChiralityConsensus > 0.12
                          ? "text-emerald-400"
                          : latestChiralityConsensus < -0.12
                          ? "text-amber-300"
                          : "text-slate-200"
                      }`}
                    >
                      {latestChiralityConsensus >= 0 ? "+" : ""}
                      {(latestChiralityConsensus * 100).toFixed(0)}% (
                      {latestChiralityConsensus > 0.12
                        ? "Gold-Led"
                        : latestChiralityConsensus < -0.12
                        ? "FX-Led"
                        : "Balanced"}
                      )
                    </div>
                  </div>

                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05]">
                    <div className="text-[10px] text-slate-400">
                      Consensus 3D Spine
                    </div>
                    <div className="font-mono font-bold text-cyan-300">
                      ${latestConsensusSpine.toFixed(1)}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({latestConsensusZ >= 0 ? "+" : ""}
                        {latestConsensusZ.toFixed(2)}σ)
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#090d16] px-2 py-1.5 rounded border border-white/[0.05]">
                    <div className="text-[10px] text-slate-400">
                      Rail Bounce Bias
                    </div>
                    <div
                      className={`font-mono font-bold ${
                        latestBounceBias > 0.2
                          ? "text-emerald-400"
                          : latestBounceBias < -0.2
                          ? "text-rose-400"
                          : "text-slate-300"
                      }`}
                    >
                      {latestBounceBias >= 0 ? "+" : ""}
                      {(latestBounceBias * 100).toFixed(0)}% (
                      {latestBounceBias > 0.2
                        ? "Sup Bounce"
                        : latestBounceBias < -0.2
                        ? "Res Fade"
                        : "In-Tube"}
                      )
                    </div>
                  </div>
                </div>

                {/* Ranked High-Probability Implied XAUUSD Bounce Zones */}
                {topBounceZones.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <span>Implied XAUUSD Bounce Zones</span>
                      <span className="font-mono text-teal-300">
                        Spot ${latest ? latest.xauusd.toFixed(1) : "--"}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {topBounceZones.map((zone, idx) => {
                        const isSup = zone.role === "SUPPORT";
                        const isRes = zone.role === "RESISTANCE";
                        return (
                          <div
                            key={`${zone.role}_${idx}`}
                            className="bg-[#090d16] p-2 rounded border border-white/[0.06] space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold shrink-0 ${
                                    isSup
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : isRes
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                      : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                  }`}
                                >
                                  {isSup ? "SUP" : isRes ? "RES" : "EQ"}
                                </span>
                                <span className="font-mono font-bold text-white text-[11px]">
                                  ${zone.centerPriceXauusd.toFixed(2)}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 truncate">
                                  ({zone.distanceSigma >= 0 ? "+" : ""}
                                  {zone.distanceSigma.toFixed(2)}σ)
                                </span>
                              </div>
                              <div className="text-right font-mono text-[10px] shrink-0">
                                <span className="text-teal-300 font-bold">
                                  {zone.bounceProbabilityPct}% prob
                                </span>
                                <span className="text-slate-500 ml-1">
                                  ({zone.confluenceScore}pt)
                                </span>
                              </div>
                            </div>

                            {/* Bounce Probability Bar */}
                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isSup
                                    ? "bg-emerald-400"
                                    : isRes
                                    ? "bg-rose-400"
                                    : "bg-sky-400"
                                }`}
                                style={{
                                  width: `${zone.bounceProbabilityPct}%`,
                                }}
                              />
                            </div>

                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {zone.contributors.slice(0, 3).map((c) => (
                                <span
                                  key={c}
                                  className="px-1 py-0.2 rounded bg-white/[0.04] text-[9px] font-mono text-slate-300"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 6-Triad G10 Cross-Confirmation Matrix */}
                {triadSnapshots.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <span>6-Triad G10 Cross-Confirmation</span>
                      <span className="text-[9px] font-mono text-slate-500">
                        Z(X) · 3D Spine · ±2σ Rail
                      </span>
                    </div>
                    <div className="space-y-1">
                      {triadSnapshots.map((snap) => {
                        const regMeta = PHASE_REGIME_META[snap.regimeId];
                        const agreeTag =
                          snap.signalAgreement === 1
                            ? "BULL"
                            : snap.signalAgreement === -1
                            ? "BEAR"
                            : "NEUT";
                        return (
                          <div
                            key={snap.pair}
                            className={`px-2 py-1 rounded border flex items-center justify-between gap-1 text-[10px] font-mono ${
                              snap.pair === triadPair
                                ? "bg-teal-500/10 border-teal-500/35"
                                : "bg-[#090d16] border-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-slate-200 w-11 shrink-0">
                                {snap.xTicker}
                              </span>
                              <span
                                className={`font-semibold w-11 shrink-0 ${
                                  snap.crossGoldZ >= 0
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {snap.crossGoldZ >= 0 ? "+" : ""}
                                {snap.crossGoldZ.toFixed(2)}σ
                              </span>
                              <span
                                className="px-1 rounded text-[8px] font-bold shrink-0"
                                style={{
                                  backgroundColor: `${regMeta.color}22`,
                                  color: regMeta.color,
                                }}
                              >
                                C{snap.regimeId}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className="text-slate-300"
                                title={`±2σ Rail: $${snap.lowerRail2SigmaXauusd.toFixed(
                                  0
                                )} – $${snap.upperRail2SigmaXauusd.toFixed(0)}`}
                              >
                                ${snap.spineXauusd.toFixed(0)}
                              </span>
                              <span
                                className={`px-1 py-0.2 rounded text-[8px] font-extrabold ${
                                  agreeTag === "BULL"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : agreeTag === "BEAR"
                                    ? "bg-rose-500/20 text-rose-300"
                                    : "bg-slate-700/60 text-slate-300"
                                }`}
                              >
                                {agreeTag}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

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

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span
                  className="text-slate-400"
                  title="Top-down (X,Y) turning/deflection angle between consecutive standardized steps (<90° Forward Continuation vs >=90° Hairpin Reversal)"
                >
                  Top-Down Turn (Δθ):
                </span>
                <span
                  className={`font-mono font-semibold ${
                    latestTurnAngle >= 90
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}
                >
                  {latestTurnAngle.toFixed(1)}° (
                  {latestTurnAngle >= 90 ? ">90° Hairpin" : "<90° Forward"})
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span
                  className="text-slate-400"
                  title="Percentage of active steps in rolling window with >=90° top-down deflection angle"
                >
                  &gt;90° Hairpin Ratio:
                </span>
                <span
                  className={`font-mono font-semibold ${
                    latestHairpinPct >= 50
                      ? "text-rose-400"
                      : latestHairpinPct <= 25
                      ? "text-emerald-400"
                      : "text-amber-300"
                  }`}
                >
                  {latestHairpinPct.toFixed(0)}% (
                  {latestHairpinPct >= 50
                    ? "Whipsaw Chop"
                    : latestHairpinPct <= 25
                    ? "Laminar Flow"
                    : "Mixed"}
                  )
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

            {/* Phase-Space Entropy & Signal-to-Noise Filter */}
            <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="font-bold text-amber-400">
                  Phase-Space Entropy (S/N)
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    latestCompEntPct < 45
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : latestCompEntPct >= 75
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {latestCompEntPct < 45
                    ? "ORDERED FLOW"
                    : latestCompEntPct >= 75
                    ? "MAX ENTROPY CHOP"
                    : "TRANSITIONAL"}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span
                  className="text-slate-400"
                  title="Composite Phase Disorder (55% Turning Entropy + 45% Ordinal Permutation Entropy)"
                >
                  Composite Disorder:
                </span>
                <span
                  className={`font-mono font-bold ${
                    latestCompEntPct < 45
                      ? "text-emerald-400"
                      : latestCompEntPct >= 75
                      ? "text-rose-400"
                      : "text-amber-300"
                  }`}
                >
                  {latestCompEntPct.toFixed(1)}%
                </span>
              </div>

              {/* Visual Disorder Spectrum Gauge (0% Ordered -> 45% -> 75% -> 100% Max Chop) */}
              <div className="space-y-1 py-0.5 border-b border-white/[0.04]">
                <div className="relative h-2 w-full rounded-full overflow-hidden bg-[#090d16] border border-white/[0.07] flex">
                  <div
                    className="h-full bg-emerald-500/45"
                    style={{ width: "45%" }}
                    title="0–45%: Ordered Flow"
                  />
                  <div
                    className="h-full bg-amber-500/45"
                    style={{ width: "30%" }}
                    title="45–75%: Transitional"
                  />
                  <div
                    className="h-full bg-rose-500/50"
                    style={{ width: "25%" }}
                    title="75–100%: Max Entropy Chop (No-Trade)"
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow"
                    style={{
                      left: `calc(${Math.max(
                        1,
                        Math.min(99, latestCompEntPct)
                      )}% - 2px)`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span className="text-emerald-400">
                    Ordered: {orderedSharePct.toFixed(0)}%
                  </span>
                  <span className="text-amber-300">
                    Trans: {transSharePct.toFixed(0)}%
                  </span>
                  <span className="text-rose-400">
                    Chop: {chopSharePct.toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span
                  className="text-slate-400"
                  title="Circular & 8-Sector Shannon Entropy of signed 2D phase deflections Δφ_t in [0, 1]"
                >
                  Turning Entropy (H_Δφ):
                </span>
                <span className="font-mono font-semibold text-sky-400">
                  {latestTurnEnt.toFixed(3)}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span
                  className="text-slate-400"
                  title="Bandt-Pompe Ordinal Permutation Entropy (d=3, 6 rank motifs) on primary XAUUSD & FX legs"
                >
                  Permutation Entropy (d=3):
                </span>
                <span className="font-mono font-semibold text-purple-300">
                  {latestPermEnt.toFixed(3)}
                </span>
              </div>

              <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                <span
                  className="text-slate-400"
                  title="Conditional Shannon Entropy H(S_{t+1} | S_t) of the active regime row in the 4x4 Markov matrix"
                >
                  Markov Regime Entropy:
                </span>
                <span className="font-mono font-semibold text-emerald-400">
                  {latestMarkovEnt.toFixed(3)} (
                  {latestMarkovEnt < 0.55
                    ? "Locked-In"
                    : latestMarkovEnt > 0.8
                    ? "Bifurcating"
                    : "Moderate"}
                  )
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span
                  className="text-slate-400"
                  title="Entropy-gated 3D Compression Coil Score that penalizes high-entropy bid-ask chop fake coils"
                >
                  Entropy-Quality Coil:
                </span>
                <span className="font-mono font-bold text-cyan-300">
                  {latestQualCoil.toFixed(1)} / 100 (Raw: {latestCoil.toFixed(0)})
                </span>
              </div>

              <div className="pt-1 border-t border-white/[0.05] flex justify-end">
                <button
                  onClick={() => setSubPaneMode("entropy")}
                  className="text-[10px] font-semibold text-amber-400 hover:underline cursor-pointer"
                >
                  Open 2D Entropy Chart →
                </button>
              </div>
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
