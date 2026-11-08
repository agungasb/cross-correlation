import {
  MarketBar,
  PhaseRegimeId,
  TimeframeId,
  TRIAD_CONFIGS,
  TriadPairId,
} from "@/types/market";

export interface VectorMAResult {
  xMA: Float64Array;
  yMA: Float64Array;
  displacementPct: Float64Array;
  displacementZScore: Float64Array;
}

export interface Bollinger3DResult {
  xMA: Float64Array;
  yMA: Float64Array;
  xStd: Float64Array;
  yStd: Float64Array;
}

export interface RollingStatsSeries {
  levelCorrelation: Float64Array;
  returnCorrelation: Float64Array;
  basisPips: Float64Array;
}

export interface PhaseGeometry3DResult {
  normX: Float64Array;
  normY: Float64Array;
  radialDist: Float64Array;
  velocity: Float64Array;
  curvature: Float64Array;
  levyArea: Float64Array;
  coilScore: Float64Array;
  /** Causal top-down (X,Y) turning/deflection angle Δθ_i in [0°, 180°] between consecutive volatility-standardized steps (<90° forward continuation vs. >=90° hairpin reversal) */
  turningAngleDeg: Float64Array;
  /** Causal rolling percentage (0..100%) of active bars in window where turningAngleDeg >= 90° */
  hairpinRatioPct: Float64Array;
}

export interface PhaseRegimeMeta {
  id: PhaseRegimeId;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}

export const PHASE_REGIME_META: Record<PhaseRegimeId, PhaseRegimeMeta> = {
  0: {
    id: 0,
    label: "Compression Coil",
    shortLabel: "Coil",
    color: "#38bdf8",
    description: "Tight phase-space winding with low velocity & high turning rate",
  },
  1: {
    id: 1,
    label: "Equilibrium Orbit",
    shortLabel: "Orbit",
    color: "#34d399",
    description: "Steady rotational spiral around the 3D Moving Average spine",
  },
  2: {
    id: 2,
    label: "Directional Breakout",
    shortLabel: "Breakout",
    color: "#f59e0b",
    description: "High phase velocity & expanding ballistic trajectory",
  },
  3: {
    id: 3,
    label: "Tail / Shock Regime",
    shortLabel: "Shock",
    color: "#f43f5e",
    description: "Extreme >2σ phase excursion with sharp velocity/curvature spike",
  },
};

export interface PhaseClusterResult {
  regime: Uint8Array;
  centroidDistance: Float64Array;
  nearestBasinDist: Float64Array;
  transitionMatrix: number[][];
  regimeCounts: [number, number, number, number];
}

export interface SpatialAttractorBasin {
  id: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  stdX: number;
  stdY: number;
  corrXY: number;
  dwellCount: number;
  dwellPct: number;
  isCurrentBasin: boolean;
  latestSigmaDist: number;
}

export interface PhaseEntropyResult {
  /** Normalized Bandt-Pompe Ordinal Permutation Entropy (d=3, 6 motifs) in [0, 1] on coupled XAUUSD + FX legs */
  permutationEntropy: Float64Array;
  /** Circular Turning-Angle & 8-Sector Deflection Entropy H_Δφ in [0, 1] separating coherent trend/orbit from chop */
  turningEntropy: Float64Array;
  /** Causal Next-Bar Markov Regime Transition Entropy H(S_{t+1} | S_t) in [0, 1] */
  markovRegimeEntropy: Float64Array;
  /** Composite Phase-Space Disorder Index (0..100%) combining turning & ordinal permutation entropy */
  compositeEntropyPct: Float64Array;
  /** Entropy-filtered 3D Compression Coil Score (0..100) that suppresses high-entropy bid-ask chop fake coils */
  entropyQualityCoilScore: Float64Array;
}

const maCache = new WeakMap<MarketBar[], Map<string, VectorMAResult>>();

/**
 * Causal 3D Vector Moving Average (SMA or EMA) + Phase Displacement (%) & Rolling Z-Score.
 * Guaranteed zero lookahead bias: index `i` only depends on bars `0..i`.
 */
export function computeVectorMA(
  series: MarketBar[],
  periodInput: number,
  type: "SMA" | "EMA"
): VectorMAResult {
  const len = series.length;
  const period = Math.max(2, Math.min(500, Math.floor(periodInput || 20)));
  if (len > 0) {
    const last = series[len - 1];
    const cacheKey = `${len}:${period}:${type}:${last.timestamp}:${last.xauusd}`;
    const existing = maCache.get(series)?.get(cacheKey);
    if (existing) return existing;
  }
  const xMA = new Float64Array(len);
  const yMA = new Float64Array(len);
  const displacementPct = new Float64Array(len);
  const displacementZScore = new Float64Array(len);

  if (len === 0) {
    return { xMA, yMA, displacementPct, displacementZScore };
  }

  if (type === "EMA") {
    const k = 2.0 / (period + 1.0);
    let currX = series[0].xaueur;
    let currY = series[0].eurusd;
    xMA[0] = currX;
    yMA[0] = currY;

    for (let i = 1; i < len; i++) {
      currX = series[i].xaueur * k + currX * (1.0 - k);
      currY = series[i].eurusd * k + currY * (1.0 - k);
      xMA[i] = currX;
      yMA[i] = currY;
    }
  } else {
    let runSumX = 0;
    let runSumY = 0;
    for (let i = 0; i < len; i++) {
      runSumX += series[i].xaueur;
      runSumY += series[i].eurusd;
      if (i >= period) {
        runSumX -= series[i - period].xaueur;
        runSumY -= series[i - period].eurusd;
        xMA[i] = runSumX / period;
        yMA[i] = runSumY / period;
      } else {
        xMA[i] = runSumX / (i + 1);
        yMA[i] = runSumY / (i + 1);
      }
    }
  }

  // Compute instantaneous percentage phase displacement & causal Z-score
  let dispSum = 0;
  let dispSumSq = 0;
  for (let i = 0; i < len; i++) {
    const mx = xMA[i] || 1;
    const my = yMA[i] || 1;
    const dx = (series[i].xaueur - mx) / mx;
    const dy = (series[i].eurusd - my) / my;
    const dPct = Math.sqrt(dx * dx + dy * dy) * 100.0;
    displacementPct[i] = dPct;

    dispSum += dPct;
    dispSumSq += dPct * dPct;
    if (i >= period) {
      const old = displacementPct[i - period];
      dispSum -= old;
      dispSumSq -= old * old;
    }
    const winN = Math.min(i + 1, period);
    if (winN >= 3) {
      const mean = dispSum / winN;
      const variance = Math.max(0, dispSumSq / winN - mean * mean);
      const std = Math.sqrt(variance);
      displacementZScore[i] = std > 1e-9 ? (dPct - mean) / std : 0;
    } else {
      displacementZScore[i] = 0;
    }
  }

  const result: VectorMAResult = { xMA, yMA, displacementPct, displacementZScore };
  const last = series[len - 1];
  const cacheKey = `${len}:${period}:${type}:${last.timestamp}:${last.xauusd}`;
  let subMap = maCache.get(series);
  if (!subMap) {
    subMap = new Map();
    maCache.set(series, subMap);
  }
  subMap.set(cacheKey, result);
  return result;
}

