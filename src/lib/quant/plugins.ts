import {
  IndicatorInstanceConfig,
  IndicatorParamField,
  MarketBar,
  TimeframeId,
  TRIAD_CONFIGS,
  TriadPairId,
} from "@/types/market";
import {
  computeCrossProxyConfluence,
  computePhaseEntropy,
  computePhaseGeometry3D,
  computeSpatialAttractorBasins,
  computeVectorBollinger3D,
  computeVectorMA,
  computeWhitepaperStrategy,
  STRATEGY_SETUP_META,
  StrategySetupId,
  synthesizeCompanionProxySeries,
} from "./math";

export type PlotlyTrace = Record<string, unknown>;

export interface IndicatorRenderContext {
  triadPair?: TriadPairId;
  fullSeries: MarketBar[];
  activeSlice: MarketBar[];
  startIdx: number;
  effectiveEnd: number;
  xVals: number[];
  yVals: number[];
  zVals: number[];
  zFloor: number;
  timeframe: TimeframeId;
  isReplaying: boolean;
  params: Record<string, number | string | boolean>;
  allConfigs: Record<string, IndicatorInstanceConfig>;
}

export interface IndicatorSummaryReadout {
  label: string;
  value: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  color?: string;
}

export interface IndicatorPlugin {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: "trend" | "volatility" | "geometry";
  accentColor: string;
  defaultEnabled: boolean;
  defaultParams: Record<string, number | string | boolean>;
  paramSchema: IndicatorParamField[];
  buildTraces3D: (ctx: IndicatorRenderContext) => PlotlyTrace[];
  getSummaryReadout?: (
    ctx: IndicatorRenderContext
  ) => IndicatorSummaryReadout | null;
}

export const VECTOR_MA_PLUGIN: IndicatorPlugin = {
  id: "vector-ma",
  name: "3D Moving Average Spine",
  shortName: "3D MA",
  description:
    "Multivariate central equilibrium trajectory (MA_X, MA_Y, t) with instantaneous phase displacement.",
  category: "trend",
  accentColor: "#34d399",
  defaultEnabled: true,
  defaultParams: {
    period: 20,
    maType: "SMA",
    showSpineShadow: true,
    width: 5.5,
  },
  paramSchema: [
    {
      key: "period",
      label: "Period",
      type: "number",
      min: 2,
      max: 500,
      step: 1,
      presets: [9, 20, 50, 100, 200],
    },
    {
      key: "maType",
      label: "Algorithm",
      type: "select",
      options: [
        { label: "SMA", value: "SMA" },
        { label: "EMA", value: "EMA" },
      ],
    },
    {
      key: "showSpineShadow",
      label: "Floor Shadow",
      type: "boolean",
    },
  ],
  buildTraces3D(ctx) {
    const period = Number(ctx.params.period ?? 20);
    const maType = (ctx.params.maType === "EMA" ? "EMA" : "SMA") as
      | "SMA"
      | "EMA";
    const showSpineShadow = Boolean(ctx.params.showSpineShadow ?? true);
    const floorShadowEnabled =
      ctx.allConfigs["floor-shadow"]?.enabled ?? true;

    const { xMA, yMA } = computeVectorMA(ctx.fullSeries, period, maType);
    const maXSlice = Array.from(xMA.slice(ctx.startIdx, ctx.effectiveEnd));
    const maYSlice = Array.from(yMA.slice(ctx.startIdx, ctx.effectiveEnd));

    const traces: PlotlyTrace[] = [
      {
        type: "scatter3d",
        mode: "lines",
        name: `${maType}(${period}) Spine`,
        x: maXSlice,
        y: maYSlice,
        z: ctx.zVals,
        hoverinfo: "name",
        line: {
          color: "#34d399",
          width: Number(ctx.params.width ?? 5.5),
        },
      },
    ];

    if (showSpineShadow && floorShadowEnabled) {
      traces.push({
        type: "scatter3d",
        mode: "lines",
        name: `${maType}(${period}) Floor`,
        x: maXSlice,
        y: maYSlice,
        z: ctx.zVals.map(() => ctx.zFloor),
        hoverinfo: "skip",
        line: {
          color: "rgba(52, 211, 153, 0.4)",
          width: 2.5,
        },
      });
    }

    return traces;
  },
  getSummaryReadout(ctx) {
    const n = ctx.activeSlice.length;
    if (n === 0) return null;
    const period = Number(ctx.params.period ?? 20);
    const maType = (ctx.params.maType === "EMA" ? "EMA" : "SMA") as
      | "SMA"
      | "EMA";
    const { xMA, yMA, displacementPct } = computeVectorMA(
      ctx.fullSeries,
      period,
      maType
    );
    const idx = ctx.effectiveEnd - 1;
    const latestMA_X = xMA[idx];
    const latestMA_Y = yMA[idx];
    const phaseDist = displacementPct[idx];

    return {
      label: `MA(${period}) Center`,
      value: `€${latestMA_X.toFixed(1)} / $${latestMA_Y.toFixed(4)}`,
      secondaryLabel: "MA Phase Deviation",
      secondaryValue: `${phaseDist.toFixed(2)}%`,
      color: "#34d399",
    };
  },
};

export const SLOW_MA_PLUGIN: IndicatorPlugin = {
  id: "slow-ma",
  name: "Secondary Slow 3D MA",
  shortName: "Slow MA",
  description:
    "Secondary slower 3D moving average spine to identify multivariate golden/death crosses and structural regime shifts.",
  category: "trend",
  accentColor: "#ec4899",
  defaultEnabled: false,
  defaultParams: {
    period: 50,
    maType: "SMA",
  },
  paramSchema: [
    {
      key: "period",
      label: "Slow Period",
      type: "number",
      min: 5,
      max: 500,
      step: 1,
      presets: [50, 100, 200],
    },
    {
      key: "maType",
      label: "Algorithm",
      type: "select",
      options: [
        { label: "SMA", value: "SMA" },
        { label: "EMA", value: "EMA" },
      ],
    },
  ],
  buildTraces3D(ctx) {
    const period = Number(ctx.params.period ?? 50);
    const maType = (ctx.params.maType === "EMA" ? "EMA" : "SMA") as
      | "SMA"
      | "EMA";
    const { xMA, yMA } = computeVectorMA(ctx.fullSeries, period, maType);
    const ma2XSlice = Array.from(xMA.slice(ctx.startIdx, ctx.effectiveEnd));
    const ma2YSlice = Array.from(yMA.slice(ctx.startIdx, ctx.effectiveEnd));

    return [
      {
        type: "scatter3d",
        mode: "lines",
        name: `${maType}(${period}) Slow`,
        x: ma2XSlice,
        y: ma2YSlice,
        z: ctx.zVals,
        hoverinfo: "name",
        line: {
          color: "#ec4899",
          width: 4,
          dash: "dash",
        },
      },
    ];
  },
  getSummaryReadout(ctx) {
    const n = ctx.activeSlice.length;
    if (n === 0) return null;
    const period = Number(ctx.params.period ?? 50);
    const maType = (ctx.params.maType === "EMA" ? "EMA" : "SMA") as
      | "SMA"
      | "EMA";
    const { xMA, yMA } = computeVectorMA(ctx.fullSeries, period, maType);
    const idx = ctx.effectiveEnd - 1;
    return {
      label: `Slow ${maType}(${period})`,
      value: `€${xMA[idx].toFixed(1)} / $${yMA[idx].toFixed(4)}`,
      color: "#ec4899",
    };
  },
};

