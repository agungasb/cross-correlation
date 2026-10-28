export type TimeframeId = "1m" | "5m" | "15m" | "1h" | "1d";

export type TriadPairId = "EUR" | "JPY" | "GBP" | "CHF" | "AUD" | "CAD";

export type QuoteConvention = "CCY_USD" | "USD_CCY";

export const PYTH_XAUUSD_SYMBOL = "Metal.XAU/USD";
export const PYTH_XAUUSD_FEED_ID =
  "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2";

export interface TriadConfig {
  id: TriadPairId;
  label: string;
  xTicker: string;
  yTicker: string;
  inverseTicker: string;
  yahooFxSymbol: string;
  yahooCrossGoldSymbol?: string;
  pythFxSymbol: string;
  pythFxFeedId: string;
  quoteMode: QuoteConvention;
  currencySymbol: string;
  fxUnitLabel: string;
  xDecimals: number;
  yDecimals: number;
  pipMultiplier: number;
  defaultFxRate: number;
  formulaPrimary: string;
  formulaInverse: string;
}

export const TRIAD_CONFIGS: Record<TriadPairId, TriadConfig> = {
  EUR: {
    id: "EUR",
    label: "XAUEUR / EURUSD",
    xTicker: "XAUEUR",
    yTicker: "EURUSD",
    inverseTicker: "USDEUR",
    yahooFxSymbol: "EURUSD=X",
    yahooCrossGoldSymbol: "XAUEUR=X",
    pythFxSymbol: "FX.EUR/USD",
    pythFxFeedId:
      "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
    quoteMode: "CCY_USD",
    currencySymbol: "€",
    fxUnitLabel: "$/€",
    xDecimals: 2,
    yDecimals: 4,
    pipMultiplier: 10000,
    defaultFxRate: 1.1212,
    formulaPrimary: "XAUUSD / XAUEUR = EURUSD",
    formulaInverse: "XAUEUR = XAUUSD / EURUSD",
  },
  JPY: {
    id: "JPY",
    label: "XAUJPY / USDJPY",
    xTicker: "XAUJPY",
    yTicker: "USDJPY",
    inverseTicker: "JPYUSD",
    yahooFxSymbol: "JPY=X",
    yahooCrossGoldSymbol: "XAUJPY=X",
    pythFxSymbol: "FX.USD/JPY",
    pythFxFeedId:
      "0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52",
    quoteMode: "USD_CCY",
    currencySymbol: "¥",
    fxUnitLabel: "¥/$",
    xDecimals: 0,
    yDecimals: 2,
    pipMultiplier: 100,
    defaultFxRate: 156.85,
    formulaPrimary: "XAUJPY / USDJPY = XAUUSD",
    formulaInverse: "XAUJPY = XAUUSD × USDJPY",
  },
  GBP: {
    id: "GBP",
    label: "XAUGBP / GBPUSD",
    xTicker: "XAUGBP",
    yTicker: "GBPUSD",
    inverseTicker: "USDGBP",
    yahooFxSymbol: "GBPUSD=X",
    yahooCrossGoldSymbol: "XAUGBP=X",
    pythFxSymbol: "FX.GBP/USD",
    pythFxFeedId:
      "0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1",
    quoteMode: "CCY_USD",
    currencySymbol: "£",
    fxUnitLabel: "$/£",
    xDecimals: 2,
    yDecimals: 4,
    pipMultiplier: 10000,
    defaultFxRate: 1.337,
    formulaPrimary: "XAUUSD / XAUGBP = GBPUSD",
    formulaInverse: "XAUGBP = XAUUSD / GBPUSD",
  },
  CHF: {
    id: "CHF",
    label: "XAUCHF / USDCHF",
    xTicker: "XAUCHF",
    yTicker: "USDCHF",
    inverseTicker: "CHFUSD",
    yahooFxSymbol: "CHF=X",
    yahooCrossGoldSymbol: "XAUCHF=X",
    pythFxSymbol: "FX.USD/CHF",
    pythFxFeedId:
      "0x0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e28f8",
    quoteMode: "USD_CCY",
    currencySymbol: "Fr",
    fxUnitLabel: "Fr/$",
    xDecimals: 2,
    yDecimals: 4,
    pipMultiplier: 10000,
    defaultFxRate: 0.8245,
    formulaPrimary: "XAUCHF / USDCHF = XAUUSD",
    formulaInverse: "XAUCHF = XAUUSD × USDCHF",
  },
  AUD: {
    id: "AUD",
    label: "XAUAUD / AUDUSD",
    xTicker: "XAUAUD",
    yTicker: "AUDUSD",
    inverseTicker: "USDAUD",
    yahooFxSymbol: "AUDUSD=X",
    yahooCrossGoldSymbol: "XAUAUD=X",
    pythFxSymbol: "FX.AUD/USD",
    pythFxFeedId:
      "0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80",
    quoteMode: "CCY_USD",
    currencySymbol: "A$",
    fxUnitLabel: "$/A$",
    xDecimals: 2,
    yDecimals: 4,
    pipMultiplier: 10000,
    defaultFxRate: 0.7032,
    formulaPrimary: "XAUUSD / XAUAUD = AUDUSD",
    formulaInverse: "XAUAUD = XAUUSD / AUDUSD",
  },
  CAD: {
    id: "CAD",
    label: "XAUCAD / USDCAD",
    xTicker: "XAUCAD",
    yTicker: "USDCAD",
    inverseTicker: "CADUSD",
    yahooFxSymbol: "CAD=X",
    yahooCrossGoldSymbol: "XAUCAD=X",
    pythFxSymbol: "FX.USD/CAD",
    pythFxFeedId:
      "0x3112b03a41c910ed4468528f67118cb1bec67b2cd0b9a214c58cc0eaa2ecca8f",
    quoteMode: "USD_CCY",
    currencySymbol: "C$",
    fxUnitLabel: "C$/$",
    xDecimals: 2,
    yDecimals: 4,
    pipMultiplier: 10000,
    defaultFxRate: 1.4018,
    formulaPrimary: "XAUCAD / USDCAD = XAUUSD",
    formulaInverse: "XAUCAD = XAUUSD × USDCAD",
  },
};

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
  eurusd: number; // Represents the active FX leg Y (e.g., EURUSD or USDJPY)
  xaueur: number; // Represents the active Gold Cross leg X (e.g., XAUEUR or XAUJPY)
  marketXaueur?: number;
  usdeur: number; // Inverse of Y (1 / Y)
  source: "yahoo" | "pyth" | "binance" | "simulated";
}

export type DataFeedMode = "yahoo" | "pyth" | "binance" | "sim";
export type CameraPreset = "orbit" | "top" | "side" | "front";
export type ReplayTraceMode = "accumulate" | "window";
export type SubPaneMode =
  | "displacement"
  | "geometry"
  | "clusters"
  | "correlation"
  | "basis"
  | "hidden";

export type PhaseRegimeId = 0 | 1 | 2 | 3;

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
  triadPair?: TriadPairId;
  timeframe: TimeframeId;
  trailLength: number;
  stretch: AxisStretchState;
  cameraPreset: CameraPreset;
  subPaneMode: SubPaneMode;
  replaySpeed: number;
  replayTraceMode: ReplayTraceMode;
  indicators: Record<string, IndicatorInstanceConfig>;
}