/**
 * Causal 3D Volatility Envelope (Bollinger Elliptical Spine)
 */
export function computeVectorBollinger3D(
  series: MarketBar[],
  periodInput: number
): Bollinger3DResult {
  const len = series.length;
  const period = Math.max(2, Math.min(500, Math.floor(periodInput || 20)));
  const xMA = new Float64Array(len);
  const yMA = new Float64Array(len);
  const xStd = new Float64Array(len);
  const yStd = new Float64Array(len);

  if (len === 0) return { xMA, yMA, xStd, yStd };

  let sumX = 0,
    sumX2 = 0,
    sumY = 0,
    sumY2 = 0;

  for (let i = 0; i < len; i++) {
    const vx = series[i].xaueur;
    const vy = series[i].eurusd;
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

    const n = Math.min(i + 1, period);
    const mx = sumX / n;
    const my = sumY / n;
    xMA[i] = mx;
    yMA[i] = my;

    const varX = Math.max(0, sumX2 / n - mx * mx);
    const varY = Math.max(0, sumY2 / n - my * my);
    xStd[i] = Math.sqrt(varX);
    yStd[i] = Math.sqrt(varY);
  }

  return { xMA, yMA, xStd, yStd };
}

/**
 * Pearson correlation coefficient r(X, Y)
 */