export const BOLLINGER_3D_PLUGIN: IndicatorPlugin = {
  id: "bollinger-3d",
  name: "3D Volatility Bollinger Tube",
  shortName: "3D BBands",
  description:
    "Plots 3D phase-space standard deviation dispersion rails and elliptical cross-section rings around the equilibrium spine.",
  category: "volatility",
  accentColor: "#a78bfa",
  defaultEnabled: false,
  defaultParams: {
    period: 20,
    stdMult: 2.0,
    showRings: true,
  },
  paramSchema: [
    {
      key: "period",
      label: "Period",
      type: "number",
      min: 5,
      max: 200,
      step: 1,
      presets: [14, 20, 50],
    },
    {
      key: "stdMult",
      label: "StdDev (σ)",
      type: "number",
      min: 0.5,
      max: 4.0,
      step: 0.5,
      presets: [1.5, 2.0, 2.5, 3.0],
    },
    {
      key: "showRings",
      label: "Elliptical Rings",
      type: "boolean",
    },
  ],
  buildTraces3D(ctx) {
    const period = Number(ctx.params.period ?? 20);
    const stdMult = Number(ctx.params.stdMult ?? 2.0);
    const showRings = Boolean(ctx.params.showRings ?? true);

    const { xMA, yMA, xStd, yStd } = computeVectorBollinger3D(
      ctx.fullSeries,
      period
    );
    const mx = xMA.slice(ctx.startIdx, ctx.effectiveEnd);
    const my = yMA.slice(ctx.startIdx, ctx.effectiveEnd);
    const sx = xStd.slice(ctx.startIdx, ctx.effectiveEnd);
    const sy = yStd.slice(ctx.startIdx, ctx.effectiveEnd);

    const n = mx.length;
    if (n === 0) return [];

    const upperX: number[] = [];
    const upperY: number[] = [];
    const lowerX: number[] = [];
    const lowerY: number[] = [];

    for (let i = 0; i < n; i++) {
      upperX.push(mx[i] + stdMult * sx[i]);
      upperY.push(my[i] + stdMult * sy[i]);
      lowerX.push(mx[i] - stdMult * sx[i]);
      lowerY.push(my[i] - stdMult * sy[i]);
    }

    const traces: PlotlyTrace[] = [
      {
        type: "scatter3d",
        mode: "lines",
        name: `BBand +${stdMult}σ Rail`,
        x: upperX,
        y: upperY,
        z: ctx.zVals,
        hoverinfo: "name",
        line: {
          color: "rgba(167, 139, 250, 0.55)",
          width: 2,
          dash: "dot",
        },
      },
      {
        type: "scatter3d",
        mode: "lines",
        name: `BBand -${stdMult}σ Rail`,
        x: lowerX,
        y: lowerY,
        z: ctx.zVals,
        hoverinfo: "name",
        line: {
          color: "rgba(167, 139, 250, 0.55)",
          width: 2,
          dash: "dot",
        },
      },
    ];

    if (showRings && n >= 10) {
      const ringStep = Math.max(1, Math.floor(n / 8));
      const ringX: (number | null)[] = [];
      const ringY: (number | null)[] = [];
      const ringZ: (number | null)[] = [];
      const segments = 16;

      for (let idx = ringStep; idx < n; idx += ringStep) {
        const cx = mx[idx];
        const cy = my[idx];
        const rx = stdMult * sx[idx];
        const ry = stdMult * sy[idx];
        const cz = ctx.zVals[idx];

        for (let s = 0; s <= segments; s++) {
          const theta = (2 * Math.PI * s) / segments;
          ringX.push(cx + rx * Math.cos(theta));
          ringY.push(cy + ry * Math.sin(theta));
          ringZ.push(cz);
        }
        ringX.push(null);
        ringY.push(null);
        ringZ.push(null);
      }

      traces.push({
        type: "scatter3d",
        mode: "lines",
        name: `3D Volatility Rings (${stdMult}σ)`,
        x: ringX,
        y: ringY,
        z: ringZ,
        hoverinfo: "skip",
        line: {
          color: "rgba(167, 139, 250, 0.32)",
          width: 1.5,
        },
      });
    }

    return traces;
  },
};

export const FLOOR_SHADOW_PLUGIN: IndicatorPlugin = {
  id: "floor-shadow",
  name: "Floor Shadow & Drop Line",
  shortName: "Shadow",
  description:
    "Projects the 3D phase trajectory onto the Z=0 price plane along with a vertical drop line from the active bar.",
  category: "geometry",
  accentColor: "#38bdf8",
  defaultEnabled: true,
  defaultParams: {
    showDropLine: true,
  },
  paramSchema: [
    {
      key: "showDropLine",
      label: "Vertical Drop Line",
      type: "boolean",
    },
  ],
  buildTraces3D(ctx) {
    const n = ctx.activeSlice.length;
    if (n === 0) return [];
    const latest = ctx.activeSlice[n - 1];
    const showDropLine = Boolean(ctx.params.showDropLine ?? true);

    const traces: PlotlyTrace[] = [
      {
        type: "scatter3d",
        mode: "lines",
        name: "Floor Projection",
        x: ctx.xVals,
        y: ctx.yVals,
        z: ctx.xVals.map(() => ctx.zFloor),
        hoverinfo: "skip",
        line: {
          color: "rgba(56, 189, 248, 0.25)",
          width: 2.5,
          dash: "dot",
        },
      },
    ];

    if (showDropLine) {
      traces.push({
        type: "scatter3d",
        mode: "lines",
        name: "Drop Line",
        x: [latest.xaueur, latest.xaueur],
        y: [latest.eurusd, latest.eurusd],
        z: [ctx.zVals[n - 1], ctx.zFloor],
        hoverinfo: "skip",
        line: {
          color: ctx.isReplaying
            ? "rgba(236, 72, 153, 0.8)"
            : "rgba(245, 158, 11, 0.7)",
          width: 3,
          dash: "dash",
        },
      });
    }

    return traces;
  },
};

