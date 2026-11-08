import {
  MarketBar,
  PhaseRegimeId,
  TRIAD_CONFIGS,
  TriadPairId,
} from "@/types/market";
import {
  computeMarkovTransitionMatrix,
  computePhaseClusters,
  computePhaseEntropy,
  computePhaseGeometry3D,
  computeVectorMA,
  PHASE_REGIME_META,
  PhaseClusterResult,
  PhaseEntropyResult,
  PhaseGeometry3DResult,
  VectorMAResult,
} from "./math";
import {
  computeCrossProxyConfluence,
  CrossProxyConfluenceResult,
} from "./crossProxy";

export type StrategySetupId = 1 | 2 | 3 | 4 | 5;

export type StrategySignalAction =
  | "BUY"
  | "SELL"
  | "EXIT"
  | "FILTERED"
  | "NONE";

export interface StrategySetupMeta {
  id: StrategySetupId;
  name: string;
  shortName: string;
  category: "breakout" | "filter" | "mean-reversion" | "momentum" | "rotation";
  color: string;
  whitepaperSection: string;
  summary: string;
}

export const STRATEGY_SETUP_META: Record<StrategySetupId, StrategySetupMeta> = {
  1: {
    id: 1,
    name: "Coiled Bullion Breakout",
    shortName: "S1: Coil Breakout",
    category: "breakout",
    color: "#10b981",
    whitepaperSection: "Section 3 — Setup 1",
    summary:
      "3D compression coil unwinds into a bullion-led (CCW Lz) breakout cutting orthogonally across Iso-XAUUSD contours.",
  },
  2: {
    id: 2,
    name: "Fake Dollar-Induced Spike Filter / Fade",
    shortName: "S2: FX Fakeout Fade",
    category: "filter",
    color: "#38bdf8",
    whitepaperSection: "Section 3 — Setup 2",
    summary:
      "Blocks passive FX-driven XAUUSD spikes sliding along Iso-Contours (CW Lz < -0.5, in-basin) and fades stalled FX impulses back to the 3D spine.",
  },
  3: {
    id: 3,
    name: "Exhaustion Blow-Off & Curvature Hook",
    shortName: "S3: Curvature Hook",
    category: "mean-reversion",
    color: "#f43f5e",
    whitepaperSection: "Section 3 — Setup 3",
    summary:
      "Statistical tail excursion (>2σ Vacuum / C3 Shock) where phase velocity peaks and 3D Frenet-Serret curvature (κ) hooks sharply back toward the spine.",
  },
  4: {
    id: 4,
    name: "Liquidity Vacuum Transit",
    shortName: "S4: Vacuum Transit",
    category: "momentum",
    color: "#f59e0b",
    whitepaperSection: "Section 3 — Setup 4",
    summary:
      "High-velocity, low-curvature ballistic momentum escaparating an attractor basin (>1.8σ Vacuum) in C2 Breakout regime.",
  },
  5: {
    id: 5,
    name: "Lead-Lag Orbital Rotation",
    shortName: "S5: Orbital Rotation",
    category: "rotation",
    color: "#a78bfa",
    whitepaperSection: "Section 3 — Setup 5",
    summary:
      "Equilibrium Orbit (C1) rotational inflection where spiral chirality (|Lz|) identifies the leading leg turning at the outer Bollinger rail.",
  },
};

export interface StrategySignalEvent {
  barIndex: number;
  timestamp: number;
  datetime: string;
  action: "BUY" | "SELL" | "EXIT" | "FILTERED";
  direction: 1 | -1 | 0;
  setupId: StrategySetupId;
  setupName: string;
  shortLabel: string;
  confidence: number;
  priceXauusd: number;
  priceCross: number;
  priceFx: number;
  stopLossXauusd: number;
  takeProfitXauusd: number;
  spineXauusd: number;
  isoCutEfficiency: number;
  levyArea: number;
  curvature: number;
  velocity: number;
  basinDist: number;
  regimeId: PhaseRegimeId;
  rationale: string;
  tradePnlUsd?: number;
  tradeReturnPct?: number;
}

export interface CompletedTrade {
  entryIndex: number;
  exitIndex: number;
  entryTime: string;
  exitTime: string;
  direction: 1 | -1;
  setupId: StrategySetupId;
  setupName: string;
  entryPrice: number;
  exitPrice: number;
  pnlUsd: number;
  returnPct: number;
  barsHeld: number;
  exitReason: string;
}

export interface StrategyBacktestSummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number;
  totalNetPnlUsd: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  expectancyUsd: number;
  blockedFakeouts: number;
  buyCount: number;
  sellCount: number;
  setupBreakdown: Record<
    StrategySetupId,
    { count: number; wins: number; netPnlUsd: number }
  >;
}

export interface WhitepaperStrategyOptions {
  pair?: TriadPairId;
  period?: number;
  maType?: "SMA" | "EMA";
  coilThreshold?: number;
  curvatureHookThreshold?: number;
  vacuumDistThreshold?: number;
  minConfidence?: number;
  cooldownBars?: number;
  costBps?: number;
  enableSetup1?: boolean;
  enableSetup2?: boolean;
  enableSetup3?: boolean;
  enableSetup4?: boolean;
  enableSetup5?: boolean;
  enableCrossProxyConfirmation?: boolean;
  crossProxySeries?: Partial<Record<TriadPairId, MarketBar[]>>;
  precomputedMA?: VectorMAResult;
  precomputedGeo?: PhaseGeometry3DResult;
  precomputedClusters?: PhaseClusterResult;
  precomputedEntropy?: PhaseEntropyResult;
  precomputedCrossProxy?: CrossProxyConfluenceResult;
}