export function calculateCorrelation(
  xArr: ArrayLike<number>,
  yArr: ArrayLike<number>
): number {
  const n = Math.min(xArr.length, yArr.length);
  if (n < 2) return 0;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xArr[i];
    const y = yArr[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den <= 1e-12 ? 0 : num / den;
}

/**
 * Stationary Log-Return Pearson correlation r(Δln(XAUEUR), Δln(EURUSD))
 */
export function calculateLogReturnCorrelation(series: MarketBar[]): number {
  const n = series.length;
  if (n < 3) return 0;
  const retX = new Float64Array(n - 1);
  const retY = new Float64Array(n - 1);
  for (let i = 1; i < n; i++) {
    retX[i - 1] = Math.log(series[i].xaueur / series[i - 1].xaueur);
    retY[i - 1] = Math.log(series[i].eurusd / series[i - 1].eurusd);
  }
  return calculateCorrelation(retX, retY);
}

/**
 * Computes causal rolling level correlation, stationary log-return correlation,
 * and cross-rate arbitrage basis (pips) across the bar series.
 */
export function computeRollingStatsSeries(
  series: MarketBar[],
  windowInput = 30,
  pair: TriadPairId = "EUR"
): RollingStatsSeries {
  const len = series.length;
  const win = Math.max(5, Math.min(200, Math.floor(windowInput)));
  const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
  const levelCorrelation = new Float64Array(len);
  const returnCorrelation = new Float64Array(len);
  const basisPips = new Float64Array(len);

  if (len === 0) {
    return { levelCorrelation, returnCorrelation, basisPips };
  }

  const logRetX = new Float64Array(len);
  const logRetY = new Float64Array(len);
  for (let i = 1; i < len; i++) {
    logRetX[i] = Math.log(series[i].xaueur / series[i - 1].xaueur);
    logRetY[i] = Math.log(series[i].eurusd / series[i - 1].eurusd);
  }

  for (let i = 0; i < len; i++) {
    const bar = series[i];
    const refCross = bar.marketXaueur ?? bar.xaueur;
    const impliedFx =
      triad.quoteMode === "CCY_USD"
        ? bar.xauusd / refCross
        : refCross / bar.xauusd;
    basisPips[i] = (bar.eurusd - impliedFx) * triad.pipMultiplier;

    const start = Math.max(0, i - win + 1);
    const count = i - start + 1;
    if (count < 4) {
      levelCorrelation[i] = 0;
      returnCorrelation[i] = 0;
      continue;
    }

    // Level correlation over [start..i]
    let sx = 0,
      sy = 0,
      sxy = 0,
      sx2 = 0,
      sy2 = 0;
    for (let j = start; j <= i; j++) {
      const vx = series[j].xaueur;
      const vy = series[j].eurusd;
      sx += vx;
      sy += vy;
      sxy += vx * vy;
      sx2 += vx * vx;
      sy2 += vy * vy;
    }
    const numL = count * sxy - sx * sy;
    const denL = Math.sqrt(
      (count * sx2 - sx * sx) * (count * sy2 - sy * sy)
    );
    levelCorrelation[i] = denL > 1e-12 ? numL / denL : 0;

    // Return correlation over [max(1, start)..i]
    const rStart = Math.max(1, start);
    const rCount = i - rStart + 1;
    if (rCount >= 3) {
      let rx = 0,
        ry = 0,
        rxy = 0,
        rx2 = 0,
        ry2 = 0;
      for (let j = rStart; j <= i; j++) {
        const vx = logRetX[j];
        const vy = logRetY[j];
        rx += vx;
        ry += vy;
        rxy += vx * vy;
        rx2 += vx * vx;
        ry2 += vy * vy;
      }
      const numR = rCount * rxy - rx * ry;
      const denR = Math.sqrt(
        (rCount * rx2 - rx * rx) * (rCount * ry2 - ry * ry)
      );
      returnCorrelation[i] = denR > 1e-12 ? numR / denR : 0;
    }
  }

  return { levelCorrelation, returnCorrelation, basisPips };
}

export interface TimeUnitConfig {
  unit: string;
  divisor: number;
  label: string;
  fmtSpan: (sec: number) => string;
}

export function getTimeUnitConfig(tf: TimeframeId): TimeUnitConfig {
  if (tf === "1d") {
    return {
      unit: "days",
      divisor: 86400,
      label: "Elapsed Time (days)",
      fmtSpan: (s) => `${(s / 86400).toFixed(0)} days`,
    };
  }
  if (tf === "1h" || tf === "15m") {
    return {
      unit: "hours",
      divisor: 3600,
      label: "Elapsed Time (hours)",
      fmtSpan: (s) => `${(s / 3600).toFixed(1)} hours`,
    };
  }
  return {
    unit: "minutes",
    divisor: 60,
    label: "Elapsed Time (minutes)",
    fmtSpan: (s) => `${(s / 60).toFixed(1)} min`,
  };
}

const geoCache = new WeakMap<MarketBar[], Map<string, PhaseGeometry3DResult>>();
const clusterCache = new WeakMap<MarketBar[], Map<string, PhaseClusterResult>>();
const entropyCache = new WeakMap<MarketBar[], Map<string, PhaseEntropyResult>>();

/**
 * Pillar #2: Causal 3D Differential Geometry & Spiral Chirality Engine.
 * Computes volatility-standardized phase coordinates (normX, normY),
 * Phase Velocity (v_t), Regularized 3D Space-Time Curvature (κ_t),
 * Rolling Signed Lévy Stochastic Area (L_z,t), and Compression Coil Score (0..100).
 * Guaranteed zero lookahead bias: index `i` only depends on bars `0..i` in O(N) time.
 */
export function computePhaseGeometry3D(
  series: MarketBar[],
  periodInput = 20,
  levyWindowInput = 20
): PhaseGeometry3DResult {
  const len = series.length;
  const period = Math.max(3, Math.min(500, Math.floor(periodInput || 20)));
  const levyWin = Math.max(3, Math.min(300, Math.floor(levyWindowInput || period)));

  if (len > 0) {
    const last = series[len - 1];
    const cacheKey = `${len}:${period}:${levyWin}:${last.timestamp}:${last.xauusd}`;
    const existing = geoCache.get(series)?.get(cacheKey);
    if (existing) return existing;
  }

  const normX = new Float64Array(len);
  const normY = new Float64Array(len);
  const radialDist = new Float64Array(len);
  const velocity = new Float64Array(len);
  const curvature = new Float64Array(len);
  const levyArea = new Float64Array(len);
  const coilScore = new Float64Array(len);
  const turningAngleDeg = new Float64Array(len);
  const hairpinRatioPct = new Float64Array(len);

  if (len === 0) {
    return {
      normX,
      normY,
      radialDist,
      velocity,
      curvature,
      levyArea,
      coilScore,
      turningAngleDeg,
      hairpinRatioPct,
    };
  }

  const instLevy = new Float64Array(len);
  const validTurnFlag = new Uint8Array(len);
  const isHairpinFlag = new Uint8Array(len);
  let sumX = 0,
    sumX2 = 0,
    sumY = 0,
    sumY2 = 0;
  let levySum = 0;
  let turnCountSum = 0;
  let hairpinCountSum = 0;

  let prevEmaVx = 0;
  let prevEmaVy = 0;
  let emaR = 0;
  let emaV = 0;
  let emaK = 0;
  let lastActiveDx = 0;
  let lastActiveDy = 0;
  let hasPrevActiveChord = false;

  for (let i = 0; i < len; i++) {
    const vx = series[i].xaueur;
    const vy = series[i].eurusd;
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

    const n = Math.min(i + 1, period);
    const mx = sumX / n;
    const my = sumY / n;

    let scaleX = Math.abs(mx) * 1e-4 || 1e-6;
    let scaleY = Math.abs(my) * 1e-4 || 1e-6;

    if (n >= 2) {
      const varX = Math.max(0, sumX2 / n - mx * mx);
      const varY = Math.max(0, sumY2 / n - my * my);
      const stdX = Math.sqrt(varX);
      const stdY = Math.sqrt(varY);
      if (stdX > 1e-9) scaleX = stdX;
      if (stdY > 1e-9) scaleY = stdY;
      normX[i] = (vx - mx) / scaleX;
      normY[i] = (vy - my) / scaleY;
    }

    const nxNow = normX[i];
    const nyNow = normY[i];
    const rNow = Math.sqrt(nxNow * nxNow + nyNow * nyNow);
    radialDist[i] = rNow;

    if (i >= 1) {
      // Top-Down (X, Y) Turning / Deflection Angle Δθ_i in causal local volatility metric
      const rawDx = vx - series[i - 1].xaueur;
      const rawDy = vy - series[i - 1].eurusd;
      const currStepX = rawDx / scaleX;
      const currStepY = rawDy / scaleY;
      const currMag = Math.sqrt(currStepX * currStepX + currStepY * currStepY);

      if (currMag > 1e-6) {
        if (hasPrevActiveChord) {
          const prevStepX = lastActiveDx / scaleX;
          const prevStepY = lastActiveDy / scaleY;
          const prevMag = Math.sqrt(prevStepX * prevStepX + prevStepY * prevStepY);
          if (prevMag > 1e-6) {
            const cosTheta = Math.max(
              -1,
              Math.min(
                1,
                (prevStepX * currStepX + prevStepY * currStepY) /
                  (prevMag * currMag)
              )
            );
            const deg = (Math.acos(cosTheta) * 180.0) / Math.PI;
            turningAngleDeg[i] = deg;
            validTurnFlag[i] = 1;
            isHairpinFlag[i] = deg >= 90.0 ? 1 : 0;
          }
        }
        lastActiveDx = rawDx;
        lastActiveDy = rawDy;
        hasPrevActiveChord = true;
      }

      turnCountSum += validTurnFlag[i];
      hairpinCountSum += isHairpinFlag[i];
      if (i >= period) {
        turnCountSum -= validTurnFlag[i - period];
        hairpinCountSum -= isHairpinFlag[i - period];
      }
      hairpinRatioPct[i] =
        turnCountSum > 0 ? (100.0 * hairpinCountSum) / turnCountSum : 0;

      const dx = nxNow - normX[i - 1];
      const dy = nyNow - normY[i - 1];

      // Causal 3-bar EMA (α = 0.5) on first phase differences
      const emaVx = i === 1 ? dx : 0.5 * dx + 0.5 * prevEmaVx;
      const emaVy = i === 1 ? dy : 0.5 * dy + 0.5 * prevEmaVy;

      const ax = i >= 2 ? emaVx - prevEmaVx : 0;
      const ay = i >= 2 ? emaVy - prevEmaVy : 0;
      prevEmaVx = emaVx;
      prevEmaVy = emaVy;

      const vSq = emaVx * emaVx + emaVy * emaVy;
      const vNow = Math.sqrt(vSq);
      velocity[i] = vNow;

      // Regularized 3D space-time curvature γ(t) = (x̃(t), ỹ(t), t) where ż = 1, z̈ = 0
      const crossZ = emaVx * ay - emaVy * ax;
      const numK = Math.sqrt(ax * ax + ay * ay + crossZ * crossZ);
      const vSq1 = vSq + 1.0;
      const denK = vSq1 * Math.sqrt(vSq1);
      const kNow = numK / denK;
      curvature[i] = kNow;

      // Instantaneous signed Lévy stochastic area around the 3D MA spine
      const stepLevy =
        0.5 * (normX[i - 1] * normY[i] - normY[i - 1] * normX[i]);
      instLevy[i] = stepLevy;
      levySum += stepLevy;
      if (i >= levyWin) {
        levySum -= instLevy[i - levyWin];
      }
      levyArea[i] = levySum;

      // Causal EMA smoothing for Compression Coil Score (0..100)
      const alphaCoil = 0.25;
      emaR = i === 1 ? rNow : alphaCoil * rNow + (1 - alphaCoil) * emaR;
      emaV = i === 1 ? vNow : alphaCoil * vNow + (1 - alphaCoil) * emaV;
      emaK = i === 1 ? kNow : alphaCoil * kNow + (1 - alphaCoil) * emaK;

      if (i >= 3) {
        const turnIntensity = emaK / (emaV + 0.12);
        const rawCoil =
          100.0 *
          Math.exp(-0.35 * emaR) *
          Math.exp(-0.45 * emaV) *
          Math.tanh(2.4 * turnIntensity);
        coilScore[i] = Math.max(0, Math.min(100, rawCoil));
      }
    }
  }

  const result: PhaseGeometry3DResult = {
    normX,
    normY,
    radialDist,
    velocity,
    curvature,
    levyArea,
    coilScore,
    turningAngleDeg,
    hairpinRatioPct,
  };
  const last = series[len - 1];
  const cacheKey = `${len}:${period}:${levyWin}:${last.timestamp}:${last.xauusd}`;
  let map = geoCache.get(series);
  if (!map) {
    map = new Map();
    geoCache.set(series, map);
  }
  map.set(cacheKey, result);
  return result;
}

/**
 * Computes a causal 4x4 row-stochastic Markov transition probability matrix P_ij = P(S_t = j | S_{t-1} = i)
 * over the prefix [0..effectiveEnd-1] with Laplace smoothing so every row sums to 1.0.
 */
export function computeMarkovTransitionMatrix(
  regime: ArrayLike<number>,
  effectiveEndInput?: number
): number[][] {
  const n = Math.min(
    regime.length,
    effectiveEndInput ?? regime.length
  );
  const counts: number[][] = [
    [0.25, 0.25, 0.25, 0.25],
    [0.25, 0.25, 0.25, 0.25],
    [0.25, 0.25, 0.25, 0.25],
    [0.25, 0.25, 0.25, 0.25],
  ];

  for (let i = 1; i < n; i++) {
    const prev = regime[i - 1] & 3;
    const curr = regime[i] & 3;
    counts[prev][curr] += 1.0;
  }

  return counts.map((row) => {
    const rowSum = row[0] + row[1] + row[2] + row[3] || 1;
    return [
      row[0] / rowSum,
      row[1] / rowSum,
      row[2] / rowSum,
      row[3] / rowSum,
    ];
  });
}

/**
 * Pillar #6B: Causal Feature-Space Regime Clustering & Attractor Proximity Engine.
 * Partitions every bar `0..i` into 1 of 4 canonical dynamical regimes in O(N) time
 * using Online Prototype-Anchored K-Means on causally standardized features:
 *   0 = Compression Coil, 1 = Equilibrium Orbit, 2 = Directional Breakout, 3 = Tail / Shock.
 * Guaranteed zero lookahead bias and zero random label-switching.
 */
export function computePhaseClusters(
  series: MarketBar[],
  periodInput = 20,
  precomputedGeo?: PhaseGeometry3DResult
): PhaseClusterResult {
  const len = series.length;
  const period = Math.max(5, Math.min(300, Math.floor(periodInput || 20)));
  if (len > 0) {
    const last = series[len - 1];
    const cacheKey = `${len}:${period}:${last.timestamp}:${last.xauusd}`;
    const existing = clusterCache.get(series)?.get(cacheKey);
    if (existing) return existing;
  }
  const geo =
    precomputedGeo ?? computePhaseGeometry3D(series, period, period);

  const regime = new Uint8Array(len);
  const centroidDistance = new Float64Array(len);
  const nearestBasinDist = new Float64Array(len);
  const regimeCounts: [number, number, number, number] = [0, 0, 0, 0];

  if (len === 0) {
    return {
      regime,
      centroidDistance,
      nearestBasinDist,
      transitionMatrix: computeMarkovTransitionMatrix(regime, 0),
      regimeCounts,
    };
  }

  // Canonical prototype anchors in standardized 4D feature space [z_r, z_v, z_k, z_L]
  const prototypes: [number, number, number, number][] = [
    [-0.75, -0.75, 0.65, -0.35], // 0: Compression Coil
    [-0.1, -0.1, 0.15, 0.85], // 1: Equilibrium Orbit
    [0.85, 0.85, -0.55, 0.0], // 2: Directional Breakout
    [1.95, 1.75, 0.95, 0.45], // 3: Tail / Shock Regime
  ];

  const centroids: [number, number, number, number][] = prototypes.map(
    (p) => [...p] as [number, number, number, number]
  );

  // Causal 3-node spatial attractor centers in standardized (x̃, ỹ) phase space
  const spatialNodes: [number, number][] = [
    [-0.9, 0.6],
    [0.0, 0.0],
    [0.9, -0.6],
  ];

  // Running sliding window sums for causal standardization of the 4 dynamical features
  const fBufR = new Float64Array(len);
  const fBufV = new Float64Array(len);
  const fBufK = new Float64Array(len);
  const fBufL = new Float64Array(len);

  let sumR = 0,
    sumR2 = 0,
    sumV = 0,
    sumV2 = 0,
    sumK = 0,
    sumK2 = 0,
    sumL = 0,
    sumL2 = 0;

  for (let i = 0; i < len; i++) {
    const r = geo.radialDist[i];
    const v = geo.velocity[i];
    const k = geo.curvature[i];
    const l = Math.abs(geo.levyArea[i]);

    fBufR[i] = r;
    fBufV[i] = v;
    fBufK[i] = k;
    fBufL[i] = l;

    sumR += r;
    sumR2 += r * r;
    sumV += v;
    sumV2 += v * v;
    sumK += k;
    sumK2 += k * k;
    sumL += l;
    sumL2 += l * l;

    if (i >= period) {
      const idxOld = i - period;
      const or = fBufR[idxOld];
      const ov = fBufV[idxOld];
      const ok = fBufK[idxOld];
      const ol = fBufL[idxOld];
      sumR -= or;
      sumR2 -= or * or;
      sumV -= ov;
      sumV2 -= ov * ov;
      sumK -= ok;
      sumK2 -= ok * ok;
      sumL -= ol;
      sumL2 -= ol * ol;
    }

    const n = Math.min(i + 1, period);
    const mr = sumR / n;
    const mv = sumV / n;
    const mk = sumK / n;
    const ml = sumL / n;

    const sr = Math.max(0.15, Math.sqrt(Math.max(0, sumR2 / n - mr * mr)));
    const sv = Math.max(0.1, Math.sqrt(Math.max(0, sumV2 / n - mv * mv)));
    const sk = Math.max(0.05, Math.sqrt(Math.max(0, sumK2 / n - mk * mk)));
    const sl = Math.max(0.1, Math.sqrt(Math.max(0, sumL2 / n - ml * ml)));

    const zr = Math.max(-3.5, Math.min(4.0, (r - mr) / sr));
    const zv = Math.max(-3.5, Math.min(4.0, (v - mv) / sv));
    const zk = Math.max(-3.5, Math.min(4.0, (k - mk) / sk));
    const zl = Math.max(-3.5, Math.min(4.0, (l - ml) / sl));

    // Find closest regime centroid in standardized 4D feature space
    let bestCluster: PhaseRegimeId = 0;
    let bestDistSq = Infinity;

    for (let c = 0; c < 4; c++) {
      const cent = centroids[c];
      const d0 = zr - cent[0];
      const d1 = zv - cent[1];
      const d2 = zk - cent[2];
      const d3 = zl - cent[3];
      const distSq = d0 * d0 + d1 * d1 + 0.8 * d2 * d2 + 0.8 * d3 * d3;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestCluster = c as PhaseRegimeId;
      }
    }

    regime[i] = bestCluster;
    centroidDistance[i] = Math.sqrt(bestDistSq);
    regimeCounts[bestCluster] += 1;

    // Causal online centroid adaptation with prototype anchor regularization
    const eta = 0.08;
    const anchorPull = 0.25;
    const winCent = centroids[bestCluster];
    const proto = prototypes[bestCluster];
    winCent[0] =
      (1 - eta) * winCent[0] +
      eta * ((1 - anchorPull) * zr + anchorPull * proto[0]);
    winCent[1] =
      (1 - eta) * winCent[1] +
      eta * ((1 - anchorPull) * zv + anchorPull * proto[1]);
    winCent[2] =
      (1 - eta) * winCent[2] +
      eta * ((1 - anchorPull) * zk + anchorPull * proto[2]);
    winCent[3] =
      (1 - eta) * winCent[3] +
      eta * ((1 - anchorPull) * zl + anchorPull * proto[3]);

    // Causal nearest spatial attractor distance in standardized (x̃, ỹ) plane
    const nx = geo.normX[i];
    const ny = geo.normY[i];
    let bestNodeIdx = 0;
    let minNodeDistSq = Infinity;
    for (let s = 0; s < spatialNodes.length; s++) {
      const dx = nx - spatialNodes[s][0];
      const dy = ny - spatialNodes[s][1];
      const dSq = dx * dx + dy * dy;
      if (dSq < minNodeDistSq) {
        minNodeDistSq = dSq;
        bestNodeIdx = s;
      }
    }
    nearestBasinDist[i] = Math.sqrt(minNodeDistSq);
    // Update winning spatial attractor causally
    spatialNodes[bestNodeIdx][0] = 0.92 * spatialNodes[bestNodeIdx][0] + 0.08 * nx;
    spatialNodes[bestNodeIdx][1] = 0.92 * spatialNodes[bestNodeIdx][1] + 0.08 * ny;
  }

  const result: PhaseClusterResult = {
    regime,
    centroidDistance,
    nearestBasinDist,
    transitionMatrix: computeMarkovTransitionMatrix(regime, len),
    regimeCounts,
  };
  const last = series[len - 1];
  const cacheKey = `${len}:${period}:${last.timestamp}:${last.xauusd}`;
  let map = clusterCache.get(series);
  if (!map) {
    map = new Map();
    clusterCache.set(series, map);
  }
  map.set(cacheKey, result);
  return result;
}

