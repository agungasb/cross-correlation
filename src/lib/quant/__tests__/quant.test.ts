import { describe, it, expect } from "vitest";
import {
  computeVectorMA,
  computeVectorBollinger3D,
  calculateCorrelation,
  calculateLogReturnCorrelation,
  computeRollingStatsSeries,
} from "../math";
import {
  BUILTIN_INDICATOR_PLUGINS,
  createDefaultIndicatorConfigs,
} from "../plugins";
import { generateFallbackTimeframe } from "@/lib/server/yahoo";

describe("Quantitative Indicator & Phase Space Engine", () => {
  const sampleBars = generateFallbackTimeframe("15m");

  it("enforces strict triangular cross-rate parity (XAUUSD / XAUEUR = EURUSD)", () => {
    for (const bar of sampleBars) {
      const impliedEurUsd = bar.xauusd / bar.xaueur;
      const impliedUsdEur = bar.xaueur / bar.xauusd;
      expect(Math.abs(impliedEurUsd - bar.eurusd)).toBeLessThan(0.001);
      expect(Math.abs(impliedUsdEur - bar.usdeur)).toBeLessThan(0.001);
    }
  });

  it("computes SMA and EMA with strictly zero lookahead bias (causal invariance)", () => {
    const halfLen = 120;
    const prefixBars = sampleBars.slice(0, halfLen);

    // Mutate future bars drastically
    const shockedBars = sampleBars.map((b, idx) =>
      idx < halfLen
        ? b
        : {
            ...b,
            xauusd: b.xauusd * 2.5,
            xaueur: b.xaueur * 2.5,
            eurusd: b.eurusd * 0.7,
          }
    );

    const smaPrefix = computeVectorMA(prefixBars, 20, "SMA");
    const smaShocked = computeVectorMA(shockedBars, 20, "SMA");

    const emaPrefix = computeVectorMA(prefixBars, 20, "EMA");
    const emaShocked = computeVectorMA(shockedBars, 20, "EMA");

    for (let i = 0; i < halfLen; i++) {
      expect(smaShocked.xMA[i]).toBeCloseTo(smaPrefix.xMA[i], 10);
      expect(smaShocked.yMA[i]).toBeCloseTo(smaPrefix.yMA[i], 10);
      expect(smaShocked.displacementPct[i]).toBeCloseTo(
        smaPrefix.displacementPct[i],
        10
      );
      expect(smaShocked.displacementZScore[i]).toBeCloseTo(
        smaPrefix.displacementZScore[i],
        10
      );

      expect(emaShocked.xMA[i]).toBeCloseTo(emaPrefix.xMA[i], 10);
      expect(emaShocked.yMA[i]).toBeCloseTo(emaPrefix.yMA[i], 10);
    }
  });

  it("computes rolling correlations and basis series within [-1, 1]", () => {
    const stats = computeRollingStatsSeries(sampleBars, 30);
    expect(stats.levelCorrelation.length).toBe(sampleBars.length);
    expect(stats.returnCorrelation.length).toBe(sampleBars.length);

    for (let i = 10; i < sampleBars.length; i++) {
      expect(stats.levelCorrelation[i]).toBeGreaterThanOrEqual(-1.00001);
      expect(stats.levelCorrelation[i]).toBeLessThanOrEqual(1.00001);
      expect(stats.returnCorrelation[i]).toBeGreaterThanOrEqual(-1.00001);
      expect(stats.returnCorrelation[i]).toBeLessThanOrEqual(1.00001);
    }

    const fullRetCorr = calculateLogReturnCorrelation(sampleBars);
    expect(fullRetCorr).toBeGreaterThanOrEqual(-1);
    expect(fullRetCorr).toBeLessThanOrEqual(1);
    expect(calculateCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1.0, 6);
  });

  it("builds 3D traces for all registered plugins under 15ms for 320 bars", () => {
    const configs = createDefaultIndicatorConfigs();
    const xVals = sampleBars.map((b) => b.xaueur);
    const yVals = sampleBars.map((b) => b.eurusd);
    const zVals = sampleBars.map(
      (b) => (b.timestamp - sampleBars[0].timestamp) / 3600
    );

    const t0 = performance.now();
    for (const plugin of BUILTIN_INDICATOR_PLUGINS) {
      const traces = plugin.buildTraces3D({
        fullSeries: sampleBars,
        activeSlice: sampleBars,
        startIdx: 0,
        effectiveEnd: sampleBars.length,
        xVals,
        yVals,
        zVals,
        zFloor: 0,
        timeframe: "15m",
        isReplaying: false,
        params: configs[plugin.id].params,
        allConfigs: configs,
      });
      expect(traces.length).toBeGreaterThan(0);
    }
    const bb = computeVectorBollinger3D(sampleBars, 20);
    expect(bb.xStd.length).toBe(sampleBars.length);
    const elapsedMs = performance.now() - t0;
    expect(elapsedMs).toBeLessThan(25);
  });
});