export const ISO_CONTOURS_PLUGIN: IndicatorPlugin = {
  id: "iso-contours",
  name: "Iso-XAUUSD Floor Contours",
  shortName: "Iso-Contours",
  description:
    "Plots hyperbolic iso-price curves (EURUSD = XAUUSD / XAUEUR) on the Z=0 floor plane representing constant USD Gold levels.",
  category: "geometry",
  accentColor: "#f59e0b",
  defaultEnabled: true,
  defaultParams: {
    steps: 30,
  },
  paramSchema: [
    {
      key: "steps",
      label: "Curve Resolution",
      type: "number",
      min: 15,
      max: 80,
      step: 5,
    },
  ],
  buildTraces3D(ctx) {
    const n = ctx.activeSlice.length;
    if (n === 0) return [];
    const latest = ctx.activeSlice[n - 1];

    const xMin = Math.min(...ctx.xVals);
    const xMax = Math.max(...ctx.xVals);
    const xRange = xMax - xMin || 10;
    const xSpan: [number, number] = [
      xMin - xRange * 0.15,
      xMax + xRange * 0.15,
    ];

    const allGold = ctx.activeSlice.map((d) => d.xauusd).sort((a, b) => a - b);
    const gMin = allGold[0];
    const gMax = allGold[allGold.length - 1];
    const gMid = allGold[Math.floor(allGold.length / 2)];

    let goldLevels: number[] = [];
    if (gMax - gMin > 50) {
      goldLevels = [
        gMin,
        gMin + (gMax - gMin) * 0.33,
        gMid,
        gMin + (gMax - gMin) * 0.66,
        gMax,
      ];
    } else {
      goldLevels = [
        latest.xauusd * 0.995,
        latest.xauusd,
        latest.xauusd * 1.005,
      ];
    }

    const steps = Number(ctx.params.steps ?? 30);
    const triad = TRIAD_CONFIGS[ctx.triadPair ?? "EUR"] ?? TRIAD_CONFIGS.EUR;
    const traces: PlotlyTrace[] = [];

    goldLevels.forEach((goldVal, idx) => {
      const cxVals: number[] = [];
      const cyVals: number[] = [];
      for (let s = 0; s <= steps; s++) {
        const gx = xSpan[0] + (s / steps) * (xSpan[1] - xSpan[0]);
        const gy =
          triad.quoteMode === "CCY_USD" ? goldVal / gx : gx / goldVal;
        cxVals.push(gx);
        cyVals.push(gy);
      }
      const isMid = idx === Math.floor(goldLevels.length / 2);
      traces.push({
        type: "scatter3d",
        mode: "lines",
        name: `Gold $${goldVal.toFixed(0)}`,
        x: cxVals,
        y: cyVals,
        z: cxVals.map(() => ctx.zFloor),
        hoverinfo: "name",
        line: {
          color: isMid
            ? "rgba(245, 158, 11, 0.55)"
            : "rgba(255, 255, 255, 0.18)",
          width: isMid ? 2.5 : 1.5,
          dash: isMid ? "solid" : "dot",
        },
      });
    });

    return traces;
  },
};

export const PHASE_GEOMETRY_PLUGIN: IndicatorPlugin = {
  id: "phase-geometry-3d",
  name: "3D Compression Coils & Chirality",
  shortName: "3D Coils",
  description:
    "Highlights high-curvature 3D compression coil nodes, top-down >90° hairpin pivots, and spiral chirality (Lévy area lead-lag).",
  category: "volatility",
  accentColor: "#22d3ee",
  defaultEnabled: false,
  defaultParams: {
    period: 20,
    coilThreshold: 45,
    entropyFilter: true,
    showChiralitySpindle: true,
    showHairpinVertices: true,
  },
  paramSchema: [
    {
      key: "period",
      label: "Lookback Period",
      type: "number",
      min: 5,
      max: 200,
      step: 1,
      presets: [14, 20, 50],
    },
    {
      key: "coilThreshold",
      label: "Coil Score Min",
      type: "number",
      min: 15,
      max: 85,
      step: 5,
      presets: [35, 45, 60],
    },
    {
      key: "entropyFilter",
      label: "Entropy S/N Filter",
      type: "boolean",
    },
    {
      key: "showChiralitySpindle",
      label: "Chirality Spindle",
      type: "boolean",
    },
    {
      key: "showHairpinVertices",
      label: ">90° Hairpin Pivots",
      type: "boolean",
    },
  ],
  buildTraces3D(ctx) {
    const n = ctx.activeSlice.length;
    if (n === 0) return [];
    const period = Number(ctx.params.period ?? 20);
    const coilThreshold = Number(ctx.params.coilThreshold ?? 45);
    const entropyFilter = Boolean(ctx.params.entropyFilter ?? true);
    const showSpindle = Boolean(ctx.params.showChiralitySpindle ?? true);
    const showHairpins = Boolean(ctx.params.showHairpinVertices ?? true);

    const geo = computePhaseGeometry3D(ctx.fullSeries, period, period);
    const ent = computePhaseEntropy(ctx.fullSeries, period, geo);
    const rawCoilSlice = geo.coilScore.subarray(ctx.startIdx, ctx.effectiveEnd);
    const qualCoilSlice = ent.entropyQualityCoilScore.subarray(
      ctx.startIdx,
      ctx.effectiveEnd
    );
    const disSlice = ent.compositeEntropyPct.subarray(
      ctx.startIdx,
      ctx.effectiveEnd
    );
    const coilSlice = entropyFilter ? qualCoilSlice : rawCoilSlice;
    const levySlice = geo.levyArea.subarray(ctx.startIdx, ctx.effectiveEnd);
    const angleSlice = geo.turningAngleDeg.subarray(
      ctx.startIdx,
      ctx.effectiveEnd
    );
    const hairpinPctSlice = geo.hairpinRatioPct.subarray(
      ctx.startIdx,
      ctx.effectiveEnd
    );
    const velSlice = geo.velocity.subarray(ctx.startIdx, ctx.effectiveEnd);

    const coilX: number[] = [];
    const coilY: number[] = [];
    const coilZ: number[] = [];
    const coilHover: string[] = [];

    const hpX: number[] = [];
    const hpY: number[] = [];
    const hpZ: number[] = [];
    const hpHover: string[] = [];

    let peakIdx = 0;
    let peakScore = -1;

    for (let i = 0; i < n; i++) {
      const score = coilSlice[i];
      const ang = angleSlice[i];
      if (score > peakScore) {
        peakScore = score;
        peakIdx = i;
      }
      if (score >= coilThreshold) {
        coilX.push(ctx.xVals[i]);
        coilY.push(ctx.yVals[i]);
        coilZ.push(ctx.zVals[i]);
        coilHover.push(
          `<b>3D Compression Coil${
            entropyFilter ? " (Entropy-Verified)" : ""
          }</b><br>Score: ${score.toFixed(1)}/100 (Raw: ${rawCoilSlice[
            i
          ].toFixed(0)} | Disorder: ${disSlice[i].toFixed(
            0
          )}%)<br>Top-Down Turn Δθ: ${ang.toFixed(1)}° (${
            ang >= 90 ? ">90° Hairpin" : "<90° Forward"
          })<br>Lévy Area: ${levySlice[i].toFixed(2)}`
        );
      }
      if (showHairpins && ang >= 90.0 && velSlice[i] >= 0.12) {
        hpX.push(ctx.xVals[i]);
        hpY.push(ctx.yVals[i]);
        hpZ.push(ctx.zVals[i]);
        hpHover.push(
          `<b>Top-Down >90° Hairpin Pivot</b><br>Deflection Angle Δθ: ${ang.toFixed(
            1
          )}° (Obtuse Reversal)<br>Hairpin Ratio (${period}b): ${hairpinPctSlice[
            i
          ].toFixed(0)}%`
        );
      }
    }

    if (coilX.length === 0 && n > 0) {
      coilX.push(ctx.xVals[peakIdx]);
      coilY.push(ctx.yVals[peakIdx]);
      coilZ.push(ctx.zVals[peakIdx]);
      coilHover.push(
        `<b>Peak Coil Node</b><br>Score: ${coilSlice[peakIdx].toFixed(
          1
        )}/100<br>Top-Down Turn Δθ: ${angleSlice[peakIdx].toFixed(1)}°`
      );
    }

    const traces: PlotlyTrace[] = [
      {
        type: "scatter3d",
        mode: "markers",
        name: "3D Compression Coils",
        x: coilX,
        y: coilY,
        z: coilZ,
        text: coilHover,
        hoverinfo: "text",
        marker: {
          size: 6.5,
          color: "#22d3ee",
          symbol: "circle-open",
          line: {
            color: "#22d3ee",
            width: 2.5,
          },
        },
      },
    ];

    if (showHairpins && hpX.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        name: "Top-Down >90° Hairpin Pivots",
        x: hpX,
        y: hpY,
        z: hpZ,
        text: hpHover,
        hoverinfo: "text",
        marker: {
          size: 4.5,
          color: "#fb7185",
          symbol: "diamond",
        },
      });
    }

    if (showSpindle) {
      const { xMA, yMA } = computeVectorMA(ctx.fullSeries, period, "SMA");
      const lastGlobalIdx = ctx.effectiveEnd - 1;
      const lastLevy = geo.levyArea[lastGlobalIdx] ?? 0;
      const latest = ctx.activeSlice[n - 1];
      const zHead = ctx.zVals[n - 1];

      traces.push({
        type: "scatter3d",
        mode: "lines",
        name:
          lastLevy >= 0
            ? "Chirality Spindle (CCW: Gold Leads)"
            : "Chirality Spindle (CW: FX Leads)",
        x: [xMA[lastGlobalIdx], latest.xaueur],
        y: [yMA[lastGlobalIdx], latest.eurusd],
        z: [zHead, zHead],
        hoverinfo: "name",
        line: {
          color: lastLevy >= 0 ? "#34d399" : "#38bdf8",
          width: 4,
        },
      });
    }

    return traces;
  },
  getSummaryReadout(ctx) {
    if (ctx.activeSlice.length === 0) return null;
    const period = Number(ctx.params.period ?? 20);
    const geo = computePhaseGeometry3D(ctx.fullSeries, period, period);
    const idx = ctx.effectiveEnd - 1;
    const levy = geo.levyArea[idx] ?? 0;
    const coil = geo.coilScore[idx] ?? 0;
    return {
      label: "Coil / Chirality",
      value: `${coil.toFixed(0)}/100`,
      secondaryLabel: "Lévy Area",
      secondaryValue: `${levy >= 0 ? "+" : ""}${levy.toFixed(2)} (${
        levy >= 0 ? "CCW" : "CW"
      })`,
      color: "#22d3ee",
    };
  },
};