/**
 * Pillar #6A: Spatial 3D Price-Acceptance / Attractor Basin Clustering.
 * Uses Deterministic Quantile-Seeded K-Means (zero Math.random) on the active visible slice
 * to identify the K dominant 3D consolidation basins (centroids, covariance tilt, and dwell %).
 */
export function computeSpatialAttractorBasins(
  activeSlice: MarketBar[],
  kInput = 3,
  zVals?: number[]
): SpatialAttractorBasin[] {
  const n = activeSlice.length;
  if (n === 0) return [];
  const kCount = Math.max(2, Math.min(5, Math.min(n, Math.floor(kInput || 3))));

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = activeSlice[i].xaueur;
    const y = activeSlice[i].eurusd;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1e-4;

  const uX = new Float64Array(n);
  const uY = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    uX[i] = (activeSlice[i].xaueur - minX) / spanX;
    uY[i] = (activeSlice[i].eurusd - minY) / spanY;
  }

  // Deterministic quantile seeding sorted by uX + uY
  const order = Array.from({ length: n }, (_, idx) => idx).sort(
    (a, b) => uX[a] - uX[b]
  );
  const centUX = new Float64Array(kCount);
  const centUY = new Float64Array(kCount);
  for (let c = 0; c < kCount; c++) {
    const pick = order[Math.min(n - 1, Math.floor(((c + 0.5) * n) / kCount))];
    centUX[c] = uX[pick];
    centUY[c] = uY[pick];
  }

  const assignments = new Uint8Array(n);

  // 5 iterations of deterministic Lloyd's K-Means
  for (let iter = 0; iter < 5; iter++) {
    const sumUX = new Float64Array(kCount);
    const sumUY = new Float64Array(kCount);
    const counts = new Uint32Array(kCount);

    for (let i = 0; i < n; i++) {
      let bestC = 0;
      let bestD = Infinity;
      const xi = uX[i];
      const yi = uY[i];
      for (let c = 0; c < kCount; c++) {
        const dx = xi - centUX[c];
        const dy = yi - centUY[c];
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          bestC = c;
        }
      }
      assignments[i] = bestC;
      sumUX[bestC] += xi;
      sumUY[bestC] += yi;
      counts[bestC] += 1;
    }

    for (let c = 0; c < kCount; c++) {
      if (counts[c] > 0) {
        centUX[c] = sumUX[c] / counts[c];
        centUY[c] = sumUY[c] / counts[c];
      }
    }
  }

  const latestIdx = n - 1;
  const latestCluster = assignments[latestIdx];
  const latestX = activeSlice[latestIdx].xaueur;
  const latestY = activeSlice[latestIdx].eurusd;

  const rawBasins: SpatialAttractorBasin[] = [];

  for (let c = 0; c < kCount; c++) {
    let sx = 0,
      sy = 0,
      sz = 0,
      cnt = 0;
    for (let i = 0; i < n; i++) {
      if (assignments[i] === c) {
        sx += activeSlice[i].xaueur;
        sy += activeSlice[i].eurusd;
        sz += zVals ? zVals[i] : i;
        cnt++;
      }
    }
    if (cnt === 0) continue;

    const cx = sx / cnt;
    const cy = sy / cnt;
    const cz = sz / cnt;

    let vxSum = 0,
      vySum = 0,
      covSum = 0;
    for (let i = 0; i < n; i++) {
      if (assignments[i] === c) {
        const dx = activeSlice[i].xaueur - cx;
        const dy = activeSlice[i].eurusd - cy;
        vxSum += dx * dx;
        vySum += dy * dy;
        covSum += dx * dy;
      }
    }

    const stdX = Math.max(spanX * 0.025, Math.sqrt(vxSum / cnt));
    const stdY = Math.max(spanY * 0.025, Math.sqrt(vySum / cnt));
    const denCorr = stdX * stdY * cnt;
    const corrXY =
      denCorr > 1e-12
        ? Math.max(-0.95, Math.min(0.95, covSum / denCorr))
        : 0;

    const latestSigmaDist = Math.hypot(
      (latestX - cx) / stdX,
      (latestY - cy) / stdY
    );

    rawBasins.push({
      id: c,
      centerX: cx,
      centerY: cy,
      centerZ: cz,
      stdX,
      stdY,
      corrXY,
      dwellCount: cnt,
      dwellPct: (cnt / n) * 100.0,
      isCurrentBasin: c === latestCluster,
      latestSigmaDist,
    });
  }

  // Sort deterministically by centerX ascending and re-index 1..K
  rawBasins.sort((a, b) => a.centerX - b.centerX);
  rawBasins.forEach((b, idx) => {
    b.id = idx + 1;
  });

  return rawBasins;
}

