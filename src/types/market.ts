export type TimeframeId = "1m" | "5m" | "15m" | "1h" | "1d";

export interface TimeframeMeta {
  id: TimeframeId;
  interval: string;
  range: string;
  ttl: number;
  label: string;
  intervalSec: number;
}

export interface MarketBar {
  timestamp: number;
  datetime: string;
  xauusd: number;
  eurusd: number;
  xaueur: number;
  marketXaueur?: number;
  usdeur: number;
  source: "yahoo" | "simulated";
}

export type DataFeedMode = "yahoo" | "sim";
export type CameraPreset = "orbit" | "top" | "side" | "front";
export type ReplayTraceMode = "accumulate" | "window";
export type SubPaneMode = "displacement" | "correlation" | "basis" | "hidden";

export type ParamInputType = "number" | "select" | "boolean" | "color";

export interface IndicatorParamField {
  key: string;
  label: string;
  type: ParamInputType;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
  presets?: number[];
}

export interface IndicatorInstanceConfig {
  id: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
}

export interface AxisStretchState {
  x: number;
  y: number;
  z: number;
}

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  userId?: string;
  updatedAt: number;
  timeframe: TimeframeId;
  trailLength: number;
  stretch: AxisStretchState;
  cameraPreset: CameraPreset;
  subPaneMode: SubPaneMode;
  replaySpeed: number;
  replayTraceMode: ReplayTraceMode;
  indicators: Record<string, IndicatorInstanceConfig>;
}
