import {
  MarketBar,
  PhaseRegimeId,
  TRIAD_CONFIGS,
  TriadPairId,
} from "@/types/market";
import {
  computePhaseClusters,
  computePhaseGeometry3D,
  computeVectorMA,
  PhaseClusterResult,
  PhaseGeometry3DResult,
  VectorMAResult,
} from "./math";

export interface CrossProxyBounceLevel {
  priceXauusd: number;
  distanceUsd: number;
  distanceSigma: number;
  role: "SUPPORT" | "RESISTANCE" | "EQUILIBRIUM";
  kind:
    | "SPINE_EQ"
    | "CROSS_GOLD_RAIL_2S"
    | "CROSS_GOLD_RAIL_1_5S"
    | "ATTRACTOR_BASIN"
    | "MULTI_HORIZON_SPINE";
  pair: TriadPairId;
  label: string;
  strength: number;
}

export interface CrossProxyConfluenceZone {
  centerPriceXauusd: number;
  bandLowXauusd: number;
  bandHighXauusd: number;
  distanceUsd: number;
  distanceSigma: number;
  role: "SUPPORT" | "RESISTANCE" | "EQUILIBRIUM";
  confluenceScore: number;
  bounceProbabilityPct: number;
  contributingCount: number;
  contributors: string[];
}

export interface ProxyTriadSnapshot {
  pair: TriadPairId;
  xTicker: string;
  yTicker: string;
  crossGoldZ: number;
  fxZ: number;
  spineXauusd: number;
  lowerRail2SigmaXauusd: number;
  upperRail2SigmaXauusd: number;
  isoCutEfficiency: number;
  levyArea: number;
  regimeId: PhaseRegimeId;
  signalAgreement: 1 | -1 | 0;
}

export interface CrossProxyConfluenceOptions {
  primaryPair?: TriadPairId;
  period?: number;
  maType?: "SMA" | "EMA";
  crossProxySeries?: Partial<Record<TriadPairId, MarketBar[]>>;
  effectiveEnd?: number;
  precomputedMA?: VectorMAResult;
  precomputedGeo?: PhaseGeometry3DResult;
  precomputedClusters?: PhaseClusterResult;
}