/**
 * Encodes a 3-bar sequence (a, b, c) into 1 of 3! = 6 Bandt-Pompe ordinal rank motifs (0..5).
 * Ties are broken deterministically by temporal order (t-2 < t-1 < t).
 */
function encodeOrdinalMotif3(a: number, b: number, c: number): number {
  if (a <= b) {
    if (b <= c) return 0; // a <= b <= c (monotonic up)
    return a <= c ? 1 : 2; // 1: a <= c < b (up-peak-pullback), 2: c < a <= b (up-reversal)
  } else {
    if (a <= c) return 3; // b < a <= c (dip-breakout)
    return b <= c ? 4 : 5; // 4: b <= c < a (down-trough-bounce), 5: c < b < a (monotonic down)
  }
}

/**
 * Computes normalized Shannon entropy -Σ p_k ln(p_k) / ln(M) in [0, 1] for a non-negative count array.
 */
function normalizedShannonFromCounts(
  counts: ArrayLike<number>,
  total: number,
  logBase: number
): number {
  if (total <= 0 || logBase <= 0) return 0;
  let h = 0;
  for (let k = 0; k < counts.length; k++) {
    const c = counts[k];
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log(p);
    }
  }
  return Math.max(0, Math.min(1, h / logBase));
}

/**
 * Causal Phase-Space Entropy Engine:
 *   1. Ordinal Permutation Entropy (H_perm in [0, 1], d=3, 6 motifs) on primary XAUUSD + FX legs
 *   2. Circular Turning-Angle & 8-Sector Deflection Entropy (H_Δφ in [0, 1]) in standardized (x̃, ỹ) phase space
 *   3. Next-Bar Markov Regime Transition Entropy (H_Markov in [0, 1]) from causal 4x4 transition probabilities
 *   4. Composite Phase Disorder Index (0..100%) & Entropy-Quality Coiling Score (0..100)
 * Guaranteed zero lookahead bias: index `i` only depends on bars `0..i` in O(N) time.
 */