export const CLUSTER_ATTRACTORS_PLUGIN: IndicatorPlugin = {
  id: "cluster-attractors-3d",
  name: "3D Cluster Attractor Basins",
  shortName: "3D Clusters",
  description:
    "Partitions the 3D trajectory into K equilibrium consolidation basins with covariance-tilted ellipsoid rings and dwell %.",
  category: "geometry",
  accentColor: "#f472b6",
  defaultEnabled: false,
  defaultParams: {
    kBasins: 3,
    stdRadius: 1.5,
    showFloorBasins: true,
  },
  paramSchema: [
    {
      key: "kBasins",
      label: "Cluster Basins (K)",
      type: "number",
      min: 2,
      max: 5,
      step: 1,
      presets: [2, 3, 4],
    },
    {
      key: "stdRadius",
      label: "Basin Radius (σ)",
      type: "number",
      min: 0.8,
      max: 3.0,
      step: 0.2,
      presets: [1.0, 1.5, 2.0],
    },
    {
      key: "showFloorBasins",
      label: "Z=0 Floor Projection",
      type: "boolean",
    },
  ],
  buildTraces3D(ctx) {
    const n = ctx.activeSlice.length;
    if (n === 0) return [];
    const kBasins = Number(ctx.params.kBasins ?? 3);
    const stdRadius = Number(ctx.params.stdRadius ?? 1.5);
    const showFloorBasins = Boolean(ctx.params.showFloorBasins ?? true);
    const triad = TRIAD_CONFIGS[ctx.triadPair ?? "EUR"] ?? TRIAD_CONFIGS.EUR;

    const basins = computeSpatialAttractorBasins(
      ctx.activeSlice,
      kBasins,
      ctx.zVals
    );
    if (basins.length === 0) return [];

    const ringX: (number | null)[] = [];
    const ringY: (number | null)[] = [];
    const ringZ: (number | null)[] = [];

    const floorX: (number | null)[] = [];
    const floorY: (number | null)[] = [];
    const floorZ: (number | null)[] = [];

    const centX: number[] = [];
    const centY: number[] = [];
    const centZ: number[] = [];
    const centLabels: string[] = [];
    const centHover: string[] = [];

    const segments = 24;

    for (const b of basins) {
      centX.push(b.centerX);
      centY.push(b.centerY);
      centZ.push(b.centerZ);
      centLabels.push(`B${b.id} (${b.dwellPct.toFixed(0)}%)`);
      centHover.push(
        `<b>Attractor Basin #${b.id}${
          b.isCurrentBasin ? " (ACTIVE)" : ""
        }</b><br>` +
          `Center ${triad.xTicker}: ${triad.currencySymbol}${b.centerX.toFixed(
            triad.xDecimals
          )}<br>` +
          `Center ${triad.yTicker}: ${b.centerY.toFixed(triad.yDecimals)}<br>` +
          `Dwell Share: ${b.dwellPct.toFixed(1)}% (${b.dwellCount} bars)<br>` +
          `Head Dist: ${b.latestSigmaDist.toFixed(2)}σ`
      );

      const rho = b.corrXY;
      const orth = Math.sqrt(Math.max(0.05, 1 - rho * rho));
      const rx = stdRadius * b.stdX;
      const ry = stdRadius * b.stdY;

      for (let s = 0; s <= segments; s++) {
        const theta = (2 * Math.PI * s) / segments;
        const cTheta = Math.cos(theta);
        const sTheta = Math.sin(theta);
        // Exact bivariate Gaussian covariance contour via Cholesky factor
        const px = b.centerX + rx * cTheta;
        const py = b.centerY + ry * (rho * cTheta + orth * sTheta);

        ringX.push(px);
        ringY.push(py);
        ringZ.push(b.centerZ);

        if (showFloorBasins) {
          floorX.push(px);
          floorY.push(py);
          floorZ.push(ctx.zFloor);
        }
      }

      ringX.push(null);
      ringY.push(null);
      ringZ.push(null);

      if (showFloorBasins) {
        floorX.push(null);
        floorY.push(null);
        floorZ.push(null);
      }
    }

    const traces: PlotlyTrace[] = [
      {
        type: "scatter3d",
        mode: "lines",
        name: `3D Attractor Basins (${stdRadius}σ)`,
        x: ringX,
        y: ringY,
        z: ringZ,
        hoverinfo: "skip",
        line: {
          color: "rgba(244, 114, 182, 0.65)",
          width: 3,
        },
      },
      {
        type: "scatter3d",
        mode: "markers+text",
        name: "Attractor Centroids",
        x: centX,
        y: centY,
        z: centZ,
        text: centLabels,
        textposition: "top center",
        textfont: {
          color: "#f472b6",
          size: 10,
        },
        hovertext: centHover,
        hoverinfo: "text",
        marker: {
          size: 6,
          color: "#f472b6",
          symbol: "diamond",
        },
      },
    ];

    if (showFloorBasins) {
      traces.push({
        type: "scatter3d",
        mode: "lines",
        name: "Floor Attractor Basins",
        x: floorX,
        y: floorY,
        z: floorZ,
        hoverinfo: "skip",
        line: {
          color: "rgba(244, 114, 182, 0.28)",
          width: 2,
          dash: "dot",
        },
      });
    }

    return traces;
  },
};

