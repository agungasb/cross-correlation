import { MarketBar, TimeframeId } from "@/types/market";

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
  windowInput = 30
): RollingStatsSeries {
  const len = series.length;
  const win = Math.max(5, Math.min(200, Math.floor(windowInput)));
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
    const refXaueur = bar.marketXaueur ?? bar.xaueur;
    const impliedEur = bar.xauusd / refXaueur;
    basisPips[i] = (bar.eurusd - impliedEur) * 10000.0;

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