export function computePhaseEntropy(
  series: MarketBar[],
  periodInput = 20,
  precomputedGeo?: PhaseGeometry3DResult,
  precomputedClusters?: PhaseClusterResult
): PhaseEntropyResult {
  const len = series.length;
  const period = Math.max(5, Math.min(300, Math.floor(periodInput || 20)));
  if (len > 0) {
    const last = series[len - 1];
    const cacheKey = `${len}:${period}:${last.timestamp}:${last.xauusd}`;
    const existing = entropyCache.get(series)?.get(cacheKey);
    if (existing) return existing;
  }
  const geo =
    precomputedGeo ?? computePhaseGeometry3D(series, period, period);
  const clusters =
    precomputedClusters ?? computePhaseClusters(series, period, geo);

  const permutationEntropy = new Float64Array(len);
  const turningEntropy = new Float64Array(len);
  const markovRegimeEntropy = new Float64Array(len);
  const compositeEntropyPct = new Float64Array(len);
  const entropyQualityCoilScore = new Float64Array(len);

  if (len === 0) {
    return {
      permutationEntropy,
      turningEntropy,
      markovRegimeEntropy,
      compositeEntropyPct,
      entropyQualityCoilScore,
    };
  }

  const LN_6 = Math.log(6);
  const LN_8 = Math.log(8);
  const LN_4 = Math.log(4);

  // Ring buffers for O(1) sliding-window Bandt-Pompe Ordinal Permutation Entropy (d=3)
  const motifG = new Uint8Array(len);
  const motifY = new Uint8Array(len);
  const validMotif = new Uint8Array(len);
  const countsG = new Float64Array(6);
  const countsY = new Float64Array(6);
  let motifWinCount = 0;

  // Ring buffers for O(1) sliding-window Turning-Angle Circular & 8-Sector Entropy
  const validTurn = new Uint8Array(len);
  const turnSector = new Uint8Array(len);
  const turnCos = new Float64Array(len);
  const turnSin = new Float64Array(len);
  const sectorCounts = new Float64Array(8);
  let turnWinCount = 0;
  let sumTurnCos = 0;
  let sumTurnSin = 0;

  let prevChordX = 0;
  let prevChordY = 0;
  let hasPrevChord = false;

  // Causal rolling 4x4 Markov transition table with Laplace smoothing (α = 0.15)
  const markovWin = Math.max(30, period * 2);
  const transCounts: number[][] = [
    [0.15, 0.15, 0.15, 0.15],
    [0.15, 0.15, 0.15, 0.15],
    [0.15, 0.15, 0.15, 0.15],
    [0.15, 0.15, 0.15, 0.15],
  ];

  // Causal rolling sums for local volatility scaling of steps
  let sumX = 0,
    sumX2 = 0,
    sumY = 0,
    sumY2 = 0;

  for (let i = 0; i < len; i++) {
    const vx = series[i].xaueur;
    const vy = series[i].eurusd;
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

    const n = Math.min(i + 1, period);
    const mx = sumX / n;
    const my = sumY / n;
    let scaleX = Math.abs(mx) * 1e-4 || 1e-6;
    let scaleY = Math.abs(my) * 1e-4 || 1e-6;
    if (n >= 2) {
      const stdX = Math.sqrt(Math.max(0, sumX2 / n - mx * mx));
      const stdY = Math.sqrt(Math.max(0, sumY2 / n - my * my));
      if (stdX > 1e-9) scaleX = stdX;
      if (stdY > 1e-9) scaleY = stdY;
    }

    // 1. Bandt-Pompe Ordinal Permutation Entropy (d=3) on primary XAUUSD & FX legs
    if (i >= 2) {
      const mG = encodeOrdinalMotif3(
        series[i - 2].xauusd,
        series[i - 1].xauusd,
        series[i].xauusd
      );
      const mY = encodeOrdinalMotif3(
        series[i - 2].eurusd,
        series[i - 1].eurusd,
        series[i].eurusd
      );
      motifG[i] = mG;
      motifY[i] = mY;
      validMotif[i] = 1;
      countsG[mG] += 1;
      countsY[mY] += 1;
      motifWinCount += 1;
    }

    if (i >= period) {
      const oldIdx = i - period;
      if (validMotif[oldIdx]) {
        countsG[motifG[oldIdx]] -= 1;
        countsY[motifY[oldIdx]] -= 1;
        motifWinCount -= 1;
      }
    }

    const hPermG =
      motifWinCount >= 3
        ? normalizedShannonFromCounts(countsG, motifWinCount, LN_6)
        : 0.5;
    const hPermY =
      motifWinCount >= 3
        ? normalizedShannonFromCounts(countsY, motifWinCount, LN_6)
        : 0.5;
    const hPerm = 0.5 * (hPermG + hPermY);
    permutationEntropy[i] = hPerm;

    // 2. Signed 2D Phase Deflection / Turning-Angle Entropy H_Δφ
    if (i >= 1) {
      const stepX = (vx - series[i - 1].xaueur) / scaleX;
      const stepY = (vy - series[i - 1].eurusd) / scaleY;
      const stepMag = Math.sqrt(stepX * stepX + stepY * stepY);

      if (stepMag > 1e-6) {
        if (hasPrevChord) {
          const prevMag = Math.sqrt(prevChordX * prevChordX + prevChordY * prevChordY);
          if (prevMag > 1e-6) {
            const dot =
              (prevChordX * stepX + prevChordY * stepY) / (prevMag * stepMag);
            const cross =
              (prevChordX * stepY - prevChordY * stepX) / (prevMag * stepMag);
            const cVal = Math.max(-1, Math.min(1, dot));
            const sVal = Math.max(-1, Math.min(1, cross));
            const dPhi = Math.atan2(sVal, cVal); // in (-π, π]

            // Map (-π, π] to 8 sectors (0..7), centered so [-π/8, +π/8] is sector 0
            const shifted = (dPhi + Math.PI + Math.PI / 8) % (2 * Math.PI);
            const sec = Math.min(
              7,
              Math.max(0, Math.floor((shifted / (2 * Math.PI)) * 8))
            );

            validTurn[i] = 1;
            turnSector[i] = sec;
            turnCos[i] = cVal;
            turnSin[i] = sVal;

            sectorCounts[sec] += 1;
            sumTurnCos += cVal;
            sumTurnSin += sVal;
            turnWinCount += 1;
          }
        }
        prevChordX = stepX;
        prevChordY = stepY;
        hasPrevChord = true;
      }
    }

    if (i >= period) {
      const oldIdx = i - period;
      if (validTurn[oldIdx]) {
        sectorCounts[turnSector[oldIdx]] -= 1;
        sumTurnCos -= turnCos[oldIdx];
        sumTurnSin -= turnSin[oldIdx];
        turnWinCount -= 1;
      }
    }

    let hTurn = 0.5;
    if (turnWinCount >= 3) {
      const hSector = normalizedShannonFromCounts(
        sectorCounts,
        turnWinCount,
        LN_8
      );
      const meanC = sumTurnCos / turnWinCount;
      const meanS = sumTurnSin / turnWinCount;
      const rBar = Math.min(1, Math.sqrt(meanC * meanC + meanS * meanS));
      const hairpinFrac = Math.min(1, Math.max(0, geo.hairpinRatioPct[i] / 100));

      // Forward/orbital coherence requires both high resultant concentration R̄ and non-hairpin forward alignment (meanC > 0)
      const circularDispersion =
        meanC > 0
          ? Math.max(1 - rBar * rBar, hairpinFrac)
          : Math.max(0.85, hairpinFrac);

      hTurn = Math.max(
        0,
        Math.min(1, 0.55 * hSector + 0.45 * circularDispersion)
      );
    }
    turningEntropy[i] = hTurn;

    // 3. Causal Next-Bar Markov Regime Transition Entropy H(S_{t+1} | S_t)
    if (i >= 1) {
      const prevReg = clusters.regime[i - 1] & 3;
      const currReg = clusters.regime[i] & 3;
      transCounts[prevReg][currReg] += 1.0;

      if (i > markovWin) {
        const oldPrev = clusters.regime[i - markovWin - 1] & 3;
        const oldCurr = clusters.regime[i - markovWin] & 3;
        transCounts[oldPrev][oldCurr] = Math.max(
          0.15,
          transCounts[oldPrev][oldCurr] - 1.0
        );
      }
    }

    const activeRegime = clusters.regime[i] & 3;
    const activeRow = transCounts[activeRegime];
    const rowTotal =
      activeRow[0] + activeRow[1] + activeRow[2] + activeRow[3];
    markovRegimeEntropy[i] = normalizedShannonFromCounts(
      activeRow,
      rowTotal,
      LN_4
    );

    // 4. Composite Phase Disorder Index (0..100%) & Entropy-Quality Coil Score (0..100)
    const compPct = Math.max(
      0,
      Math.min(100, (0.55 * hTurn + 0.45 * hPerm) * 100.0)
    );
    compositeEntropyPct[i] = compPct;

    // Penalize high-entropy bid-ask chop masquerading as a compression coil
    const orderQuality = Math.max(
      0.15,
      Math.min(1.25, 1.35 - 1.15 * (compPct / 100.0))
    );
    entropyQualityCoilScore[i] = Math.max(
      0,
      Math.min(100, geo.coilScore[i] * orderQuality)
    );
  }

  const result: PhaseEntropyResult = {
    permutationEntropy,
    turningEntropy,
    markovRegimeEntropy,
    compositeEntropyPct,
    entropyQualityCoilScore,
  };
  const last = series[len - 1];
  const cacheKey = `${len}:${period}:${last.timestamp}:${last.xauusd}`;
  let map = entropyCache.get(series);
  if (!map) {
    map = new Map();
    entropyCache.set(series, map);
  }
  map.set(cacheKey, result);
  return result;
}

export * from "./crossProxy";
export * from "./strategy";