export interface WhitepaperStrategyResult {
  /** Entry signal emitted on bar i: +1 = BUY, -1 = SELL, 0 = Hold/Exit */
  signalDir: Int8Array;
  /** Active position held after bar i close: +1 = LONG, -1 = SHORT, 0 = FLAT */
  position: Int8Array;
  /** Setup ID (1..5) responsible for the signal or active position on bar i */
  activeSetupId: Uint8Array;
  /** Signal / Regime conviction score (0..100) on bar i */
  confidence: Float64Array;
  /** 1 if Setup 2 blocked a Fake Dollar-Induced Gold Spike on bar i */
  fakeoutFiltered: Uint8Array;
  /** Implied XAUUSD equilibrium price on the 3D Moving Average spine */
  spineXauusd: Float64Array;
  /** Signed Z-score of XAUUSD relative to the 3D MA spine */
  signedSpineZ: Float64Array;
  /** Pillar #1: Signed Iso-XAUUSD Normal (intrinsic Gold) standardized velocity */
  isoNormalVel: Float64Array;
  /** Pillar #1: Signed Iso-XAUUSD Tangential (pure FX translation) standardized velocity */
  isoTangentVel: Float64Array;
  /** Iso-XAUUSD Contour Cut Efficiency η_⊥ in [0, 1] (1 = orthogonal cut, 0 = parallel FX slide) */
  isoCutEfficiency: Float64Array;
  /** Active stop-loss level in XAUUSD ($/oz), or NaN when flat */
  stopLossSeries: Float64Array;
  /** Active take-profit level in XAUUSD ($/oz), or NaN when flat */
  takeProfitSeries: Float64Array;
  /** Causal cumulative strategy return (%) at bar i */
  equityCurvePct: Float64Array;
  /** Causal cumulative strategy PnL ($/oz) at bar i */
  equityCurveUsd: Float64Array;
  /** Causal strategy drawdown (%) at bar i */
  drawdownPct: Float64Array;
  /** Discrete BUY / SELL / EXIT / FILTERED events */
  events: StrategySignalEvent[];
  /** Completed round-trip trades */
  trades: CompletedTrade[];
  /** Full-series backtest summary */
  summary: StrategyBacktestSummary;
  /** Milestone 2: Multi-Proxy Cross-Confirmation & Implied XAUUSD Bounce Confluence */
  crossProxy: CrossProxyConfluenceResult;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const strategyCache = new WeakMap<
  MarketBar[],
  Map<string, WhitepaperStrategyResult>
>();

/**
 * Executes the Whitepaper 5-Setup Quantitative Strategy Engine in strictly causal O(N) time.
 * Zero lookahead bias: decisions at bar `i` depend exclusively on bars `0..i`,
 * and position `position[i]` earns returns over `(i -> i+1)`.
 */
export function computeWhitepaperStrategy(
  series: MarketBar[],
  options: WhitepaperStrategyOptions = {}
): WhitepaperStrategyResult {
  const len = series.length;
  const pair: TriadPairId = options.pair ?? "EUR";
  const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
  const quoteSign = triad.quoteMode === "CCY_USD" ? 1.0 : -1.0;

  const period = Math.max(5, Math.min(300, Math.floor(options.period ?? 20)));
  const maType = options.maType ?? "SMA";
  const coilThreshold = options.coilThreshold ?? 42;
  const curvatureHookThreshold = options.curvatureHookThreshold ?? 0.34;
  const vacuumDistThreshold = options.vacuumDistThreshold ?? 1.75;
  const minConfidence = options.minConfidence ?? 52;
  const cooldownBars = Math.max(1, Math.floor(options.cooldownBars ?? 3));
  const costRate = Math.max(0, (options.costBps ?? 1.2) * 1e-4);

  const enableS1 = options.enableSetup1 ?? true;
  const enableS2 = options.enableSetup2 ?? true;
  const enableS3 = options.enableSetup3 ?? true;
  const enableS4 = options.enableSetup4 ?? true;
  const enableS5 = options.enableSetup5 ?? true;
  const enableCrossProxy = options.enableCrossProxyConfirmation ?? true;
  const proxyKeys = options.crossProxySeries
    ? Object.keys(options.crossProxySeries).sort().join(",")
    : "single";

  if (len > 0) {
    const last = series[len - 1];
    const cacheKey = `${len}:${pair}:${period}:${maType}:${coilThreshold}:${curvatureHookThreshold}:${vacuumDistThreshold}:${minConfidence}:${cooldownBars}:${costRate}:${enableS1}:${enableS2}:${enableS3}:${enableS4}:${enableS5}:${enableCrossProxy}:${proxyKeys}:${last.timestamp}:${last.xauusd}`;
    const existing = strategyCache.get(series)?.get(cacheKey);
    if (existing) return existing;
  }

  const signalDir = new Int8Array(len);
  const position = new Int8Array(len);
  const activeSetupId = new Uint8Array(len);
  const confidence = new Float64Array(len);
  const fakeoutFiltered = new Uint8Array(len);
  const spineXauusd = new Float64Array(len);
  const signedSpineZ = new Float64Array(len);
  const isoNormalVel = new Float64Array(len);
  const isoTangentVel = new Float64Array(len);
  const isoCutEfficiency = new Float64Array(len);
  const stopLossSeries = new Float64Array(len);
  const takeProfitSeries = new Float64Array(len);
  const equityCurvePct = new Float64Array(len);
  const equityCurveUsd = new Float64Array(len);
  const drawdownPct = new Float64Array(len);

  stopLossSeries.fill(Number.NaN);
  takeProfitSeries.fill(Number.NaN);

  const events: StrategySignalEvent[] = [];
  const trades: CompletedTrade[] = [];

  if (len === 0) {
    const emptyCrossProxy =
      options.precomputedCrossProxy ??
      computeCrossProxyConfluence(series, {
        primaryPair: pair,
        period,
        maType,
        crossProxySeries: options.crossProxySeries,
      });
    return {
      signalDir,
      position,
      activeSetupId,
      confidence,
      fakeoutFiltered,
      spineXauusd,
      signedSpineZ,
      isoNormalVel,
      isoTangentVel,
      isoCutEfficiency,
      stopLossSeries,
      takeProfitSeries,
      equityCurvePct,
      equityCurveUsd,
      drawdownPct,
      events,
      trades,
      summary: buildSummaryFromSlice(events, trades, equityCurvePct, drawdownPct),
      crossProxy: emptyCrossProxy,
    };
  }

  const ma =
    options.precomputedMA ?? computeVectorMA(series, period, maType);
  const geo =
    options.precomputedGeo ?? computePhaseGeometry3D(series, period, period);
  const clusters =
    options.precomputedClusters ?? computePhaseClusters(series, period, geo);
  const entropy =
    options.precomputedEntropy ??
    computePhaseEntropy(series, period, geo, clusters);
  const crossProxy =
    options.precomputedCrossProxy ??
    computeCrossProxyConfluence(series, {
      primaryPair: pair,
      period,
      maType,
      crossProxySeries: options.crossProxySeries,
      precomputedMA: ma,
      precomputedGeo: geo,
      precomputedClusters: clusters,
    });

  // Causal running sums for XAUUSD standard deviation, step volatility, and Markov transition tracking
  let sumG = 0;
  let sumG2 = 0;
  let sumDiffG2 = 0;
  let prevEmaVx = 0;
  let prevEmaVy = 0;

  const markovCounts: number[][] = [
    [0.25, 0.25, 0.25, 0.25],
    [0.25, 0.25, 0.25, 0.25],
    [0.25, 0.25, 0.25, 0.25],
    [0.25, 0.25, 0.25, 0.25],
  ];

  // Active trade state machine (strictly causal)
  let currPos: 1 | -1 | 0 = 0;
  let currSetup: StrategySetupId = 1;
  let entryIdx = -1;
  let entryPrice = 0;
  let activeStop = Number.NaN;
  let activeTp = Number.NaN;
  let maxFavExcursion = 0;
  let lastSignalIdx = -999;
  let lastFilteredIdx = -999;

  // Portfolio equity tracking
  let cumUsd = 0;
  let cumReturnFactor = 1.0;
  let peakEquityFactor = 1.0;

  const invSqrt2 = Math.SQRT1_2;

  for (let i = 0; i < len; i++) {
    const bar = series[i];
    const gNow = bar.xauusd;
    const barMoveG = i >= 1 ? gNow - series[i - 1].xauusd : 0;

    // 1. Realize causal PnL from bar (i-1 -> i) on position held at close of i-1
    if (i >= 1 && currPos !== 0) {
      const prevG = series[i - 1].xauusd;
      const barDiff = (gNow - prevG) * currPos;
      const barRet = prevG > 0 ? barDiff / prevG : 0;
      cumUsd += barDiff;
      cumReturnFactor *= 1.0 + barRet;
    }

    if (cumReturnFactor > peakEquityFactor) {
      peakEquityFactor = cumReturnFactor;
    }
    equityCurveUsd[i] = cumUsd;
    equityCurvePct[i] = (cumReturnFactor - 1.0) * 100.0;
    drawdownPct[i] =
      peakEquityFactor > 0
        ? ((peakEquityFactor - cumReturnFactor) / peakEquityFactor) * 100.0
        : 0;

    // 2. Causal XAUUSD Spine Equilibrium, Level Dispersion & Bar-to-Bar Step Volatility
    sumG += gNow;
    sumG2 += gNow * gNow;
    sumDiffG2 += barMoveG * barMoveG;
    if (i >= period) {
      const oldG = series[i - period].xauusd;
      sumG -= oldG;
      sumG2 -= oldG * oldG;
      const oldDiffG =
        i - period >= 1
          ? series[i - period].xauusd - series[i - period - 1].xauusd
          : 0;
      sumDiffG2 -= oldDiffG * oldDiffG;
    }
    const nWin = Math.min(i + 1, period);
    const meanG = sumG / nWin;
    const varG = Math.max(0, sumG2 / nWin - meanG * meanG);
    const stdG = Math.max(gNow * 0.0005, Math.sqrt(varG));
    const stepStdG = Math.max(
      gNow * 0.00025,
      Math.sqrt(Math.max(0, sumDiffG2) / Math.max(1, nWin - 1))
    );
    // Risk unit blends level dispersion with step volatility so post-coil stops aren't micro-tight
    // and post-trend stops aren't excessively wide.
    const riskUnitG = clamp(
      0.45 * stdG + 1.35 * stepStdG,
      1.15 * stepStdG,
      3.1 * stepStdG
    );

    const mx = ma.xMA[i] || bar.xaueur;
    const my = ma.yMA[i] || bar.eurusd;
    const gSpine =
      triad.quoteMode === "CCY_USD"
        ? mx * my
        : mx / Math.max(1e-9, my);
    spineXauusd[i] = gSpine;

    const zXau = clamp((gNow - gSpine) / stdG, -5.0, 5.0);
    signedSpineZ[i] = zXau;

    // 3. Orthogonal Driver Decomposition in Volatility-Standardized Phase Space
    let rawVNorm = 0;
    let rawVTang = 0;
    if (i >= 1) {
      const dx = geo.normX[i] - geo.normX[i - 1];
      const dy = geo.normY[i] - geo.normY[i - 1];
      rawVNorm = (dx + quoteSign * dy) * invSqrt2;
      rawVTang = (dx - quoteSign * dy) * invSqrt2;

      const emaVx = i === 1 ? dx : 0.5 * dx + 0.5 * prevEmaVx;
      const emaVy = i === 1 ? dy : 0.5 * dy + 0.5 * prevEmaVy;
      prevEmaVx = emaVx;
      prevEmaVy = emaVy;

      // Normal component cuts across Iso-XAUUSD contours; Tangent component slides along Iso-XAUUSD contours
      const vNorm = (emaVx + quoteSign * emaVy) * invSqrt2;
      const vTang = (emaVx - quoteSign * emaVy) * invSqrt2;
      isoNormalVel[i] = vNorm;
      isoTangentVel[i] = vTang;

      const totalMag = Math.sqrt(vNorm * vNorm + vTang * vTang);
      // Also check whether Cross-Gold X is moving in the same intrinsic direction as XAUUSD
      const crossReinforces =
        emaVx * vNorm >= 0 ? 1.0 : 0.65;
      isoCutEfficiency[i] =
        totalMag > 1e-9
          ? clamp((Math.abs(vNorm) / totalMag) * crossReinforces, 0, 1)
          : 0.5;

      // Update causal Markov transition counts
      const prevReg = clusters.regime[i - 1] & 3;
      const currReg = clusters.regime[i] & 3;
      markovCounts[prevReg][currReg] += 1.0;
    } else {
      isoCutEfficiency[i] = 0.5;
    }

    // Warmup guard: require at least `Math.min(10, period)` bars before emitting signals
    const warmup = Math.min(10, period);
    if (i < warmup) {
      continue;
    }

    const regNow = (clusters.regime[i] & 3) as PhaseRegimeId;
    const regPrev = (clusters.regime[i - 1] & 3) as PhaseRegimeId;
    const basinDist = clusters.nearestBasinDist[i];
    const dispZ = ma.displacementZScore[i];
    const prevZXau = signedSpineZ[i - 1];
    const rNow = geo.radialDist[i];
    const vNow = geo.velocity[i];
    const vPrev = geo.velocity[i - 1];
    const kNow = geo.curvature[i];
    const kPrev = geo.curvature[i - 1];
    const lNow = geo.levyArea[i];
    const coilNow = geo.coilScore[i];
    const turnDeg = geo.turningAngleDeg[i];
    const cutEff = isoCutEfficiency[i];
    const vNorm = isoNormalVel[i];
    const vTang = isoTangentVel[i];
    const estRoundTripCostUsd = gNow * costRate * 2.0;

    // Causal Markov self-persistence probability for C1: Orbit
    const row1 = markovCounts[1];
    const row1Sum = row1[0] + row1[1] + row1[2] + row1[3] || 1;
    const orbitSelfProb = row1[1] / row1Sum;

    // -------------------------------------------------------------------------
    // STEP A: Check Exits / Stops / Targets on Active Position
    // -------------------------------------------------------------------------
    if (currPos !== 0) {
      const barsHeld = i - entryIdx;
      const unrealizedUsd = (gNow - entryPrice) * currPos;
      if (unrealizedUsd > maxFavExcursion) {
        maxFavExcursion = unrealizedUsd;
      }
      const isNetProfitable =
        unrealizedUsd >= Math.max(estRoundTripCostUsd * 1.4, 0.25 * stdG);

      const hitStop =
        currPos === 1 ? gNow <= activeStop : gNow >= activeStop;
      const hitTp =
        currPos === 1 ? gNow >= activeTp : gNow <= activeTp;

      // Whitepaper Setup 1/4 Exit: Regime flips to C3: Shock with Curvature Hook > threshold,
      // or Basin Distance collapses back inside < 1.10σ after a breakout
      const isBreakoutTrade = currSetup === 1 || currSetup === 4;
      const shockExhaustionExit =
        isBreakoutTrade &&
        barsHeld >= 2 &&
        isNetProfitable &&
        (regNow === 3 || Math.abs(zXau) > 1.85) &&
        (kNow >= curvatureHookThreshold || barMoveG * currPos < -0.1 * stepStdG) &&
        vNow <= vPrev * 1.05;

      // Mean-reversion / Fade / Rotation exit:
      // - Setup 3 (Tail Vacuum Hook) targets deeper retracement (|zXau| <= 0.15 with >= 0.55σ gain)
      // - Setup 2 & 5 (In-Basin Fade / Orbital Rotation) exit cleanly upon entering the 3D Attractor Basin core (|zXau| <= 0.35)
      const isReversionTrade =
        currSetup === 2 || currSetup === 3 || currSetup === 5;
      const targetSpan = Math.max(stepStdG, Math.abs(activeTp - entryPrice));
      const spineCrossedExit =
        currSetup === 3
          ? barsHeld >= 1 &&
            unrealizedUsd >=
              Math.max(estRoundTripCostUsd * 1.8, 0.55 * stdG, 0.5 * targetSpan) &&
            ((currPos === 1 && zXau >= -0.15) ||
              (currPos === -1 && zXau <= 0.15))
          : (currSetup === 2 || currSetup === 5) &&
            barsHeld >= 1 &&
            isNetProfitable &&
            ((currPos === 1 && zXau >= -0.35) ||
              (currPos === -1 && zXau <= 0.35));

      // Time-decay / momentum stall exit
      const maxHoldBars = isReversionTrade ? 22 : 30;
      const timeStopExit =
        barsHeld >= maxHoldBars ||
        (barsHeld >= 6 &&
          isNetProfitable &&
          unrealizedUsd >= Math.max(0.55 * stdG, 0.55 * targetSpan) &&
          barMoveG * currPos < -0.2 * stepStdG);

      if (hitStop || hitTp || shockExhaustionExit || spineCrossedExit || timeStopExit) {
        const exitReason = hitTp
          ? "Take-Profit Target Hit"
          : spineCrossedExit
          ? "3D MA Spine Equilibrium Reached"
          : shockExhaustionExit
          ? "C3 Shock + Curvature Hook Exhaustion"
          : hitStop
          ? "Volatility Stop-Loss Hit"
          : "Max Horizon Time Exit";

        const rawPnl = (gNow - entryPrice) * currPos;
        const costUsd = (entryPrice + gNow) * costRate;
        const netPnl = rawPnl - costUsd;
        const netRetPct = entryPrice > 0 ? (netPnl / entryPrice) * 100.0 : 0;

        // Deduct round-trip transaction cost at trade close
        cumUsd -= costUsd;
        if (gNow > 0) {
          cumReturnFactor *= Math.max(0.5, 1.0 - costUsd / gNow);
        }
        equityCurveUsd[i] = cumUsd;
        equityCurvePct[i] = (cumReturnFactor - 1.0) * 100.0;

        trades.push({
          entryIndex: entryIdx,
          exitIndex: i,
          entryTime: series[entryIdx].datetime,
          exitTime: bar.datetime,
          direction: currPos,
          setupId: currSetup,
          setupName: STRATEGY_SETUP_META[currSetup].name,
          entryPrice,
          exitPrice: gNow,
          pnlUsd: netPnl,
          returnPct: netRetPct,
          barsHeld,
          exitReason,
        });

        events.push({
          barIndex: i,
          timestamp: bar.timestamp,
          datetime: bar.datetime,
          action: "EXIT",
          direction: 0,
          setupId: currSetup,
          setupName: STRATEGY_SETUP_META[currSetup].name,
          shortLabel: `EXIT (${netPnl >= 0 ? "+" : ""}$${netPnl.toFixed(1)})`,
          confidence: 70,
          priceXauusd: gNow,
          priceCross: bar.xaueur,
          priceFx: bar.eurusd,
          stopLossXauusd: activeStop,
          takeProfitXauusd: activeTp,
          spineXauusd: gSpine,
          isoCutEfficiency: cutEff,
          levyArea: lNow,
          curvature: kNow,
          velocity: vNow,
          basinDist,
          regimeId: regNow,
          rationale: `${exitReason} after ${barsHeld}b (${
            netPnl >= 0 ? "+" : ""
          }$${netPnl.toFixed(2)}/oz, ${
            netRetPct >= 0 ? "+" : ""
          }${netRetPct.toFixed(2)}%)`,
          tradePnlUsd: netPnl,
          tradeReturnPct: netRetPct,
        });

        currPos = 0;
        activeStop = Number.NaN;
        activeTp = Number.NaN;
        maxFavExcursion = 0;
      } else {
        // Causal end-of-bar breakeven & profit-lock ratchet (applies to bars i+1 onward)
        const targetSpan = Math.max(stepStdG, Math.abs(activeTp - entryPrice));
        const breakevenTrigger =
          currSetup === 2 || currSetup === 5
            ? Math.max(estRoundTripCostUsd * 1.5, 0.34 * stdG, 0.38 * targetSpan)
            : Math.max(estRoundTripCostUsd * 1.5, 0.45 * stdG, 0.48 * targetSpan);
        if (unrealizedUsd >= breakevenTrigger) {
          const lockProfitStop =
            entryPrice +
            currPos * Math.max(estRoundTripCostUsd * 1.35, 0.2 * stdG);
          if (currPos === 1 && lockProfitStop > activeStop) {
            activeStop = lockProfitStop;
          } else if (currPos === -1 && lockProfitStop < activeStop) {
            activeStop = lockProfitStop;
          }
        }
        if (unrealizedUsd >= Math.max(0.75 * stdG, 0.68 * targetSpan)) {
          const trailStop =
            gNow - currPos * Math.max(0.6 * stepStdG, 0.25 * unrealizedUsd);
          if (currPos === 1 && trailStop > activeStop) {
            activeStop = trailStop;
          } else if (currPos === -1 && trailStop < activeStop) {
            activeStop = trailStop;
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP B: Evaluate Setup 2 Diagnostic Signature (Fake Dollar-Induced Gold Spike)
    // -------------------------------------------------------------------------
    // Whitepaper Section 3 Setup 2:
    // 1. Floor trajectory slides parallel to Iso-XAUUSD contour (low isoCutEfficiency or |vTang| > |vNorm|)
    // 2. Chirality handedness: Lz < -0.35 (CW: FX Leads)
    // 3. Basin Containment: Basin Distance < 1.65σ (trapped inside existing basin)
    const isParallelToIso = cutEff < 0.52 || Math.abs(vTang) > Math.abs(vNorm) * 1.05;
    const isCwFxLed = lNow < -0.30;
    const isTrappedInBasin = basinDist < 1.65;
    const hasApparentPriceMove = vNow >= 0.32 || Math.abs(zXau) >= 0.95;

    const isFakeDollarSpike =
      enableS2 &&
      isParallelToIso &&
      isCwFxLed &&
      isTrappedInBasin &&
      hasApparentPriceMove;

    if (isFakeDollarSpike) {
      fakeoutFiltered[i] = 1;
      // Record a discrete FILTERED diagnostic marker if not recently emitted
      if (i - lastFilteredIdx >= 8) {
        lastFilteredIdx = i;
        events.push({
          barIndex: i,
          timestamp: bar.timestamp,
          datetime: bar.datetime,
          action: "FILTERED",
          direction: 0,
          setupId: 2,
          setupName: STRATEGY_SETUP_META[2].name,
          shortLabel: "FAKEOUT BLOCKED",
          confidence: Math.round(clamp(65 + Math.abs(lNow) * 12, 60, 96)),
          priceXauusd: gNow,
          priceCross: bar.xaueur,
          priceFx: bar.eurusd,
          stopLossXauusd: gSpine,
          takeProfitXauusd: gSpine,
          spineXauusd: gSpine,
          isoCutEfficiency: cutEff,
          levyArea: lNow,
          curvature: kNow,
          velocity: vNow,
          basinDist,
          regimeId: regNow,
          rationale: `Setup 2 Filter: Blocked FX-driven spike (Iso-Cut ${(
            cutEff * 100
          ).toFixed(0)}%, CW Lz=${lNow.toFixed(2)}, Basin=${basinDist.toFixed(
            2
          )}σ < 1.65σ).`,
        });
      }
    }

    // -------------------------------------------------------------------------
    // STEP C: Evaluate the 5 Whitepaper Setups for Entry / Reversal Signals
    // -------------------------------------------------------------------------
    const canSignal = i - lastSignalIdx >= cooldownBars;

    let candidateDir: 1 | -1 | 0 = 0;
    let candidateSetup: StrategySetupId = 1;
    let candidateConf = 0;
    let candidateStop = Number.NaN;
    let candidateTp = Number.NaN;
    let candidateReason = "";

    if (canSignal) {
      const cpBreadth = enableCrossProxy ? crossProxy.bullionBreadth[i] : 0;
      const cpChirality = enableCrossProxy ? crossProxy.chiralityConsensus[i] : 0;
      const cpSpine = enableCrossProxy
        ? crossProxy.consensusSpineXauusd[i] || gSpine
        : gSpine;
      const cpBounce = enableCrossProxy ? crossProxy.bounceSignalBias[i] : 0;
      // For mean-reversion targets, anchor conservatively between local 3D spine and cross-proxy consensus spine
      const conservativeSpineG =
        Math.abs(cpSpine - gNow) < Math.abs(gSpine - gNow)
          ? 0.8 * gSpine + 0.2 * cpSpine
          : gSpine;

      // -----------------------------------------------------------------------
      // SETUP 1: "The Coiled Bullion Breakout" (Trend Entry)
      // -----------------------------------------------------------------------
      // Check trailing compression window [i-12 .. i-1] for pre-condition build-up
      if (enableS1 && !isFakeDollarSpike) {
        const lookbackStart = Math.max(0, i - 12);
        let coilBarCount = 0;
        let maxRecentCoil = 0;
        let maxRecentQualCoil = 0;
        let minRecentDisorder = 100;
        let minRecentBasinDist = Infinity;

        for (let k = lookbackStart; k < i; k++) {
          if (clusters.regime[k] === 0 || geo.coilScore[k] >= coilThreshold * 0.85) {
            coilBarCount++;
          }
          if (geo.coilScore[k] > maxRecentCoil) {
            maxRecentCoil = geo.coilScore[k];
          }
          if (entropy.entropyQualityCoilScore[k] > maxRecentQualCoil) {
            maxRecentQualCoil = entropy.entropyQualityCoilScore[k];
          }
          if (entropy.compositeEntropyPct[k] < minRecentDisorder) {
            minRecentDisorder = entropy.compositeEntropyPct[k];
          }
          if (clusters.nearestBasinDist[k] < minRecentBasinDist) {
            minRecentBasinDist = clusters.nearestBasinDist[k];
          }
        }

        const isExtremeWhiteNoiseChop =
          entropy.compositeEntropyPct[i] > 88 && entropy.turningEntropy[i] > 0.88;

        const hadCompressionCoil =
          coilBarCount >= 3 &&
          maxRecentCoil >= coilThreshold &&
          minRecentBasinDist < 1.35 &&
          !isExtremeWhiteNoiseChop;

        const isExpandingBreakout =
          (regNow === 2 ||
            (regNow === 1 && vNow >= 0.5 && rNow > geo.radialDist[i - 1])) &&
          (basinDist >= vacuumDistThreshold * 0.82 ||
            basinDist - minRecentBasinDist >= 0.4);

        const isBullionLed = lNow >= -0.1 && cutEff >= 0.52;
        const dirSign: 1 | -1 | 0 =
          vNorm > 0.08 && zXau > 0.15 && barMoveG >= 0
            ? 1
            : vNorm < -0.08 && zXau < -0.15 && barMoveG <= 0
            ? -1
            : 0;
        // Cross-Proxy Confirmation: block breakouts where the FX leg is overextended relative to Cross-Gold
        const fxNotOverextended =
          !enableCrossProxy ||
          !(Math.abs(geo.normY[i]) > 1.75 && Math.abs(geo.normY[i]) > Math.abs(geo.normX[i]) + 0.35);

        if (
          hadCompressionCoil &&
          isExpandingBreakout &&
          isBullionLed &&
          dirSign !== 0 &&
          fxNotOverextended
        ) {
          const entropyBonus = minRecentDisorder < 50 ? 5 : 0;
          const cpBonus = enableCrossProxy
            ? clamp(cpBreadth * dirSign * 4 + Math.max(0, cpChirality) * 3, -3, 6)
            : 0;
          const conf = clamp(
            58 +
              (maxRecentCoil - coilThreshold) * 0.45 +
              cutEff * 18 +
              Math.max(0, lNow) * 6 +
              (regNow === 2 ? 8 : 0) +
              entropyBonus +
              cpBonus,
            55,
            98
          );
          if (conf > candidateConf) {
            candidateDir = dirSign;
            candidateSetup = 1;
            candidateConf = conf;
            candidateStop = gNow - dirSign * Math.max(1.65 * stdG, Math.abs(gNow - gSpine) * 0.85);
            candidateTp = gNow + dirSign * 2.1 * stdG;
            candidateReason = `Setup 1 Coiled Breakout: Unwound ${coilBarCount}b coil (Peak ${maxRecentCoil.toFixed(
              0
            )}/100, TrueCoil ${maxRecentQualCoil.toFixed(
              0
            )}, Disorder ${entropy.compositeEntropyPct[i].toFixed(
              0
            )}%) into C${regNow} expansion; CCW Lz=${lNow.toFixed(
              2
            )}, Iso-Cut=${(cutEff * 100).toFixed(0)}%, Breadth=${(
              cpBreadth * 100
            ).toFixed(0)}%, Basin=${basinDist.toFixed(2)}σ.`;
          }
        }
      }

      // -----------------------------------------------------------------------
      // SETUP 3: "Exhaustion Blow-Off & Curvature Hook" (Mean-Reversion Entry)
      // -----------------------------------------------------------------------
      // Trigger: C3 Shock or high Phase Z-score + Liquidity Vacuum + Curvature Hook (κ spike + actual price hook back toward spine)
      if (enableS3) {
        const stretchRefZ = Math.abs(prevZXau) >= Math.abs(zXau) ? prevZXau : zXau;
        const revDir: 1 | -1 = stretchRefZ > 0 ? -1 : 1;
        const isTailStretch =
          (regNow === 3 ||
            regPrev === 3 ||
            dispZ >= 1.9 ||
            ma.displacementZScore[i - 1] >= 1.9 ||
            Math.abs(stretchRefZ) >= 2.1) &&
          Math.abs(stretchRefZ) >= 1.85 &&
          zXau * stretchRefZ > 0 &&
          Math.abs(zXau) >= 0.9;
        const inVacuum =
          basinDist >= vacuumDistThreshold * 0.95 ||
          clusters.nearestBasinDist[i - 1] >= vacuumDistThreshold * 0.95 ||
          rNow >= 1.95 ||
          geo.radialDist[i - 1] >= 1.95;
        // Require actual price & radial contraction hook back toward the 3D spine (prevents shorting accelerating breakouts)
        // Cross-Proxy Confirmation: require genuine Cross-Gold leg hook (>= 0.22σ), non-trivial rejection velocity (>= 0.38 * vPrev),
        // and multi-horizon / cross-proxy consensus spine alignment
        const crossGoldHook = (geo.normX[i] - geo.normX[i - 1]) * revDir;
        const structuralPull = ((cpSpine - gSpine) / stdG) * revDir;
        const cpConfirmsHook =
          !enableCrossProxy ||
          (crossGoldHook >= 0.22 &&
            vNow >= vPrev * 0.38 &&
            (structuralPull >= -0.02 ||
              (Math.abs(lNow) <= 2.65 && cpChirality <= 0.18)));
        const hasDirectionalHook =
          barMoveG * revDir >= 0.2 * stepStdG &&
          rawVNorm * revDir > 0 &&
          rNow < geo.radialDist[i - 1] &&
          cpConfirmsHook;
        const hasCurvatureHook =
          hasDirectionalHook &&
          ((kNow >= curvatureHookThreshold &&
            (vNow <= vPrev * 0.95 || turnDeg >= 75)) ||
            (turnDeg >= 135 &&
              Math.abs(stretchRefZ) >= 2.35 &&
              kNow >= curvatureHookThreshold * 0.72));

        if (isTailStretch && inVacuum && hasCurvatureHook) {
          const cpBounceBonus = enableCrossProxy
            ? clamp(Math.max(0, cpBounce * revDir) * 5, 0, 5)
            : 0;
          const conf = clamp(
            60 +
              Math.abs(stretchRefZ) * 7 +
              (kNow - curvatureHookThreshold * 0.75) * 35 +
              (regNow === 3 || regPrev === 3 ? 8 : 0) +
              cpBounceBonus,
            56,
            97
          );
          if (conf > candidateConf) {
            candidateDir = revDir;
            candidateSetup = 3;
            candidateConf = conf;
            candidateStop = gNow - revDir * 1.45 * stdG;
            // Target the 3D Attractor Basin Edge (75% retracement toward spine) per Whitepaper Section 3 Setup 3
            const spineDist = Math.abs(gNow - conservativeSpineG);
            candidateTp =
              gNow + revDir * Math.max(0.85 * stdG, spineDist * 0.75);
            candidateReason = `Setup 3 Exhaustion Hook: Tail stretch (${
              stretchRefZ >= 0 ? "+" : ""
            }${stretchRefZ.toFixed(2)}σ, Basin=${basinDist.toFixed(
              2
            )}σ) bent sharply with 3D Curvature κ=${kNow.toFixed(
              2
            )} & Δθ=${turnDeg.toFixed(0)}°; targeting 3D MA Spine ($${conservativeSpineG.toFixed(
              2
            )}).`;
          }
        }
      }

      // -----------------------------------------------------------------------
      // SETUP 4: "Liquidity Vacuum Transit" (Basin-to-Basin Acceleration)
      // -----------------------------------------------------------------------
      // Trigger: Exiting dominant basin (> vacuumDistThreshold) in C2 Breakout with high velocity & low curvature
      if (enableS4 && !isFakeDollarSpike) {
        const isBallisticBreakout =
          regNow === 2 &&
          basinDist >= vacuumDistThreshold * 0.95 &&
          vNow >= 0.6 &&
          kNow < 0.24 &&
          turnDeg < 65 &&
          cutEff >= 0.54 &&
          Math.abs(zXau) < 2.25; // Not yet blown off into tail exhaustion

        const dirSign: 1 | -1 | 0 =
          vNorm > 0.12 && zXau > 0.2 && barMoveG > 0.1 * stepStdG
            ? 1
            : vNorm < -0.12 && zXau < -0.2 && barMoveG < -0.1 * stepStdG
            ? -1
            : 0;

        if (isBallisticBreakout && dirSign !== 0) {
          const cpBonus = enableCrossProxy
            ? clamp(cpBreadth * dirSign * 4 + Math.max(0, cpChirality) * 3, -2, 6)
            : 0;
          const conf = clamp(
            56 +
              vNow * 14 +
              (basinDist - vacuumDistThreshold * 0.95) * 10 +
              cutEff * 15 +
              cpBonus,
            54,
            95
          );
          if (conf > candidateConf) {
            candidateDir = dirSign;
            candidateSetup = 4;
            candidateConf = conf;
            candidateStop = gNow - dirSign * 1.75 * stdG;
            candidateTp = gNow + dirSign * 2.0 * stdG;
            candidateReason = `Setup 4 Vacuum Transit: Ballistic C2 transit (v=${vNow.toFixed(
              2
            )}σ/b, κ=${kNow.toFixed(2)} < 0.24, Basin=${basinDist.toFixed(
              2
            )}σ Vacuum, Iso-Cut=${(cutEff * 100).toFixed(0)}%, Breadth=${(
              cpBreadth * 100
            ).toFixed(0)}%).`;
          }
        }
      }

      // -----------------------------------------------------------------------
      // SETUP 5: "Lead-Lag Orbital Rotation Trade" (Chirality Handedness Signal)
      // -----------------------------------------------------------------------
      // Trigger: C1 Equilibrium Orbit with strong |Lz| and leading leg inflection at outer rail
      if (enableS5) {
        const stretchRefZ = Math.abs(prevZXau) >= Math.abs(zXau) ? prevZXau : zXau;
        const rotDir: 1 | -1 = stretchRefZ > 0 ? -1 : 1;

        // Cross-Proxy Orbital Filter: block rotation fades when velocity is exploding into a shock (vNow > 1.9 * vPrev),
        // when stretch has already escaped the C1 orbit (> 1.92σ), or when structural spine & curvature oppose rotation
        const structuralPull5 = ((cpSpine - gSpine) / stdG) * rotDir;
        const cpAllowsOrbit =
          !enableCrossProxy ||
          (vNow <= Math.max(1.35, vPrev * 1.95) &&
            Math.abs(stretchRefZ) <= 1.92 &&
            Math.abs(zXau) <= 1.52 &&
            (structuralPull5 >= 0.0 || (kNow >= 0.34 && cutEff <= 0.64)) &&
            (cpChirality >= 0.02 || cpBounce * rotDir >= 0.55));

        const inEquilibriumOrbit =
          regNow === 1 &&
          orbitSelfProb >= 0.44 &&
          rNow >= 1.15 &&
          rNow <= 2.25 &&
          Math.abs(stretchRefZ) >= 1.15 &&
          zXau * stretchRefZ > 0 &&
          cpAllowsOrbit;

        if (inEquilibriumOrbit) {
          const dxStep = geo.normX[i] - geo.normX[i - 1];
          const dyStep = geo.normY[i] - geo.normY[i - 1];
          const xauTurnedTowardSpine = barMoveG * rotDir >= 0.15 * stepStdG;

          // CW Orbit (Lz < -0.5): FX leg (normY) leads -> check if normY inflected back toward 0
          const cwFxInflected =
            lNow <= -0.5 &&
            Math.abs(geo.normY[i - 1]) >= 1.1 &&
            geo.normY[i - 1] * dyStep < 0 &&
            xauTurnedTowardSpine;

          // CCW Orbit (Lz > +0.5): Cross-Gold leg (normX) leads -> check if normX inflected back toward 0
          const ccwGoldInflected =
            lNow >= 0.5 &&
            Math.abs(geo.normX[i - 1]) >= 1.1 &&
            geo.normX[i - 1] * dxStep < 0 &&
            xauTurnedTowardSpine;

          if (cwFxInflected || ccwGoldInflected) {
            const cpBonus = enableCrossProxy
              ? clamp(Math.max(0, cpBounce * rotDir) * 5, 0, 5)
              : 0;
            const conf = clamp(
              54 +
                Math.abs(lNow) * 10 +
                orbitSelfProb * 18 +
                Math.abs(stretchRefZ) * 5 +
                cpBonus,
              52,
              92
            );
            if (conf > candidateConf) {
              candidateDir = rotDir;
              candidateSetup = 5;
              candidateConf = conf;
              candidateStop = gNow - rotDir * 1.35 * stdG;
              const spineDist = Math.abs(gNow - conservativeSpineG);
              candidateTp =
                gNow + rotDir * Math.max(0.65 * stdG, spineDist * 0.68);
              const leaderLabel = cwFxInflected
                ? `CW FX Leader (${triad.yTicker})`
                : `CCW Cross-Gold Leader (${triad.xTicker})`;
              candidateReason = `Setup 5 Orbital Rotation: ${leaderLabel} inflected at ${rNow.toFixed(
                2
              )}σ rail (Lz=${lNow.toFixed(2)}, P(Orbit)=${(
                orbitSelfProb * 100
              ).toFixed(0)}%); rotating back to 3D Spine ($${conservativeSpineG.toFixed(
                2
              )}).`;
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // SETUP 2 (Active Fade Trigger): "Fake Dollar-Induced Gold Spike Fade"
      // -----------------------------------------------------------------------
      // When a Dollar-induced spike stretches XAUUSD > 1.25σ from the spine while trapped in basin
      // and the FX impulse stalls and hooks back toward the spine, fade back to the 3D spine.
      const stretchRefZ2 = Math.abs(prevZXau) >= Math.abs(zXau) ? prevZXau : zXau;
      const fadeDir2: 1 | -1 = stretchRefZ2 > 0 ? -1 : 1;
      const cpConfirmsFakeout =
        !enableCrossProxy ||
        (basinDist >= 0.72 &&
          Math.abs(geo.normY[i]) <= 1.05 &&
          vNow >= 0.38 &&
          (vNow >= vPrev * 0.85 || turnDeg >= 95) &&
          cpBounce * fadeDir2 >= 0.15);
      if (
        enableS2 &&
        isFakeDollarSpike &&
        cpConfirmsFakeout &&
        Math.abs(stretchRefZ2) >= 1.25 &&
        zXau * stretchRefZ2 > 0 &&
        barMoveG * fadeDir2 >= 0.18 * stepStdG &&
        (vNow < vPrev || turnDeg >= 65)
      ) {
        const cpBonus = enableCrossProxy
          ? clamp(Math.max(0, cpBounce * fadeDir2) * 5, 0, 5)
          : 0;
        const conf = clamp(
          55 +
            (1 - cutEff) * 22 +
            Math.abs(lNow) * 8 +
            Math.abs(stretchRefZ2) * 6 +
            cpBonus,
          53,
          91
        );
        if (conf > candidateConf) {
          candidateDir = fadeDir2;
          candidateSetup = 2;
          candidateConf = conf;
          candidateStop = gNow - fadeDir2 * 1.35 * stdG;
          const spineDist = Math.abs(gNow - conservativeSpineG);
          candidateTp =
            gNow + fadeDir2 * Math.max(0.65 * stdG, spineDist * 0.68);
          candidateReason = `Setup 2 Fakeout Fade: Passive FX-translation spike (${
            stretchRefZ2 >= 0 ? "+" : ""
          }${stretchRefZ2.toFixed(2)}σ, Iso-Cut=${(cutEff * 100).toFixed(
            0
          )}%, CW Lz=${lNow.toFixed(2)}) stalled inside basin (${basinDist.toFixed(
            2
          )}σ); fading to 3D Spine ($${conservativeSpineG.toFixed(2)}).`;
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP D: Execute Signal Entry / Reversal if Conviction >= Threshold
    // -------------------------------------------------------------------------
    // Never churn an open position at a loss; only reverse if the open trade is already net profitable
    const allowReversal =
      currPos === 0 ||
      (gNow - entryPrice) * currPos > estRoundTripCostUsd * 1.35;

    if (
      candidateDir !== 0 &&
      candidateConf >= minConfidence &&
      candidateDir !== currPos &&
      allowReversal
    ) {
      // If reversing an existing opposite position, close it first
      if (currPos !== 0) {
        const barsHeld = i - entryIdx;
        const rawPnl = (gNow - entryPrice) * currPos;
        const costUsd = (entryPrice + gNow) * costRate;
        const netPnl = rawPnl - costUsd;
        const netRetPct = entryPrice > 0 ? (netPnl / entryPrice) * 100.0 : 0;

        cumUsd -= costUsd;
        if (gNow > 0) {
          cumReturnFactor *= Math.max(0.5, 1.0 - costUsd / gNow);
        }
        equityCurveUsd[i] = cumUsd;
        equityCurvePct[i] = (cumReturnFactor - 1.0) * 100.0;

        trades.push({
          entryIndex: entryIdx,
          exitIndex: i,
          entryTime: series[entryIdx].datetime,
          exitTime: bar.datetime,
          direction: currPos,
          setupId: currSetup,
          setupName: STRATEGY_SETUP_META[currSetup].name,
          entryPrice,
          exitPrice: gNow,
          pnlUsd: netPnl,
          returnPct: netRetPct,
          barsHeld,
          exitReason: `Reversed by ${STRATEGY_SETUP_META[candidateSetup].shortName}`,
        });
      }

      currPos = candidateDir;
      currSetup = candidateSetup;
      entryIdx = i;
      entryPrice = gNow;
      activeStop = candidateStop;
      activeTp = candidateTp;
      maxFavExcursion = 0;
      lastSignalIdx = i;

      signalDir[i] = candidateDir;
      confidence[i] = candidateConf;

      const actionLabel = candidateDir === 1 ? "BUY" : "SELL";
      events.push({
        barIndex: i,
        timestamp: bar.timestamp,
        datetime: bar.datetime,
        action: actionLabel,
        direction: candidateDir,
        setupId: candidateSetup,
        setupName: STRATEGY_SETUP_META[candidateSetup].name,
        shortLabel: `${actionLabel} • ${STRATEGY_SETUP_META[candidateSetup].shortName}`,
        confidence: Math.round(candidateConf),
        priceXauusd: gNow,
        priceCross: bar.xaueur,
        priceFx: bar.eurusd,
        stopLossXauusd: activeStop,
        takeProfitXauusd: activeTp,
        spineXauusd: gSpine,
        isoCutEfficiency: cutEff,
        levyArea: lNow,
        curvature: kNow,
        velocity: vNow,
        basinDist,
        regimeId: regNow,
        rationale: candidateReason,
      });
    } else {
      // Ambient regime confidence when holding or flat
      confidence[i] =
        currPos !== 0
          ? clamp(confidence[i - 1] * 0.96 + 2.5, 40, 95)
          : clamp(25 + coilNow * 0.35, 15, 65);
    }

    position[i] = currPos;
    activeSetupId[i] = currPos !== 0 ? currSetup : 0;
    stopLossSeries[i] = activeStop;
    takeProfitSeries[i] = activeTp;
  }

  const summary = buildSummaryFromSlice(
    events,
    trades,
    equityCurvePct,
    drawdownPct
  );

  const result: WhitepaperStrategyResult = {
    signalDir,
    position,
    activeSetupId,
    confidence,
    fakeoutFiltered,
    spineXauusd,
    signedSpineZ,
    isoNormalVel,
    isoTangentVel,
    isoCutEfficiency,
    stopLossSeries,
    takeProfitSeries,
    equityCurvePct,
    equityCurveUsd,
    drawdownPct,
    events,
    trades,
    summary,
    crossProxy,
  };
  const last = series[len - 1];
  const cacheKey = `${len}:${pair}:${period}:${maType}:${coilThreshold}:${curvatureHookThreshold}:${vacuumDistThreshold}:${minConfidence}:${cooldownBars}:${costRate}:${enableS1}:${enableS2}:${enableS3}:${enableS4}:${enableS5}:${enableCrossProxy}:${proxyKeys}:${last.timestamp}:${last.xauusd}`;
  let subMap = strategyCache.get(series);
  if (!subMap) {
    subMap = new Map();
    strategyCache.set(series, subMap);
  }
  subMap.set(cacheKey, result);
  return result;
}

export function buildSummaryFromSlice(
  events: StrategySignalEvent[],
  trades: CompletedTrade[],
  equityCurvePct: Float64Array,
  drawdownPct: Float64Array,
  effectiveEndInput?: number
): StrategyBacktestSummary {
  const maxIdx =
    effectiveEndInput !== undefined
      ? Math.min(equityCurvePct.length, effectiveEndInput) - 1
      : equityCurvePct.length - 1;

  const visibleEvents =
    effectiveEndInput !== undefined
      ? events.filter((e) => e.barIndex <= maxIdx)
      : events;
  const visibleTrades =
    effectiveEndInput !== undefined
      ? trades.filter((t) => t.exitIndex <= maxIdx)
      : trades;

  const setupBreakdown: Record<
    StrategySetupId,
    { count: number; wins: number; netPnlUsd: number }
  > = {
    1: { count: 0, wins: 0, netPnlUsd: 0 },
    2: { count: 0, wins: 0, netPnlUsd: 0 },
    3: { count: 0, wins: 0, netPnlUsd: 0 },
    4: { count: 0, wins: 0, netPnlUsd: 0 },
    5: { count: 0, wins: 0, netPnlUsd: 0 },
  };

  let winningTrades = 0;
  let losingTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalNetPnlUsd = 0;

  for (const t of visibleTrades) {
    const bucket = setupBreakdown[t.setupId];
    if (bucket) {
      bucket.count += 1;
      bucket.netPnlUsd += t.pnlUsd;
      if (t.pnlUsd > 0) bucket.wins += 1;
    }
    totalNetPnlUsd += t.pnlUsd;
    if (t.pnlUsd > 0) {
      winningTrades += 1;
      grossProfit += t.pnlUsd;
    } else {
      losingTrades += 1;
      grossLoss += Math.abs(t.pnlUsd);
    }
  }

  const totalTrades = visibleTrades.length;
  const winRatePct = totalTrades > 0 ? (winningTrades / totalTrades) * 100.0 : 0;
  const profitFactor =
    grossLoss > 1e-6
      ? grossProfit / grossLoss
      : grossProfit > 0
      ? 9.99
      : 0;
  const expectancyUsd = totalTrades > 0 ? totalNetPnlUsd / totalTrades : 0;

  let maxDrawdownPct = 0;
  for (let i = 0; i <= maxIdx && i < drawdownPct.length; i++) {
    if (drawdownPct[i] > maxDrawdownPct) {
      maxDrawdownPct = drawdownPct[i];
    }
  }

  const totalReturnPct =
    maxIdx >= 0 && maxIdx < equityCurvePct.length
      ? equityCurvePct[maxIdx]
      : 0;

  // Compute trade-level Sharpe ratio
  let sharpeRatio = 0;
  if (totalTrades >= 2) {
    let sumR = 0;
    let sumR2 = 0;
    for (const t of visibleTrades) {
      sumR += t.returnPct;
      sumR2 += t.returnPct * t.returnPct;
    }
    const meanR = sumR / totalTrades;
    const varR = Math.max(0, sumR2 / totalTrades - meanR * meanR);
    const stdR = Math.sqrt(varR);
    if (stdR > 1e-6) {
      sharpeRatio = (meanR / stdR) * Math.sqrt(Math.min(252, totalTrades * 4));
    }
  }

  let buyCount = 0;
  let sellCount = 0;
  let blockedFakeouts = 0;
  for (const e of visibleEvents) {
    if (e.action === "BUY") buyCount += 1;
    else if (e.action === "SELL") sellCount += 1;
    else if (e.action === "FILTERED") blockedFakeouts += 1;
  }

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRatePct,
    profitFactor,
    totalNetPnlUsd,
    totalReturnPct,
    maxDrawdownPct,
    sharpeRatio,
    expectancyUsd,
    blockedFakeouts,
    buyCount,
    sellCount,
    setupBreakdown,
  };
}