export const STRATEGY_SIGNALS_PLUGIN: IndicatorPlugin = {
  id: "strategy-signals-3d",
  name: "Whitepaper 5-Setup BUY / SELL Signals",
  shortName: "Strategy Signals",
  description:
    "Executes the causal Whitepaper 5-Setup Playbook (Coiled Breakout, Fake FX Filter/Fade, Curvature Hook, Vacuum Transit, Orbital Lead-Lag) to plot BUY / SELL signals in 3D space.",
  category: "trend",
  accentColor: "#10b981",
  defaultEnabled: true,
  defaultParams: {
    period: 20,
    coilThreshold: 42,
    curvatureHookThreshold: 0.34,
    minConfidence: 52,
    showFloorSignals: true,
    showFilteredFakeouts: true,
  },
  paramSchema: [
    {
      key: "period",
      label: "Lookback Period",
      type: "number",
      min: 5,
      max: 200,
      step: 1,
      presets: [14, 20, 50],
    },
    {
      key: "coilThreshold",
      label: "Coil Score Min",
      type: "number",
      min: 15,
      max: 85,
      step: 5,
      presets: [35, 42, 55],
    },
    {
      key: "curvatureHookThreshold",
      label: "Curvature Hook (κ)",
      type: "number",
      min: 0.16,
      max: 0.65,
      step: 0.02,
      presets: [0.28, 0.34, 0.42],
    },
    {
      key: "minConfidence",
      label: "Min Conviction (%)",
      type: "number",
      min: 35,
      max: 85,
      step: 5,
      presets: [45, 52, 65],
    },
    {
      key: "showFloorSignals",
      label: "Z=0 Floor Projection",
      type: "boolean",
    },
    {
      key: "showFilteredFakeouts",
      label: "Blocked FX Fakeouts",
      type: "boolean",
    },
  ],
  buildTraces3D(ctx) {
    const n = ctx.activeSlice.length;
    if (n === 0) return [];

    const period = Number(ctx.params.period ?? 20);
    const coilThreshold = Number(ctx.params.coilThreshold ?? 42);
    const curvatureHookThreshold = Number(
      ctx.params.curvatureHookThreshold ?? 0.34
    );
    const minConfidence = Number(ctx.params.minConfidence ?? 52);
    const showFloorSignals = Boolean(ctx.params.showFloorSignals ?? true);
    const showFilteredFakeouts = Boolean(
      ctx.params.showFilteredFakeouts ?? true
    );
    const primaryPair: TriadPairId = ctx.triadPair ?? "EUR";
    const triad = TRIAD_CONFIGS[primaryPair] ?? TRIAD_CONFIGS.EUR;

    const strat = computeWhitepaperStrategy(ctx.fullSeries, {
      pair: primaryPair,
      period,
      coilThreshold,
      curvatureHookThreshold,
      minConfidence,
    });

    const buyX: number[] = [];
    const buyY: number[] = [];
    const buyZ: number[] = [];
    const buyLabels: string[] = [];
    const buyHover: string[] = [];

    const sellX: number[] = [];
    const sellY: number[] = [];
    const sellZ: number[] = [];
    const sellLabels: string[] = [];
    const sellHover: string[] = [];

    const filtX: number[] = [];
    const filtY: number[] = [];
    const filtZ: number[] = [];
    const filtHover: string[] = [];

    const stemX: (number | null)[] = [];
    const stemY: (number | null)[] = [];
    const stemZ: (number | null)[] = [];

    for (const evt of strat.events) {
      if (evt.barIndex < ctx.startIdx || evt.barIndex >= ctx.effectiveEnd) {
        continue;
      }
      const localIdx = evt.barIndex - ctx.startIdx;
      if (localIdx < 0 || localIdx >= n) continue;

      const px = ctx.xVals[localIdx];
      const py = ctx.yVals[localIdx];
      const pz = ctx.zVals[localIdx];

      if (evt.action === "BUY") {
        buyX.push(px);
        buyY.push(py);
        buyZ.push(pz);
        buyLabels.push(`▲ BUY S${evt.setupId}`);
        buyHover.push(
          `<b>▲ BUY SIGNAL — Setup #${evt.setupId}: ${evt.setupName}</b><br>` +
            `Time: ${evt.datetime}<br>` +
            `Entry XAUUSD: $${evt.priceXauusd.toFixed(2)} | ${triad.xTicker}: ${
              triad.currencySymbol
            }${evt.priceCross.toFixed(triad.xDecimals)}<br>` +
            `Stop-Loss: $${evt.stopLossXauusd.toFixed(
              2
            )} | Target: $${evt.takeProfitXauusd.toFixed(2)}<br>` +
            `Conviction: ${evt.confidence}% | Iso-Cut Efficiency: ${(
              evt.isoCutEfficiency * 100
            ).toFixed(0)}%<br>` +
            `<i>${evt.rationale}</i>`
        );
        if (showFloorSignals) {
          stemX.push(px, px, null);
          stemY.push(py, py, null);
          stemZ.push(pz, ctx.zFloor, null);
        }
      } else if (evt.action === "SELL") {
        sellX.push(px);
        sellY.push(py);
        sellZ.push(pz);
        sellLabels.push(`▼ SELL S${evt.setupId}`);
        sellHover.push(
          `<b>▼ SELL SIGNAL — Setup #${evt.setupId}: ${evt.setupName}</b><br>` +
            `Time: ${evt.datetime}<br>` +
            `Entry XAUUSD: $${evt.priceXauusd.toFixed(2)} | ${triad.xTicker}: ${
              triad.currencySymbol
            }${evt.priceCross.toFixed(triad.xDecimals)}<br>` +
            `Stop-Loss: $${evt.stopLossXauusd.toFixed(
              2
            )} | Target: $${evt.takeProfitXauusd.toFixed(2)}<br>` +
            `Conviction: ${evt.confidence}% | Iso-Cut Efficiency: ${(
              evt.isoCutEfficiency * 100
            ).toFixed(0)}%<br>` +
            `<i>${evt.rationale}</i>`
        );
        if (showFloorSignals) {
          stemX.push(px, px, null);
          stemY.push(py, py, null);
          stemZ.push(pz, ctx.zFloor, null);
        }
      } else if (evt.action === "FILTERED" && showFilteredFakeouts) {
        filtX.push(px);
        filtY.push(py);
        filtZ.push(pz);
        filtHover.push(
          `<b>✕ BLOCKED FX FAKEOUT (Setup 2 Filter)</b><br>` +
            `Time: ${evt.datetime} | XAUUSD: $${evt.priceXauusd.toFixed(2)}<br>` +
            `<i>${evt.rationale}</i>`
        );
      }
    }

    const traces: PlotlyTrace[] = [];

    if (buyX.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "markers+text",
        name: "Strategy BUY Signals",
        x: buyX,
        y: buyY,
        z: buyZ,
        text: buyLabels,
        textposition: "top center",
        textfont: {
          color: "#10b981",
          size: 10,
        },
        hovertext: buyHover,
        hoverinfo: "text",
        marker: {
          size: 8.5,
          color: "#10b981",
          symbol: "diamond",
          line: {
            color: "#ffffff",
            width: 2,
          },
        },
      });
    }

    if (sellX.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "markers+text",
        name: "Strategy SELL Signals",
        x: sellX,
        y: sellY,
        z: sellZ,
        text: sellLabels,
        textposition: "bottom center",
        textfont: {
          color: "#f43f5e",
          size: 10,
        },
        hovertext: sellHover,
        hoverinfo: "text",
        marker: {
          size: 8.5,
          color: "#f43f5e",
          symbol: "diamond",
          line: {
            color: "#ffffff",
            width: 2,
          },
        },
      });
    }

    if (showFilteredFakeouts && filtX.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        name: "Setup 2 Blocked Fakeouts",
        x: filtX,
        y: filtY,
        z: filtZ,
        hovertext: filtHover,
        hoverinfo: "text",
        marker: {
          size: 4.5,
          color: "#38bdf8",
          symbol: "cross",
        },
      });
    }

    if (showFloorSignals && stemX.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "lines",
        name: "Signal Floor Stems",
        x: stemX,
        y: stemY,
        z: stemZ,
        hoverinfo: "skip",
        line: {
          color: "rgba(16, 185, 129, 0.35)",
          width: 2,
          dash: "dot",
        },
      });
    }

    // Ensure at least one trace is returned even if no signal fired in the current slice
    if (traces.length === 0) {
      const lastIdx = n - 1;
      traces.push({
        type: "scatter3d",
        mode: "markers",
        name: "Strategy Standby",
        x: [ctx.xVals[lastIdx]],
        y: [ctx.yVals[lastIdx]],
        z: [ctx.zVals[lastIdx]],
        hoverinfo: "skip",
        marker: {
          size: 1,
          color: "rgba(16, 185, 129, 0.01)",
        },
      });
    }

    return traces;
  },
  getSummaryReadout(ctx) {
    if (ctx.activeSlice.length === 0) return null;
    const period = Number(ctx.params.period ?? 20);
    const primaryPair: TriadPairId = ctx.triadPair ?? "EUR";
    const crossProxySeries = synthesizeCompanionProxySeries(
      ctx.fullSeries,
      primaryPair
    );
    const strat = computeWhitepaperStrategy(ctx.fullSeries, {
      pair: primaryPair,
      period,
      crossProxySeries,
    });
    const idx = ctx.effectiveEnd - 1;
    const pos = strat.position[idx] ?? 0;
    const setupId = (strat.activeSetupId[idx] || 1) as StrategySetupId;
    const posLabel =
      pos === 1
        ? `LONG (${STRATEGY_SETUP_META[setupId].shortName})`
        : pos === -1
        ? `SHORT (${STRATEGY_SETUP_META[setupId].shortName})`
        : "FLAT / SCANNING";

    return {
      label: "Strategy State",
      value: posLabel,
      secondaryLabel: "Win Rate / Net Return",
      secondaryValue: `${strat.summary.winRatePct.toFixed(0)}% (${
        strat.summary.totalReturnPct >= 0 ? "+" : ""
      }${strat.summary.totalReturnPct.toFixed(2)}%)`,
      color: pos === 1 ? "#10b981" : pos === -1 ? "#f43f5e" : "#94a3b8",
    };
  },
};

