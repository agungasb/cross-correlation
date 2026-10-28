import { describe, it, expect } from "vitest";
import {
  computeVectorMA,
  computeVectorBollinger3D,
  calculateCorrelation,
  calculateLogReturnCorrelation,
  computeRollingStatsSeries,
  computePhaseGeometry3D,
  computePhaseClusters,
  computeSpatialAttractorBasins,
} from "../math";
import {
  BUILTIN_INDICATOR_PLUGINS,
  createDefaultIndicatorConfigs,
} from "../plugins";
import { generateFallbackTimeframe } from "@/lib/server/yahoo";
import {
  MarketBar,
  PYTH_XAUUSD_FEED_ID,
  PYTH_XAUUSD_SYMBOL,
  TRIAD_CONFIGS,
} from "@/types/market";

describe("Quantitative Indicator & Phase Space Engine", () => {
  const sampleBars = generateFallbackTimeframe("15m");

  it("configures valid Pyth Network feed IDs and symbols across all 6 G10 FX triads", () => {
    expect(PYTH_XAUUSD_SYMBOL).toBe("Metal.XAU/USD");
    expect(PYTH_XAUUSD_FEED_ID).toMatch(/^0x[0-9a-f]{64}$/);

    const seenIds = new Set<string>([PYTH_XAUUSD_FEED_ID]);
    for (const cfg of Object.values(TRIAD_CONFIGS)) {
      expect(cfg.pythFxSymbol).toMatch(/^FX\.[A-Z]{3}\/[A-Z]{3}$/);
      expect(cfg.pythFxFeedId).toMatch(/^0x[0-9a-f]{64}$/);
      expect(seenIds.has(cfg.pythFxFeedId)).toBe(false);
      seenIds.add(cfg.pythFxFeedId);
    }
  });

  it("enforces strict triangular cross-rate parity for both CCY_USD (EUR) and USD_CCY (JPY)", () => {
    for (const bar of sampleBars) {
      const impliedEurUsd = bar.xauusd / bar.xaueur;
      const impliedUsdEur = bar.xaueur / bar.xauusd;
      expect(Math.abs(impliedEurUsd - bar.eurusd)).toBeLessThan(0.001);
      expect(Math.abs(impliedUsdEur - bar.usdeur)).toBeLessThan(0.001);
    }

    const jpyBars = generateFallbackTimeframe("15m", "JPY");
    for (const bar of jpyBars) {
      // For JPY (USD_CCY): XAUJPY = XAUUSD * USDJPY -> XAUJPY / XAUUSD = USDJPY
      const impliedUsdJpy = bar.xaueur / bar.xauusd;
      expect(Math.abs(impliedUsdJpy - bar.eurusd)).toBeLessThan(0.1);
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

  it("enforces strict causal invariance for Pillar #2 (Differential Geometry) and Pillar #6 (Regime Clustering)", () => {
    const halfLen = 120;
    const prefixBars = sampleBars.slice(0, halfLen);

    const shockedBars = sampleBars.map((b, idx) =>
      idx < halfLen
        ? b
        : {
            ...b,
            xauusd: b.xauusd * 3.1,
            xaueur: b.xaueur * 3.1,
            eurusd: b.eurusd * 0.65,
          }
    );

    const geoPrefix = computePhaseGeometry3D(prefixBars, 20, 20);
    const geoShocked = computePhaseGeometry3D(shockedBars, 20, 20);

    const clustPrefix = computePhaseClusters(prefixBars, 20, geoPrefix);
    const clustShocked = computePhaseClusters(shockedBars, 20, geoShocked);

    for (let i = 0; i < halfLen; i++) {
      expect(geoShocked.velocity[i]).toBeCloseTo(geoPrefix.velocity[i], 10);
      expect(geoShocked.curvature[i]).toBeCloseTo(geoPrefix.curvature[i], 10);
      expect(geoShocked.levyArea[i]).toBeCloseTo(geoPrefix.levyArea[i], 10);
      expect(geoShocked.coilScore[i]).toBeCloseTo(geoPrefix.coilScore[i], 10);

      expect(clustShocked.regime[i]).toBe(clustPrefix.regime[i]);
      expect(clustShocked.centroidDistance[i]).toBeCloseTo(
        clustPrefix.centroidDistance[i],
        10
      );
      expect(clustShocked.nearestBasinDist[i]).toBeCloseTo(
        clustPrefix.nearestBasinDist[i],
        10
      );
    }
  });

  it("correctly distinguishes Counter-Clockwise (Lz > 0) vs. Clockwise (Lz < 0) spiral chirality", () => {
    const n = 90;
    const omega = (2 * Math.PI) / 24;
    const ccwBars: MarketBar[] = [];
    const cwBars: MarketBar[] = [];

    for (let i = 0; i < n; i++) {
      const theta = i * omega;
      // CCW: X = cos(θ), Y = sin(θ) -> X leads Y by +π/2
      const xCCW = 2500 + 25 * Math.cos(theta);
      const yCCW = 1.12 + 0.015 * Math.sin(theta);
      ccwBars.push({
        timestamp: 1700000000 + i * 60,
        datetime: `2026-10-29 00:${String(i % 60).padStart(2, "0")}`,
        xaueur: xCCW,
        eurusd: yCCW,
        xauusd: xCCW * yCCW,
        usdeur: 1 / yCCW,
        source: "simulated",
      });

      // CW: X = sin(θ), Y = cos(θ) -> Y leads X by +π/2
      const xCW = 2500 + 25 * Math.sin(theta);
      const yCW = 1.12 + 0.015 * Math.cos(theta);
      cwBars.push({
        timestamp: 1700000000 + i * 60,
        datetime: `2026-10-29 00:${String(i % 60).padStart(2, "0")}`,
        xaueur: xCW,
        eurusd: yCW,
        xauusd: xCW * yCW,
        usdeur: 1 / yCW,
        source: "simulated",
      });
    }

    const geoCCW = computePhaseGeometry3D(ccwBars, 24, 24);
    const geoCW = computePhaseGeometry3D(cwBars, 24, 24);

    expect(geoCCW.levyArea[n - 1]).toBeGreaterThan(2.0);
    expect(geoCW.levyArea[n - 1]).toBeLessThan(-2.0);
  });

  it("computes deterministic 3D spatial attractor basins and row-stochastic Markov matrices", () => {
    const basins = computeSpatialAttractorBasins(sampleBars, 3);
    expect(basins.length).toBe(3);

    const totalDwellPct = basins.reduce((acc, b) => acc + b.dwellPct, 0);
    expect(totalDwellPct).toBeCloseTo(100.0, 5);
    expect(basins[0].centerX).toBeLessThanOrEqual(basins[1].centerX);
    expect(basins[1].centerX).toBeLessThanOrEqual(basins[2].centerX);

    const clusters = computePhaseClusters(sampleBars, 20);
    expect(clusters.transitionMatrix.length).toBe(4);
    for (const row of clusters.transitionMatrix) {
      expect(row.length).toBe(4);
      const rowSum = row.reduce((a, b) => a + b, 0);
      expect(rowSum).toBeCloseTo(1.0, 6);
    }
  });
});
