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

  return { xMA, yMA, displacementPct, displacementZScore };
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

  const normX = new Float64Array(len);
  const normY = new Float64Array(len);
  const radialDist = new Float64Array(len);
  const velocity = new Float64Array(len);
  const curvature = new Float64Array(len);
  const levyArea = new Float64Array(len);
  const coilScore = new Float64Array(len);

  if (len === 0) {
    return {
      normX,
      normY,
      radialDist,
      velocity,
      curvature,
      levyArea,
      coilScore,
    };
  }

  const instLevy = new Float64Array(len);
  let sumX = 0,
    sumX2 = 0,
    sumY = 0,
    sumY2 = 0;
  let levySum = 0;

  let prevEmaVx = 0;
  let prevEmaVy = 0;
  let emaR = 0;
  let emaV = 0;
  let emaK = 0;

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

    if (n >= 2) {
      const varX = Math.max(0, sumX2 / n - mx * mx);
      const varY = Math.max(0, sumY2 / n - my * my);
      const stdX = Math.sqrt(varX);
      const stdY = Math.sqrt(varY);
      const fallbackScaleX = Math.abs(mx) * 1e-4 || 1e-6;
      const fallbackScaleY = Math.abs(my) * 1e-4 || 1e-6;
      normX[i] = (vx - mx) / (stdX > 1e-9 ? stdX : fallbackScaleX);
      normY[i] = (vy - my) / (stdY > 1e-9 ? stdY : fallbackScaleY);
    }

    const rNow = Math.hypot(normX[i], normY[i]);
    radialDist[i] = rNow;

    if (i >= 1) {
      const dx = normX[i] - normX[i - 1];
      const dy = normY[i] - normY[i - 1];

      // Causal 3-bar EMA (α = 0.5) on first phase differences
      const emaVx = i === 1 ? dx : 0.5 * dx + 0.5 * prevEmaVx;
      const emaVy = i === 1 ? dy : 0.5 * dy + 0.5 * prevEmaVy;

      const ax = i >= 2 ? emaVx - prevEmaVx : 0;
      const ay = i >= 2 ? emaVy - prevEmaVy : 0;
      prevEmaVx = emaVx;
      prevEmaVy = emaVy;

      const vNow = Math.hypot(emaVx, emaVy);
      velocity[i] = vNow;

      // Regularized 3D space-time curvature γ(t) = (x̃(t), ỹ(t), t) where ż = 1, z̈ = 0
      const crossZ = emaVx * ay - emaVy * ax;
      const numK = Math.sqrt(ax * ax + ay * ay + crossZ * crossZ);
      const denK = Math.pow(emaVx * emaVx + emaVy * emaVy + 1.0, 1.5);
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

  return {
    normX,
    normY,
    radialDist,
    velocity,
    curvature,
    levyArea,
    coilScore,
  };
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

  return {
    regime,
    centroidDistance,
    nearestBasinDist,
    transitionMatrix: computeMarkovTransitionMatrix(regime, len),
    regimeCounts,
  };
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