export const PHASE_ENTROPY_PLUGIN: IndicatorPlugin = {
  id: "phase-entropy-3d",
  name: "3D Phase-Space Entropy (S/N Filter)",
  shortName: "3D Entropy",
  description:
    "Highlights low-entropy ordered trajectory nodes, high-entropy white-noise chop zones, and entropy-filtered true compression coils using Turning (H_Δφ), Ordinal Permutation (d=3), and Markov Regime Entropy.",
  category: "volatility",
  accentColor: "#f59e0b",
  defaultEnabled: false,
  defaultParams: {
    period: 20,
    orderThreshold: 45,
    chopThreshold: 75,
    showChopZones: true,
    showTrueCoils: true,
    showFloorProjection: true,
  },
  paramSchema: [
    {
      key: "period",
      label: "Entropy Window",
      type: "number",
      min: 6,
      max: 200,
      step: 1,
      presets: [14, 20, 30, 50],
    },
    {
      key: "orderThreshold",
      label: "Ordered Max (%)",
      type: "number",
      min: 20,
      max: 60,
      step: 5,
      presets: [35, 45, 50],
    },
    {
      key: "chopThreshold",
      label: "Max Chop Min (%)",
      type: "number",
      min: 60,
      max: 95,
      step: 5,
      presets: [70, 75, 85],
    },
    {
      key: "showChopZones",
      label: "High-Entropy Chop Nodes",
      type: "boolean",
    },
    {
      key: "showTrueCoils",
      label: "Entropy-Verified Coils",
      type: "boolean",
    },
    {
      key: "showFloorProjection",
      label: "Z=0 Floor Projection",
      type: "boolean",
    },
  ],
  buildTraces3D(ctx) {
    const n = ctx.activeSlice.length;
    if (n === 0) return [];
    const period = Number(ctx.params.period ?? 20);
    const orderThreshold = Number(ctx.params.orderThreshold ?? 45);
    const chopThreshold = Number(ctx.params.chopThreshold ?? 75);
    const showChopZones = Boolean(ctx.params.showChopZones ?? true);
    const showTrueCoils = Boolean(ctx.params.showTrueCoils ?? true);
    const showFloorProjection = Boolean(ctx.params.showFloorProjection ?? true);

    const ent = computePhaseEntropy(ctx.fullSeries, period);
    const compSlice = ent.compositeEntropyPct.subarray(
      ctx.startIdx,
      ctx.effectiveEnd
    );
    const turnSlice = ent.turningEntropy.subarray(
      ctx.startIdx,
      ctx.effectiveEnd
    );
    const permSlice = ent.permutationEntropy.subarray(
      ctx.startIdx,
      ctx.effectiveEnd
    );
    const markovSlice = ent.markovRegimeEntropy.subarray(
      ctx.startIdx,
      ctx.effectiveEnd
    );
    const qualCoilSlice = ent.entropyQualityCoilScore.subarray(
      ctx.startIdx,
      ctx.effectiveEnd
    );

    const ordX: number[] = [];
    const ordY: number[] = [];
    const ordZ: number[] = [];
    const ordHover: string[] = [];

    const chopX: number[] = [];
    const chopY: number[] = [];
    const chopZ: number[] = [];
    const chopHover: string[] = [];

    const tcX: number[] = [];
    const tcY: number[] = [];
    const tcZ: number[] = [];
    const tcHover: string[] = [];

    let minIdx = 0;
    let minEnt = Infinity;

    for (let i = 0; i < n; i++) {
      const cPct = compSlice[i];
      if (cPct < minEnt) {
        minEnt = cPct;
        minIdx = i;
      }

      if (cPct <= orderThreshold) {
        ordX.push(ctx.xVals[i]);
        ordY.push(ctx.yVals[i]);
        ordZ.push(ctx.zVals[i]);
        ordHover.push(
          `<b>Ordered Low-Entropy Flow</b><br>Disorder: ${cPct.toFixed(
            1
          )}%<br>Turning H_Δφ: ${turnSlice[i].toFixed(
            2
          )} | Perm H_3: ${permSlice[i].toFixed(
            2
          )}<br>Markov H: ${markovSlice[i].toFixed(2)}`
        );
      } else if (showChopZones && cPct >= chopThreshold) {
        chopX.push(ctx.xVals[i]);
        chopY.push(ctx.yVals[i]);
        chopZ.push(ctx.zVals[i]);
        chopHover.push(
          `<b>High-Entropy Noise / Chop Zone</b><br>Disorder: ${cPct.toFixed(
            1
          )}% (No-Trade Filter)<br>Turning H_Δφ: ${turnSlice[i].toFixed(
            2
          )} | Perm H_3: ${permSlice[i].toFixed(2)}`
        );
      }

      if (showTrueCoils && qualCoilSlice[i] >= 42) {
        tcX.push(ctx.xVals[i]);
        tcY.push(ctx.yVals[i]);
        tcZ.push(ctx.zVals[i]);
        tcHover.push(
          `<b>Entropy-Verified True Coil</b><br>Quality Coil Score: ${qualCoilSlice[
            i
          ].toFixed(1)}/100<br>Disorder: ${cPct.toFixed(1)}%`
        );
      }
    }

    if (ordX.length === 0 && n > 0) {
      ordX.push(ctx.xVals[minIdx]);
      ordY.push(ctx.yVals[minIdx]);
      ordZ.push(ctx.zVals[minIdx]);
      ordHover.push(
        `<b>Lowest Entropy Node</b><br>Disorder: ${compSlice[minIdx].toFixed(
          1
        )}%`
      );
    }

    const traces: PlotlyTrace[] = [
      {
        type: "scatter3d",
        mode: "markers",
        name: "Low-Entropy Ordered Flow",
        x: ordX,
        y: ordY,
        z: ordZ,
        text: ordHover,
        hoverinfo: "text",
        marker: {
          size: 5,
          color: "#10b981",
          symbol: "circle",
        },
      },
    ];

    if (showChopZones && chopX.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        name: "High-Entropy Chop (No-Trade)",
        x: chopX,
        y: chopY,
        z: chopZ,
        text: chopHover,
        hoverinfo: "text",
        marker: {
          size: 4.5,
          color: "#f43f5e",
          symbol: "cross",
        },
      });
    }

    if (showTrueCoils && tcX.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        name: "Entropy-Verified True Coils",
        x: tcX,
        y: tcY,
        z: tcZ,
        text: tcHover,
        hoverinfo: "text",
        marker: {
          size: 7,
          color: "#f59e0b",
          symbol: "circle-open",
          line: {
            color: "#f59e0b",
            width: 2.5,
          },
        },
      });
    }

    if (showFloorProjection && ordX.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        name: "Floor Ordered Flow",
        x: ordX,
        y: ordY,
        z: ordX.map(() => ctx.zFloor),
        hoverinfo: "skip",
        marker: {
          size: 3,
          color: "rgba(16, 185, 129, 0.35)",
          symbol: "circle",
        },
      });
    }

    return traces;
  },
  getSummaryReadout(ctx) {
    if (ctx.activeSlice.length === 0) return null;
    const period = Number(ctx.params.period ?? 20);
    const ent = computePhaseEntropy(ctx.fullSeries, period);
    const idx = ctx.effectiveEnd - 1;
    const comp = ent.compositeEntropyPct[idx] ?? 50;
    const turn = ent.turningEntropy[idx] ?? 0.5;
    const perm = ent.permutationEntropy[idx] ?? 0.5;
    const state =
      comp < 45 ? "ORDERED" : comp >= 75 ? "MAX CHOP" : "TRANSITIONAL";
    return {
      label: "Phase Disorder (S/N)",
      value: `${comp.toFixed(0)}% (${state})`,
      secondaryLabel: "Turn H_Δφ / Perm H_3",
      secondaryValue: `${turn.toFixed(2)} / ${perm.toFixed(2)}`,
      color: comp < 45 ? "#10b981" : comp >= 75 ? "#f43f5e" : "#f59e0b",
    };
  },
};