export interface CrossProxyConfluenceResult {
  /** Causal [-1, +1] intrinsic Cross-Gold breadth across proxy legs and horizons at bar i */
  bullionBreadth: Float64Array;
  /** Causal [-1, +1] quote-normalized chirality & orthogonal cut consensus (>0 = Bullion-led, <0 = FX-led) */
  chiralityConsensus: Float64Array;
  /** Causal multi-proxy / multi-horizon consensus 3D Spine equilibrium XAUUSD ($/oz) */
  consensusSpineXauusd: Float64Array;
  /** Causal signed Z-score of XAUUSD relative to consensusSpineXauusd */
  consensusSpineZ: Float64Array;
  /** Causal nearest high-probability Cross-Proxy Support Bounce level ($/oz) below price at bar i */
  nearestSupportXauusd: Float64Array;
  /** Causal nearest high-probability Cross-Proxy Resistance Bounce level ($/oz) above price at bar i */
  nearestResistanceXauusd: Float64Array;
  /** Causal confluence score (0..100) of nearest support bounce zone at bar i */
  supportConfluenceScore: Float64Array;
  /** Causal confluence score (0..100) of nearest resistance bounce zone at bar i */
  resistanceConfluenceScore: Float64Array;
  /** Causal [-1, +1] Cross-Proxy Rail Bounce impulse (>0 = bouncing off support rail, <0 = rejecting off resistance rail) */
  bounceSignalBias: Float64Array;
  /** Number of synchronized G10 triads analyzed (1..6) */
  proxyCount: number;
  /** Per-triad diagnostic snapshots at effectiveEnd - 1 */
  latestTriadSnapshots: ProxyTriadSnapshot[];
  /** Ranked High-Probability XAUUSD Bounce Confluence Zones at effectiveEnd - 1 */
  latestBounceZones: CrossProxyConfluenceZone[];
  /** All projected raw structural XAUUSD levels at effectiveEnd - 1 */
  latestRawLevels: CrossProxyBounceLevel[];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function fastTanh(x: number): number {
  if (x <= -3) return -1;
  if (x >= 3) return 1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

interface InternalProxyPrecomp {
  pair: TriadPairId;
  series: MarketBar[];
  quoteSign: number;
  quoteMode: "CCY_USD" | "USD_CCY";
  normX: Float64Array;
  normY: Float64Array;
  levyArea: Float64Array;
  meanX: Float64Array;
  stdX: Float64Array;
  spineG: Float64Array;
  basinG: Float64Array;
  cutEff: Float64Array;
  vNorm: Float64Array;
  preClusters?: PhaseClusterResult;
}

const precompCache = new WeakMap<
  MarketBar[],
  Map<string, InternalProxyPrecomp>
>();

function buildInternalProxyPrecomp(
  series: MarketBar[],
  pair: TriadPairId,
  period: number,
  maType: "SMA" | "EMA",
  preMA?: VectorMAResult,
  preGeo?: PhaseGeometry3DResult,
  preClusters?: PhaseClusterResult
): InternalProxyPrecomp {
  const len = series.length;
  if (len > 0) {
    const last = series[len - 1];
    const cacheKey = `${len}:${pair}:${period}:${maType}:${last.timestamp}:${last.xauusd}`;
    const existing = precompCache.get(series)?.get(cacheKey);
    if (existing) return existing;
  }
  const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
  const quoteSign = triad.quoteMode === "CCY_USD" ? 1.0 : -1.0;

  const normX = preGeo ? preGeo.normX : new Float64Array(len);
  const normY = preGeo ? preGeo.normY : new Float64Array(len);
  const levyArea = preGeo ? preGeo.levyArea : new Float64Array(len);
  const instLevy = preGeo ? null : new Float64Array(len);

  const meanX = new Float64Array(len);
  const stdX = new Float64Array(len);
  const spineG = new Float64Array(len);
  const basinG = new Float64Array(len);
  const cutEff = new Float64Array(len);
  const vNorm = new Float64Array(len);

  let sumX = 0;
  let sumX2 = 0;
  let sumY = 0;
  let sumY2 = 0;
  let levySum = 0;
  let emaMaX = 0;
  let emaMaY = 0;
  const alphaMa = 2 / (period + 1);
  let prevEmaVx = 0;
  let prevEmaVy = 0;
  const invSqrt2 = Math.SQRT1_2;

  // Causal 3-node spatial attractor centers in standardized (x̃, ỹ) phase space (register scalars)
  let n0x = -0.9,
    n0y = 0.6;
  let n1x = 0.0,
    n1y = 0.0;
  let n2x = 0.9,
    n2y = -0.6;

  for (let i = 0; i < len; i++) {
    const b = series[i];
    const vx = b.xaueur;
    const vy = b.eurusd;
    sumX += vx;
    sumX2 += vx * vx;
    sumY += vy;
    sumY2 += vy * vy;

    if (i >= period) {
      const ox = series[i - period].xaueur;
      const oy = series[i - period].eurusd;
      sumX -= ox;
      sumX2 -= ox * ox;
      sumY -= oy;
      sumY2 -= oy * oy;
    }

    const nWin = Math.min(i + 1, period);
    const mx = sumX / nWin;
    const my = sumY / nWin;
    const stdXRaw = Math.sqrt(Math.max(0, sumX2 / nWin - mx * mx));
    const stdYRaw = Math.sqrt(Math.max(0, sumY2 / nWin - my * my));
    const sx = Math.max(Math.abs(mx) * 0.0004, stdXRaw);
    const sy = Math.max(Math.abs(my) * 0.0004, stdYRaw);

    meanX[i] = mx;
    stdX[i] = sx;

    let nx: number;
    let ny: number;
    if (preGeo) {
      nx = normX[i];
      ny = normY[i];
    } else {
      let scaleX = Math.abs(mx) * 1e-4 || 1e-6;
      let scaleY = Math.abs(my) * 1e-4 || 1e-6;
      if (nWin >= 2) {
        if (stdXRaw > 1e-9) scaleX = stdXRaw;
        if (stdYRaw > 1e-9) scaleY = stdYRaw;
        nx = (vx - mx) / scaleX;
        ny = (vy - my) / scaleY;
      } else {
        nx = 0;
        ny = 0;
      }
      normX[i] = nx;
      normY[i] = ny;
      if (i >= 1 && instLevy) {
        const stepLevy = 0.5 * (normX[i - 1] * ny - normY[i - 1] * nx);
        instLevy[i] = stepLevy;
        levySum += stepLevy;
        if (i >= period) {
          levySum -= instLevy[i - period];
        }
        levyArea[i] = levySum;
      }
    }

    let maX: number;
    let maY: number;
    if (preMA) {
      maX = preMA.xMA[i] || vx;
      maY = preMA.yMA[i] || vy;
    } else if (maType === "EMA") {
      emaMaX = i === 0 ? vx : alphaMa * vx + (1 - alphaMa) * emaMaX;
      emaMaY = i === 0 ? vy : alphaMa * vy + (1 - alphaMa) * emaMaY;
      maX = emaMaX;
      maY = emaMaY;
    } else {
      maX = mx;
      maY = my;
    }
    spineG[i] =
      triad.quoteMode === "CCY_USD"
        ? maX * maY
        : maX / Math.max(1e-9, maY);

    // Causal spatial attractor basin center projected onto XAUUSD
    const d0 = (nx - n0x) * (nx - n0x) + (ny - n0y) * (ny - n0y);
    const d1 = (nx - n1x) * (nx - n1x) + (ny - n1y) * (ny - n1y);
    const d2 = (nx - n2x) * (nx - n2x) + (ny - n2y) * (ny - n2y);

    let bxNode: number;
    let byNode: number;
    if (d0 <= d1 && d0 <= d2) {
      n0x = 0.92 * n0x + 0.08 * nx;
      n0y = 0.92 * n0y + 0.08 * ny;
      bxNode = n0x;
      byNode = n0y;
    } else if (d1 <= d2) {
      n1x = 0.92 * n1x + 0.08 * nx;
      n1y = 0.92 * n1y + 0.08 * ny;
      bxNode = n1x;
      byNode = n1y;
    } else {
      n2x = 0.92 * n2x + 0.08 * nx;
      n2y = 0.92 * n2y + 0.08 * ny;
      bxNode = n2x;
      byNode = n2y;
    }

    const basinCenterX = mx + bxNode * sx;
    const basinCenterY = my + byNode * sy;
    basinG[i] =
      triad.quoteMode === "CCY_USD"
        ? basinCenterX * basinCenterY
        : basinCenterX / Math.max(1e-9, basinCenterY);

    if (i >= 1) {
      const dx = nx - normX[i - 1];
      const dy = ny - normY[i - 1];
      const emaVx = i === 1 ? dx : 0.5 * dx + 0.5 * prevEmaVx;
      const emaVy = i === 1 ? dy : 0.5 * dy + 0.5 * prevEmaVy;
      prevEmaVx = emaVx;
      prevEmaVy = emaVy;

      const vn = (emaVx + quoteSign * emaVy) * invSqrt2;
      const vt = (emaVx - quoteSign * emaVy) * invSqrt2;
      vNorm[i] = vn;
      const mag = Math.sqrt(vn * vn + vt * vt);
      const crossReinforces = emaVx * vn >= 0 ? 1.0 : 0.65;
      cutEff[i] =
        mag > 1e-9 ? clamp((Math.abs(vn) / mag) * crossReinforces, 0, 1) : 0.5;
    } else {
      cutEff[i] = 0.5;
    }
  }

  const res: InternalProxyPrecomp = {
    pair,
    series,
    quoteSign,
    quoteMode: triad.quoteMode,
    normX,
    normY,
    levyArea,
    meanX,
    stdX,
    spineG,
    basinG,
    cutEff,
    vNorm,
    preClusters,
  };
  if (len > 0) {
    const last = series[len - 1];
    const cacheKey = `${len}:${pair}:${period}:${maType}:${last.timestamp}:${last.xauusd}`;
    let subMap = precompCache.get(series);
    if (!subMap) {
      subMap = new Map();
      precompCache.set(series, subMap);
    }
    subMap.set(cacheKey, res);
  }
  return res;
}

const companionSeriesCache = new WeakMap<
  MarketBar[],
  Map<TriadPairId, Record<TriadPairId, MarketBar[]>>
>();

/**
 * Generates deterministic, causally synchronized companion G10 triad series from a primary series
 * when live multi-pair series are not explicitly supplied. Uses the exact shared XAUUSD path and
 * constructs realistic, strictly causal cross-currency trajectories anchored to each G10 triad's
 * empirical USD beta and carry-orbit phase.
 */
export function synthesizeCompanionProxySeries(
  primarySeries: MarketBar[],
  primaryPair: TriadPairId = "EUR"
): Record<TriadPairId, MarketBar[]> {
  if (primarySeries.length > 0) {
    const existing = companionSeriesCache.get(primarySeries)?.get(primaryPair);
    if (existing) return existing;
  }

  const allPairs: TriadPairId[] = ["EUR", "JPY", "GBP", "CHF", "AUD", "CAD"];
  const out = {} as Record<TriadPairId, MarketBar[]>;
  const len = primarySeries.length;
  const primConfig = TRIAD_CONFIGS[primaryPair] ?? TRIAD_CONFIGS.EUR;
  const primSign = primConfig.quoteMode === "CCY_USD" ? 1.0 : -1.0;

  for (const pair of allPairs) {
    if (pair === primaryPair) {
      out[pair] = primarySeries;
      continue;
    }
    const cfg = TRIAD_CONFIGS[pair];
    const targetSign = cfg.quoteMode === "CCY_USD" ? 1.0 : -1.0;
    // Empirical G10 USD-leg beta & commodity/safe-haven sensitivity relative to primary FX leg
    const pairBeta =
      pair === "GBP"
        ? 0.88
        : pair === "CHF"
        ? 0.92
        : pair === "AUD"
        ? 1.18
        : pair === "CAD"
        ? 0.76
        : pair === "JPY"
        ? 0.84
        : 1.0;
    const goldBeta =
      pair === "AUD"
        ? 0.22
        : pair === "CAD"
        ? 0.14
        : pair === "CHF"
        ? 0.12
        : pair === "JPY"
        ? 0.1
        : 0.05;

    const bars: MarketBar[] = new Array(len);
    let fxLevel = cfg.defaultFxRate;

    for (let i = 0; i < len; i++) {
      const b = primarySeries[i];
      if (i >= 1) {
        const prevB = primarySeries[i - 1];
        const dLnG =
          prevB.xauusd > 0 ? Math.log(b.xauusd / prevB.xauusd) : 0;
        const dLnPrimFx =
          prevB.eurusd > 0
            ? Math.log(b.eurusd / prevB.eurusd) * primSign
            : 0;
        // USD-standardized FX log return + commodity/haven gold coupling
        const dLnTargetUsdCcy =
          pairBeta * dLnPrimFx + goldBeta * (dLnG - dLnPrimFx);
        const signedLogChange = targetSign * dLnTargetUsdCcy;
        fxLevel = fxLevel * Math.exp(clamp(signedLogChange, -0.05, 0.05));
      }
      const xau = b.xauusd;
      const cross =
        cfg.quoteMode === "CCY_USD"
          ? xau / Math.max(1e-9, fxLevel)
          : xau * fxLevel;
      bars[i] = {
        timestamp: b.timestamp,
        datetime: b.datetime,
        xauusd: xau,
        eurusd: fxLevel,
        xaueur: cross,
        usdeur: 1 / Math.max(1e-9, fxLevel),
        source: b.source,
      };
    }
    out[pair] = bars;
  }

  if (primarySeries.length > 0) {
    let subMap = companionSeriesCache.get(primarySeries);
    if (!subMap) {
      subMap = new Map();
      companionSeriesCache.set(primarySeries, subMap);
    }
    subMap.set(primaryPair, out);
  }

  return out;
}

/**
 * Clusters raw projected XAUUSD levels at bar `i` into ranked High-Probability Bounce Zones
 * using a bandwidth of `0.38 * stdG`.
 */
function clusterLevelsIntoZones(
  levels: CrossProxyBounceLevel[],
  currentG: number,
  stdG: number,
  bounceBiasAtBar: number
): CrossProxyConfluenceZone[] {
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => a.priceXauusd - b.priceXauusd);
  const clusterRadius = Math.max(currentG * 0.0006, 0.38 * stdG);

  const rawClusters: CrossProxyBounceLevel[][] = [];
  let currentCluster: CrossProxyBounceLevel[] = [sorted[0]];

  for (let k = 1; k < sorted.length; k++) {
    const lvl = sorted[k];
    const clusterMean =
      currentCluster.reduce((acc, item) => acc + item.priceXauusd, 0) /
      currentCluster.length;
    if (Math.abs(lvl.priceXauusd - clusterMean) <= clusterRadius) {
      currentCluster.push(lvl);
    } else {
      rawClusters.push(currentCluster);
      currentCluster = [lvl];
    }
  }
  rawClusters.push(currentCluster);

  const zones: CrossProxyConfluenceZone[] = rawClusters.map((group) => {
    let wSum = 0;
    let pSum = 0;
    let minP = Infinity;
    let maxP = -Infinity;
    const distinctPairs = new Set<TriadPairId>();
    const distinctKinds = new Set<string>();
    const contributors: string[] = [];

    for (const item of group) {
      const w = Math.max(10, item.strength);
      wSum += w;
      pSum += item.priceXauusd * w;
      if (item.priceXauusd < minP) minP = item.priceXauusd;
      if (item.priceXauusd > maxP) maxP = item.priceXauusd;
      distinctPairs.add(item.pair);
      distinctKinds.add(item.kind);
      if (!contributors.includes(item.label)) {
        contributors.push(item.label);
      }
    }

    const centerPrice = wSum > 0 ? pSum / wSum : group[0].priceXauusd;
    const distUsd = centerPrice - currentG;
    const distSigma = distUsd / Math.max(1e-6, stdG);

    const role: "SUPPORT" | "RESISTANCE" | "EQUILIBRIUM" =
      Math.abs(distSigma) <= 0.22
        ? "EQUILIBRIUM"
        : distUsd < 0
        ? "SUPPORT"
        : "RESISTANCE";

    const avgStrength = wSum / group.length;
    const pairBonus = (distinctPairs.size - 1) * 11;
    const kindBonus = (distinctKinds.size - 1) * 9;
    const countBonus = Math.min(24, (group.length - 1) * 7);
    const confluenceScore = Math.round(
      clamp(avgStrength * 0.65 + pairBonus + kindBonus + countBonus, 25, 99)
    );

    const biasBonus =
      (role === "SUPPORT" && bounceBiasAtBar > 0) ||
      (role === "RESISTANCE" && bounceBiasAtBar < 0)
        ? Math.abs(bounceBiasAtBar) * 12
        : 0;
    const bounceProbabilityPct = Math.round(
      clamp(38 + confluenceScore * 0.48 + biasBonus, 35, 94)
    );

    const halfPad = Math.max(0.08 * stdG, (maxP - minP) * 0.5);
    return {
      centerPriceXauusd: centerPrice,
      bandLowXauusd: Math.min(minP, centerPrice - halfPad),
      bandHighXauusd: Math.max(maxP, centerPrice + halfPad),
      distanceUsd: distUsd,
      distanceSigma: distSigma,
      role,
      confluenceScore,
      bounceProbabilityPct,
      contributingCount: group.length,
      contributors: contributors.slice(0, 5),
    };
  });

  return zones.sort((a, b) => b.confluenceScore - a.confluenceScore);
}

const crossProxyCache = new WeakMap<
  MarketBar[],
  Map<string, CrossProxyConfluenceResult>
>();

/**
 * Milestone 2: Causal Multi-Proxy Cross-Confirmation & Implied XAUUSD Bounce Confluence Engine.
 * Evaluates G10 Gold-FX triads (EUR, JPY, GBP, CHF, AUD, CAD) and multi-horizon 3D spines
 * in strictly causal O(N) time (zero lookahead bias).
 */
export function computeCrossProxyConfluence(
  primarySeries: MarketBar[],
  options: CrossProxyConfluenceOptions = {}
): CrossProxyConfluenceResult {
  const len = primarySeries.length;
  const primaryPair: TriadPairId = options.primaryPair ?? "EUR";
  const period = Math.max(5, Math.min(300, Math.floor(options.period ?? 20)));
  const maType = options.maType ?? "SMA";
  const effectiveEnd = Math.max(
    0,
    Math.min(len, options.effectiveEnd ?? len)
  );
  const proxyKeys = options.crossProxySeries
    ? Object.keys(options.crossProxySeries).sort().join(",")
    : "single";

  if (len > 0) {
    const last = primarySeries[len - 1];
    const cacheKey = `${len}:${primaryPair}:${period}:${maType}:${effectiveEnd}:${proxyKeys}:${last.timestamp}:${last.xauusd}`;
    const existing = crossProxyCache.get(primarySeries)?.get(cacheKey);
    if (existing) return existing;
  }

  const bullionBreadth = new Float64Array(len);
  const chiralityConsensus = new Float64Array(len);
  const consensusSpineXauusd = new Float64Array(len);
  const consensusSpineZ = new Float64Array(len);
  const nearestSupportXauusd = new Float64Array(len);
  const nearestResistanceXauusd = new Float64Array(len);
  const supportConfluenceScore = new Float64Array(len);
  const resistanceConfluenceScore = new Float64Array(len);
  const bounceSignalBias = new Float64Array(len);

  if (len === 0) {
    return {
      bullionBreadth,
      chiralityConsensus,
      consensusSpineXauusd,
      consensusSpineZ,
      nearestSupportXauusd,
      nearestResistanceXauusd,
      supportConfluenceScore,
      resistanceConfluenceScore,
      bounceSignalBias,
      proxyCount: 0,
      latestTriadSnapshots: [],
      latestBounceZones: [],
      latestRawLevels: [],
    };
  }

  // Assemble proxy triads: always include primaryPair; include any supplied crossProxySeries with matching length
  const proxyPrecomps: InternalProxyPrecomp[] = [];
  const primaryPrecomp = buildInternalProxyPrecomp(
    primarySeries,
    primaryPair,
    period,
    maType,
    options.precomputedMA,
    options.precomputedGeo,
    options.precomputedClusters
  );
  proxyPrecomps.push(primaryPrecomp);

  if (options.crossProxySeries) {
    const allPairs: TriadPairId[] = ["EUR", "JPY", "GBP", "CHF", "AUD", "CAD"];
    for (const pair of allPairs) {
      if (pair === primaryPair) continue;
      const candidate = options.crossProxySeries[pair];
      if (candidate && candidate.length === len) {
        proxyPrecomps.push(
          buildInternalProxyPrecomp(candidate, pair, period, maType)
        );
      }
    }
  }

  // Also compute causal Fast (period/2) and Slow (period*2) structural 3D Spines on primarySeries
  // in O(1) per bar so multi-horizon structural confluence is always present with zero overhead
  const fastPeriod = Math.max(5, Math.floor(period / 2));
  const slowPeriod = Math.min(300, period * 2);
  const fastSpineArr = new Float64Array(len);
  const slowSpineArr = new Float64Array(len);

  let sumFastX = 0;
  let sumFastY = 0;
  let sumSlowX = 0;
  let sumSlowY = 0;

  let sumG = 0;
  let sumG2 = 0;
  const kCount = proxyPrecomps.length;

  for (let i = 0; i < len; i++) {
    const pBar = primarySeries[i];
    const gNow = pBar.xauusd;
    sumG += gNow;
    sumG2 += gNow * gNow;
    if (i >= period) {
      const oldG = primarySeries[i - period].xauusd;
      sumG -= oldG;
      sumG2 -= oldG * oldG;
    }
    const nWin = Math.min(i + 1, period);
    const meanG = sumG / nWin;
    const stdG = Math.max(
      gNow * 0.0005,
      Math.sqrt(Math.max(0, sumG2 / nWin - meanG * meanG))
    );

    sumFastX += pBar.xaueur;
    sumFastY += pBar.eurusd;
    if (i >= fastPeriod) {
      sumFastX -= primarySeries[i - fastPeriod].xaueur;
      sumFastY -= primarySeries[i - fastPeriod].eurusd;
    }
    const nFast = Math.min(i + 1, fastPeriod);
    const fastMx = sumFastX / nFast;
    const fastMy = sumFastY / nFast;

    sumSlowX += pBar.xaueur;
    sumSlowY += pBar.eurusd;
    if (i >= slowPeriod) {
      sumSlowX -= primarySeries[i - slowPeriod].xaueur;
      sumSlowY -= primarySeries[i - slowPeriod].eurusd;
    }
    const nSlow = Math.min(i + 1, slowPeriod);
    const slowMx = sumSlowX / nSlow;
    const slowMy = sumSlowY / nSlow;

    const fastSpineG =
      primaryPrecomp.quoteMode === "CCY_USD"
        ? fastMx * fastMy
        : fastMx / Math.max(1e-9, fastMy);
    const slowSpineG =
      primaryPrecomp.quoteMode === "CCY_USD"
        ? slowMx * slowMy
        : slowMx / Math.max(1e-9, slowMy);
    fastSpineArr[i] = fastSpineG;
    slowSpineArr[i] = slowSpineG;

    // 1. Causal Intrinsic Bullion Breadth & Chirality Consensus across proxy triads
    let breadthAcc = 0;
    let chiralityAcc = 0;
    let proxySpineSum = 0;

    let bestSupPrice = gNow - 1.5 * stdG;
    let bestSupScore = 35;
    let bestResPrice = gNow + 1.5 * stdG;
    let bestResScore = 35;

    let supCandidateDist = Infinity;
    let resCandidateDist = Infinity;
    let supConfluenceCount = 0;
    let resConfluenceCount = 0;
    let railBounceImpulse = 0;

    for (let p = 0; p < kCount; p++) {
      const pc = proxyPrecomps[p];
      const b = pc.series[i];
      const nx = pc.normX[i];
      const prevNx = i >= 1 ? pc.normX[i - 1] : nx;
      const dx = nx - prevNx;

      // Cross-Gold velocity + position relative to spine
      const crossMoveSignal = fastTanh(1.35 * dx + 0.35 * nx);
      breadthAcc += crossMoveSignal;

      // Quote-invariant chirality & orthogonal cut consensus
      const normLevy = pc.levyArea[i] * pc.quoteSign;
      const cutCentered = (pc.cutEff[i] - 0.5) * 2.0;
      chiralityAcc += fastTanh(0.45 * normLevy + 0.85 * cutCentered);

      const pSpine = pc.spineG[i];
      proxySpineSum += pSpine;

      // Project Cross-Gold ±1.5σ and ±2.0σ Bollinger Rails and Basin onto XAUUSD
      const mx = pc.meanX[i];
      const sx = pc.stdX[i];
      const spotY = Math.max(1e-9, b.eurusd);

      const railLow15 =
        pc.quoteMode === "CCY_USD"
          ? (mx - 1.5 * sx) * spotY
          : (mx - 1.5 * sx) / spotY;
      const railHigh15 =
        pc.quoteMode === "CCY_USD"
          ? (mx + 1.5 * sx) * spotY
          : (mx + 1.5 * sx) / spotY;
      const railLow20 =
        pc.quoteMode === "CCY_USD"
          ? (mx - 2.0 * sx) * spotY
          : (mx - 2.0 * sx) / spotY;
      const railHigh20 =
        pc.quoteMode === "CCY_USD"
          ? (mx + 2.0 * sx) * spotY
          : (mx + 2.0 * sx) / spotY;

      const checkCandidate = (lvl: number) => {
        const diff = lvl - gNow;
        if (diff < -0.12 * stdG && diff > -3.2 * stdG) {
          supConfluenceCount++;
          const dAbs = -diff;
          if (dAbs < supCandidateDist) {
            supCandidateDist = dAbs;
            bestSupPrice = lvl;
          }
        } else if (diff > 0.12 * stdG && diff < 3.2 * stdG) {
          resConfluenceCount++;
          if (diff < resCandidateDist) {
            resCandidateDist = diff;
            bestResPrice = lvl;
          }
        }
      };

      checkCandidate(pSpine);
      checkCandidate(pc.basinG[i]);
      checkCandidate(railLow15);
      checkCandidate(railLow20);
      checkCandidate(railHigh15);
      checkCandidate(railHigh20);

      // Check if this proxy's Cross-Gold leg is actively bouncing off its ±1.35σ..2.0σ rail
      const stretchX = Math.abs(prevNx) >= Math.abs(nx) ? prevNx : nx;
      if (stretchX <= -1.3 && dx > 0.08) {
        railBounceImpulse += clamp(Math.abs(stretchX) * 0.45 + dx * 0.8, 0, 1.5);
      } else if (stretchX >= 1.3 && dx < -0.08) {
        railBounceImpulse -= clamp(
          Math.abs(stretchX) * 0.45 + Math.abs(dx) * 0.8,
          0,
          1.5
        );
      }
    }

    // Include multi-horizon structural spines (fastSpineG, slowSpineG) in support/resistance search
    const diffFast = fastSpineG - gNow;
    if (diffFast < -0.12 * stdG && diffFast > -3.2 * stdG) {
      supConfluenceCount++;
      if (-diffFast < supCandidateDist) {
        supCandidateDist = -diffFast;
        bestSupPrice = fastSpineG;
      }
    } else if (diffFast > 0.12 * stdG && diffFast < 3.2 * stdG) {
      resConfluenceCount++;
      if (diffFast < resCandidateDist) {
        resCandidateDist = diffFast;
        bestResPrice = fastSpineG;
      }
    }

    const diffSlow = slowSpineG - gNow;
    if (diffSlow < -0.12 * stdG && diffSlow > -3.2 * stdG) {
      supConfluenceCount++;
      if (-diffSlow < supCandidateDist) {
        supCandidateDist = -diffSlow;
        bestSupPrice = slowSpineG;
      }
    } else if (diffSlow > 0.12 * stdG && diffSlow < 3.2 * stdG) {
      resConfluenceCount++;
      if (diffSlow < resCandidateDist) {
        resCandidateDist = diffSlow;
        bestResPrice = slowSpineG;
      }
    }

    // Add slow structural spine alignment to breadth
    const slowTrendSignal = fastTanh(((gNow - slowSpineG) / stdG) * 0.45);
    bullionBreadth[i] = clamp(
      0.75 * (breadthAcc / kCount) + 0.25 * slowTrendSignal,
      -1,
      1
    );
    chiralityConsensus[i] = clamp(chiralityAcc / kCount, -1, 1);

    const proxySpineAvg = proxySpineSum / kCount;
    const consSpine =
      0.5 * proxySpineAvg + 0.38 * slowSpineG + 0.12 * fastSpineG;
    consensusSpineXauusd[i] = consSpine;
    consensusSpineZ[i] = clamp((gNow - consSpine) / stdG, -5, 5);

    nearestSupportXauusd[i] = bestSupPrice;
    nearestResistanceXauusd[i] = bestResPrice;

    bestSupScore = clamp(
      38 + supConfluenceCount * (14 / Math.sqrt(kCount)) + (railBounceImpulse > 0 ? 14 : 0),
      25,
      98
    );
    bestResScore = clamp(
      38 + resConfluenceCount * (14 / Math.sqrt(kCount)) + (railBounceImpulse < 0 ? 14 : 0),
      25,
      98
    );
    supportConfluenceScore[i] = bestSupScore;
    resistanceConfluenceScore[i] = bestResScore;
    bounceSignalBias[i] = clamp(railBounceImpulse / Math.sqrt(kCount), -1, 1);
  }

  // Build rich snapshot & clustered bounce zones at `snapIdx = effectiveEnd - 1`
  const snapIdx = Math.max(0, effectiveEnd - 1);
  const currentG = primarySeries[snapIdx].xauusd;

  // Compute causal stdG at snapIdx
  let snapSumG = 0;
  let snapSumG2 = 0;
  const winStart = Math.max(0, snapIdx - period + 1);
  const winCount = snapIdx - winStart + 1;
  for (let j = winStart; j <= snapIdx; j++) {
    const g = primarySeries[j].xauusd;
    snapSumG += g;
    snapSumG2 += g * g;
  }
  const snapMeanG = snapSumG / winCount;
  const snapStdG = Math.max(
    currentG * 0.0005,
    Math.sqrt(Math.max(0, snapSumG2 / winCount - snapMeanG * snapMeanG))
  );

  const latestTriadSnapshots: ProxyTriadSnapshot[] = [];
  const latestRawLevels: CrossProxyBounceLevel[] = [];

  for (let p = 0; p < kCount; p++) {
    const pc = proxyPrecomps[p];
    const triad = TRIAD_CONFIGS[pc.pair];
    const b = pc.series[snapIdx];
    const mx = pc.meanX[snapIdx];
    const sx = pc.stdX[snapIdx];
    const spotY = Math.max(1e-9, b.eurusd);
    const pSpine = pc.spineG[snapIdx];
    const pBasin = pc.basinG[snapIdx];

    const low15 =
      pc.quoteMode === "CCY_USD"
        ? (mx - 1.5 * sx) * spotY
        : (mx - 1.5 * sx) / spotY;
    const high15 =
      pc.quoteMode === "CCY_USD"
        ? (mx + 1.5 * sx) * spotY
        : (mx + 1.5 * sx) / spotY;
    const low20 =
      pc.quoteMode === "CCY_USD"
        ? (mx - 2.0 * sx) * spotY
        : (mx - 2.0 * sx) / spotY;
    const high20 =
      pc.quoteMode === "CCY_USD"
        ? (mx + 2.0 * sx) * spotY
        : (mx + 2.0 * sx) / spotY;

    const nx = pc.normX[snapIdx];
    const ny = pc.normY[snapIdx];
    const vn = pc.vNorm[snapIdx];
    const levySnap = pc.levyArea[snapIdx];
    const rSnap = Math.sqrt(nx * nx + ny * ny);
    const fallbackRegime: PhaseRegimeId =
      rSnap < 0.85 && Math.abs(vn) < 0.35
        ? 0
        : rSnap > 1.75
        ? 3
        : levySnap * pc.quoteSign >= 0
        ? 1
        : 2;
    const regimeId: PhaseRegimeId = pc.preClusters
      ? ((pc.preClusters.regime[snapIdx] & 3) as PhaseRegimeId)
      : fallbackRegime;
    const sigAgree: 1 | -1 | 0 =
      vn > 0.06 || (nx <= -1.25 && vn > -0.02)
        ? 1
        : vn < -0.06 || (nx >= 1.25 && vn < 0.02)
        ? -1
        : 0;

    latestTriadSnapshots.push({
      pair: pc.pair,
      xTicker: triad.xTicker,
      yTicker: triad.yTicker,
      crossGoldZ: nx,
      fxZ: ny,
      spineXauusd: pSpine,
      lowerRail2SigmaXauusd: low20,
      upperRail2SigmaXauusd: high20,
      isoCutEfficiency: pc.cutEff[snapIdx],
      levyArea: levySnap,
      regimeId,
      signalAgreement: sigAgree,
    });

    const pushLevel = (
      price: number,
      kind: CrossProxyBounceLevel["kind"],
      label: string,
      strength: number
    ) => {
      const distUsd = price - currentG;
      const distSigma = distUsd / snapStdG;
      const role: CrossProxyBounceLevel["role"] =
        Math.abs(distSigma) <= 0.22
          ? "EQUILIBRIUM"
          : distUsd < 0
          ? "SUPPORT"
          : "RESISTANCE";
      latestRawLevels.push({
        priceXauusd: price,
        distanceUsd: distUsd,
        distanceSigma: distSigma,
        role,
        kind,
        pair: pc.pair,
        label,
        strength,
      });
    };

    pushLevel(pSpine, "SPINE_EQ", `${triad.xTicker} 3D Spine`, 78);
    pushLevel(pBasin, "ATTRACTOR_BASIN", `${triad.xTicker} Basin Node`, 72);
    pushLevel(low15, "CROSS_GOLD_RAIL_1_5S", `${triad.xTicker} -1.5σ Rail`, 68);
    pushLevel(high15, "CROSS_GOLD_RAIL_1_5S", `${triad.xTicker} +1.5σ Rail`, 68);
    pushLevel(low20, "CROSS_GOLD_RAIL_2S", `${triad.xTicker} -2.0σ Rail`, 86);
    pushLevel(high20, "CROSS_GOLD_RAIL_2S", `${triad.xTicker} +2.0σ Rail`, 86);
  }

  // Also push Fast and Slow Structural 3D Spines on primary triad
  const fastSpineSnap = fastSpineArr[snapIdx];
  const slowSpineSnap = slowSpineArr[snapIdx];

  for (const [price, label, strength] of [
    [fastSpineSnap, `Fast (${fastPeriod}b) 3D Spine`, 64],
    [slowSpineSnap, `Slow (${slowPeriod}b) Structural Spine`, 84],
  ] as [number, string, number][]) {
    const distUsd = price - currentG;
    const distSigma = distUsd / snapStdG;
    latestRawLevels.push({
      priceXauusd: price,
      distanceUsd: distUsd,
      distanceSigma: distSigma,
      role:
        Math.abs(distSigma) <= 0.22
          ? "EQUILIBRIUM"
          : distUsd < 0
          ? "SUPPORT"
          : "RESISTANCE",
      kind: "MULTI_HORIZON_SPINE",
      pair: primaryPair,
      label,
      strength,
    });
  }

  const latestBounceZones = clusterLevelsIntoZones(
    latestRawLevels,
    currentG,
    snapStdG,
    bounceSignalBias[snapIdx]
  );

  const result: CrossProxyConfluenceResult = {
    bullionBreadth,
    chiralityConsensus,
    consensusSpineXauusd,
    consensusSpineZ,
    nearestSupportXauusd,
    nearestResistanceXauusd,
    supportConfluenceScore,
    resistanceConfluenceScore,
    bounceSignalBias,
    proxyCount: kCount,
    latestTriadSnapshots,
    latestBounceZones,
    latestRawLevels,
  };
  const last = primarySeries[len - 1];
  const cacheKey = `${len}:${primaryPair}:${period}:${maType}:${effectiveEnd}:${proxyKeys}:${last.timestamp}:${last.xauusd}`;
  let map = crossProxyCache.get(primarySeries);
  if (!map) {
    map = new Map();
    crossProxyCache.set(primarySeries, map);
  }
  map.set(cacheKey, result);
  return result;
}
