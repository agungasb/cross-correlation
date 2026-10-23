import {
  IndicatorInstanceConfig,
  IndicatorParamField,
  MarketBar,
  TimeframeId,
} from "@/types/market";
import { computeVectorBollinger3D, computeVectorMA } from "./math";

export type PlotlyTrace = Record<string, unknown>;

export interface IndicatorRenderContext {
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
    const traces: PlotlyTrace[] = [];

    goldLevels.forEach((goldVal, idx) => {
      const cxVals: number[] = [];
      const cyVals: number[] = [];
      for (let s = 0; s <= steps; s++) {
        const gx = xSpan[0] + (s / steps) * (xSpan[1] - xSpan[0]);
        const gy = goldVal / gx;
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

export const BUILTIN_INDICATOR_PLUGINS: IndicatorPlugin[] = [
  VECTOR_MA_PLUGIN,
  SLOW_MA_PLUGIN,
  BOLLINGER_3D_PLUGIN,
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