export const CROSS_PROXY_BOUNCE_PLUGIN: IndicatorPlugin = {
  id: "cross-proxy-bounce-3d",
  name: "3D Cross-Proxy Bounce Zones",
  shortName: "Bounce Zones",
  description:
    "Projects ranked multi-proxy implied XAUUSD support, resistance, and 3D spine equilibrium bounce contours across the active 3D phase plane and Z=0 floor.",
  category: "geometry",
  accentColor: "#14b8a6",
  defaultEnabled: true,
  defaultParams: {
    period: 20,
    maxZones: 4,
    steps: 24,
    multiProxyMode: false,
    showFloorProjection: true,
  },
  paramSchema: [
    {
      key: "period",
      label: "Lookback Window",
      type: "number",
      min: 5,
      max: 200,
      step: 1,
      presets: [10, 20, 50, 100],
    },
    {
      key: "maxZones",
      label: "Max Bounce Zones",
      type: "number",
      min: 1,
      max: 6,
      step: 1,
    },
    {
      key: "steps",
      label: "Curve Resolution",
      type: "number",
      min: 12,
      max: 60,
      step: 4,
    },
    {
      key: "multiProxyMode",
      label: "6-Triad G10 Confluence",
      type: "boolean",
    },
    {
      key: "showFloorProjection",
      label: "Floor Shadow",
      type: "boolean",
    },
  ],
  buildTraces3D(ctx) {
    const n = ctx.activeSlice.length;
    if (n === 0) return [];
    const primaryPair: TriadPairId = ctx.triadPair ?? "EUR";
    const triad = TRIAD_CONFIGS[primaryPair] ?? TRIAD_CONFIGS.EUR;
    const period = Math.max(5, Number(ctx.params.period ?? 20));
    const maxZones = Math.max(
      1,
      Math.min(6, Math.floor(Number(ctx.params.maxZones ?? 4)))
    );
    const steps = Math.max(
      10,
      Math.min(60, Math.floor(Number(ctx.params.steps ?? 24)))
    );
    const multiProxyMode = Boolean(ctx.params.multiProxyMode ?? true);
    const showFloorProjection = Boolean(ctx.params.showFloorProjection ?? true);

    const crossProxySeries = multiProxyMode
      ? synthesizeCompanionProxySeries(ctx.fullSeries, primaryPair)
      : undefined;
    const cp = computeCrossProxyConfluence(ctx.fullSeries, {
      primaryPair,
      period,
      crossProxySeries,
      effectiveEnd: ctx.effectiveEnd,
    });

    const topZones = cp.latestBounceZones.slice(0, maxZones);
    if (topZones.length === 0) return [];

    let xMin = Infinity;
    let xMax = -Infinity;
    for (let i = 0; i < ctx.xVals.length; i++) {
      const v = ctx.xVals[i];
      if (v < xMin) xMin = v;
      if (v > xMax) xMax = v;
    }
    const xRange = xMax - xMin || 10;
    const xSpan: [number, number] = [
      Math.max(1e-4, xMin - xRange * 0.12),
      xMax + xRange * 0.12,
    ];

    const latest = ctx.activeSlice[n - 1];
    const zHead = ctx.zVals[n - 1] ?? 0;
    const traces: PlotlyTrace[] = [];

    const anchorX: number[] = [];
    const anchorY: number[] = [];
    const anchorZ: number[] = [];
    const anchorLabels: string[] = [];
    const anchorHover: string[] = [];
    const anchorColors: string[] = [];

    for (let zIdx = 0; zIdx < topZones.length; zIdx++) {
      const zone = topZones[zIdx];
      const goldVal = Math.max(1e-4, zone.centerPriceXauusd);
      const isSup = zone.role === "SUPPORT";
      const isRes = zone.role === "RESISTANCE";
      const roleTag = isSup ? "SUP" : isRes ? "RES" : "EQ";
      const lineColor = isSup
        ? "rgba(16, 185, 129, 0.88)"
        : isRes
        ? "rgba(244, 63, 94, 0.88)"
        : "rgba(56, 189, 248, 0.88)";
      const floorColor = isSup
        ? "rgba(16, 185, 129, 0.34)"
        : isRes
        ? "rgba(244, 63, 94, 0.34)"
        : "rgba(56, 189, 248, 0.34)";
      const markerColor = isSup ? "#10b981" : isRes ? "#f43f5e" : "#38bdf8";

      const cxVals: number[] = new Array(steps + 1);
      const cyVals: number[] = new Array(steps + 1);
      const czHeadVals: number[] = new Array(steps + 1);
      const czFloorVals: number[] = new Array(steps + 1);

      for (let s = 0; s <= steps; s++) {
        const gx = xSpan[0] + (s / steps) * (xSpan[1] - xSpan[0]);
        const gy =
          triad.quoteMode === "CCY_USD"
            ? goldVal / Math.max(1e-6, gx)
            : gx / Math.max(1e-6, goldVal);
        cxVals[s] = gx;
        cyVals[s] = gy;
        czHeadVals[s] = zHead;
        czFloorVals[s] = ctx.zFloor;
      }

      const hoverSummary =
        `<b>[CROSS-PROXY ${zone.role} BOUNCE ZONE]</b><br>` +
        `Implied XAUUSD: <b>$${goldVal.toFixed(2)}</b> ` +
        `($${zone.bandLowXauusd.toFixed(1)} – $${zone.bandHighXauusd.toFixed(1)})<br>` +
        `Distance: ${zone.distanceUsd >= 0 ? "+" : ""}$${zone.distanceUsd.toFixed(2)} ` +
        `(${zone.distanceSigma >= 0 ? "+" : ""}${zone.distanceSigma.toFixed(2)}σ)<br>` +
        `Confluence Score: <b>${zone.confluenceScore}/99</b> · ` +
        `Bounce Prob: <b>${zone.bounceProbabilityPct}%</b><br>` +
        `Mechanisms (${zone.contributingCount}): ${zone.contributors.join(" · ")}`;

      traces.push({
        type: "scatter3d",
        mode: "lines",
        name: `${roleTag} Bounce $${goldVal.toFixed(1)} (${zone.bounceProbabilityPct}%)`,
        x: cxVals,
        y: cyVals,
        z: czHeadVals,
        text: cxVals.map(() => hoverSummary),
        hoverinfo: "text",
        line: {
          color: lineColor,
          width: zIdx === 0 ? 4.2 : 3.0,
          dash: zone.role === "EQUILIBRIUM" ? "dash" : "solid",
        },
      });

      if (showFloorProjection) {
        traces.push({
          type: "scatter3d",
          mode: "lines",
          name: `Floor ${roleTag} $${goldVal.toFixed(0)}`,
          x: cxVals,
          y: cyVals,
          z: czFloorVals,
          hoverinfo: "skip",
          line: {
            color: floorColor,
            width: 1.8,
            dash: "dot",
          },
        });
      }

      const anchorGy =
        triad.quoteMode === "CCY_USD"
          ? goldVal / Math.max(1e-6, latest.xaueur)
          : latest.xaueur / Math.max(1e-6, goldVal);
      anchorX.push(latest.xaueur);
      anchorY.push(anchorGy);
      anchorZ.push(zHead);
      anchorLabels.push(
        `${roleTag} $${goldVal.toFixed(0)} (${zone.bounceProbabilityPct}%)`
      );
      anchorHover.push(hoverSummary);
      anchorColors.push(markerColor);
    }

    if (anchorX.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "markers+text",
        name: "Implied XAUUSD Bounce Anchors",
        x: anchorX,
        y: anchorY,
        z: anchorZ,
        text: anchorLabels,
        hovertext: anchorHover,
        hoverinfo: "text",
        textposition: "top center",
        textfont: {
          size: 9,
          color: "#e2e8f0",
        },
        marker: {
          size: 5.5,
          color: anchorColors,
          symbol: "diamond",
          line: {
            color: "#0f172a",
            width: 1.2,
          },
        },
      });
    }

    return traces;
  },
  getSummaryReadout(ctx) {
    if (ctx.activeSlice.length === 0) return null;
    const primaryPair: TriadPairId = ctx.triadPair ?? "EUR";
    const period = Math.max(5, Number(ctx.params.period ?? 20));
    const crossProxySeries = synthesizeCompanionProxySeries(
      ctx.fullSeries,
      primaryPair
    );
    const cp = computeCrossProxyConfluence(ctx.fullSeries, {
      primaryPair,
      period,
      crossProxySeries,
      effectiveEnd: ctx.effectiveEnd,
    });
    const idx = Math.max(0, ctx.effectiveEnd - 1);
    const breadth = cp.bullionBreadth[idx] ?? 0;
    const sup = cp.nearestSupportXauusd[idx] ?? 0;
    const res = cp.nearestResistanceXauusd[idx] ?? 0;
    const supScore = Math.round(cp.supportConfluenceScore[idx] ?? 0);
    const resScore = Math.round(cp.resistanceConfluenceScore[idx] ?? 0);
    const dirTag =
      breadth > 0.15 ? "BULL" : breadth < -0.15 ? "BEAR" : "NEUT";
    return {
      label: `Cross-Proxy Breadth (${cp.proxyCount}G10)`,
      value: `${breadth >= 0 ? "+" : ""}${(breadth * 100).toFixed(0)}% (${dirTag})`,
      secondaryLabel: "Sup / Res Bounce Zones",
      secondaryValue: `$${sup.toFixed(1)} (${supScore}) / $${res.toFixed(1)} (${resScore})`,
      color:
        breadth > 0.15 ? "#10b981" : breadth < -0.15 ? "#f43f5e" : "#14b8a6",
    };
  },
};

export const BUILTIN_INDICATOR_PLUGINS: IndicatorPlugin[] = [
  STRATEGY_SIGNALS_PLUGIN,
  CROSS_PROXY_BOUNCE_PLUGIN,
  VECTOR_MA_PLUGIN,
  SLOW_MA_PLUGIN,
  BOLLINGER_3D_PLUGIN,
  PHASE_GEOMETRY_PLUGIN,
  PHASE_ENTROPY_PLUGIN,
  CLUSTER_ATTRACTORS_PLUGIN,
  ISO_CONTOURS_PLUGIN,
  FLOOR_SHADOW_PLUGIN,
];

export const INDICATOR_REGISTRY: Record<string, IndicatorPlugin> =
  Object.fromEntries(BUILTIN_INDICATOR_PLUGINS.map((p) => [p.id, p]));

export function createDefaultIndicatorConfigs(): Record<
  string,
  IndicatorInstanceConfig
> {
  const out: Record<string, IndicatorInstanceConfig> = {};
  for (const plugin of BUILTIN_INDICATOR_PLUGINS) {
    out[plugin.id] = {
      id: plugin.id,
      enabled: plugin.defaultEnabled,
      params: { ...plugin.defaultParams },
    };
  }
  return out;
}
