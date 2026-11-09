import { describe, it, expect } from "vitest";
import {
  computeVectorMA,
  computeVectorBollinger3D,
  calculateCorrelation,
  calculateLogReturnCorrelation,
  computeRollingStatsSeries,
  computePhaseGeometry3D,
  computePhaseClusters,
  computePhaseEntropy,
  computeSpatialAttractorBasins,
  computeWhitepaperStrategy,
  computeCrossProxyConfluence,
  synthesizeCompanionProxySeries,
  buildSummaryFromSlice,
} from "../math";
import {
  BUILTIN_INDICATOR_PLUGINS,
  CROSS_PROXY_BOUNCE_PLUGIN,
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

    // Warm up V8 JIT and engine caches on sampleBars so AST compilation is not conflated with 320-bar runtime
    for (const plugin of BUILTIN_INDICATOR_PLUGINS) {
      plugin.buildTraces3D({
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
    }

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
    expect(elapsedMs).toBeLessThan(15);
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

  it("categorizes top-down turning angles into <90° forward continuation vs >=90° hairpin reversals", () => {
    const n = 40;
    const linearBars: MarketBar[] = [];
    const zigzagBars: MarketBar[] = [];

    for (let i = 0; i < n; i++) {
      // Collinear forward drift -> 0° deflection angle (< 90°)
      const xLin = 2500 + i * 2.5;
      const yLin = 1.1 + i * 0.0005;
      linearBars.push({
        timestamp: 1700000000 + i * 60,
        datetime: `2026-10-29 01:${String(i % 60).padStart(2, "0")}`,
        xaueur: xLin,
        eurusd: yLin,
        xauusd: xLin * yLin,
        usdeur: 1 / yLin,
        source: "simulated",
      });

      // Alternating zig-zag reversal -> 180° hairpin deflection (>= 90°)
      const sign = i % 2 === 0 ? 1 : -1;
      const xZig = 2500 + sign * 8.0;
      const yZig = 1.1 + sign * 0.002;
      zigzagBars.push({
        timestamp: 1700000000 + i * 60,
        datetime: `2026-10-29 01:${String(i % 60).padStart(2, "0")}`,
        xaueur: xZig,
        eurusd: yZig,
        xauusd: xZig * yZig,
        usdeur: 1 / yZig,
        source: "simulated",
      });
    }

    const geoLin = computePhaseGeometry3D(linearBars, 20, 20);
    const geoZig = computePhaseGeometry3D(zigzagBars, 20, 20);

    for (let i = 5; i < n; i++) {
      expect(geoLin.turningAngleDeg[i]).toBeLessThan(90);
      expect(geoLin.turningAngleDeg[i]).toBeCloseTo(0, 4);
      expect(geoLin.hairpinRatioPct[i]).toBeCloseTo(0, 4);

      expect(geoZig.turningAngleDeg[i]).toBeGreaterThanOrEqual(90);
      expect(geoZig.turningAngleDeg[i]).toBeCloseTo(180, 3);
      expect(geoZig.hairpinRatioPct[i]).toBeCloseTo(100, 4);
    }
  });

  it("enforces strict zero-lookahead causal invariance for the Whitepaper 5-Setup Strategy Engine", () => {
    const halfLen = 160;
    const prefixBars = sampleBars.slice(0, halfLen);

    // Mutate future bars [halfLen..N-1] with extreme price shocks
    const shockedBars = sampleBars.map((b, idx) =>
      idx < halfLen
        ? b
        : {
            ...b,
            xauusd: b.xauusd * 2.8,
            xaueur: b.xaueur * 2.8,
            eurusd: b.eurusd * 0.72,
          }
    );

    const stratPrefix = computeWhitepaperStrategy(prefixBars, {
      pair: "EUR",
      period: 20,
    });
    const stratShocked = computeWhitepaperStrategy(shockedBars, {
      pair: "EUR",
      period: 20,
    });

    for (let i = 0; i < halfLen; i++) {
      expect(stratShocked.signalDir[i]).toBe(stratPrefix.signalDir[i]);
      expect(stratShocked.position[i]).toBe(stratPrefix.position[i]);
      expect(stratShocked.activeSetupId[i]).toBe(stratPrefix.activeSetupId[i]);
      expect(stratShocked.fakeoutFiltered[i]).toBe(
        stratPrefix.fakeoutFiltered[i]
      );
      expect(stratShocked.confidence[i]).toBeCloseTo(
        stratPrefix.confidence[i],
        10
      );
      expect(stratShocked.equityCurveUsd[i]).toBeCloseTo(
        stratPrefix.equityCurveUsd[i],
        10
      );
      expect(stratShocked.isoCutEfficiency[i]).toBeCloseTo(
        stratPrefix.isoCutEfficiency[i],
        10
      );
    }

    const prefixSummaryFromShocked = buildSummaryFromSlice(
      stratShocked.events,
      stratShocked.trades,
      stratShocked.equityCurvePct,
      stratShocked.drawdownPct,
      halfLen
    );
    expect(prefixSummaryFromShocked.totalTrades).toBe(
      stratPrefix.summary.totalTrades
    );
    expect(prefixSummaryFromShocked.buyCount).toBe(
      stratPrefix.summary.buyCount
    );
    expect(prefixSummaryFromShocked.sellCount).toBe(
      stratPrefix.summary.sellCount
    );
  });

  it("produces valid BUY and SELL signals and positive expectancy across all 6 G10 triads and timeframes", () => {
    const pairs = ["EUR", "JPY", "GBP", "CHF", "AUD", "CAD"] as const;
    const tfs = ["1m", "5m", "15m", "1h", "1d"] as const;

    let totalSignalsAcrossUniverse = 0;
    let totalTradesAcrossUniverse = 0;
    let totalWinningTrades = 0;
    let totalNetPnlUsd = 0;

    for (const pair of pairs) {
      for (const tf of tfs) {
        const bars = generateFallbackTimeframe(tf, pair);
        const res = computeWhitepaperStrategy(bars, { pair, period: 20 });

        expect(res.signalDir.length).toBe(bars.length);
        expect(res.equityCurvePct.length).toBe(bars.length);
        expect(res.summary.winRatePct).toBeGreaterThanOrEqual(0);
        expect(res.summary.winRatePct).toBeLessThanOrEqual(100);

        // Every 3D MA Spine Equilibrium exit must be net profitable (no spine-drift losses)
        for (const t of res.trades) {
          if (t.exitReason === "3D MA Spine Equilibrium Reached") {
            expect(t.pnlUsd).toBeGreaterThan(0);
          }
        }

        totalSignalsAcrossUniverse +=
          res.summary.buyCount + res.summary.sellCount;
        totalTradesAcrossUniverse += res.summary.totalTrades;
        totalWinningTrades += res.summary.winningTrades;
        totalNetPnlUsd += res.summary.totalNetPnlUsd;
      }
    }

    const universeWinRatePct =
      (totalWinningTrades / Math.max(1, totalTradesAcrossUniverse)) * 100;
    expect(totalSignalsAcrossUniverse).toBeGreaterThan(20);
    expect(totalTradesAcrossUniverse).toBeGreaterThan(15);
    expect(universeWinRatePct).toBeGreaterThan(64);
    expect(totalNetPnlUsd).toBeGreaterThan(800);
  });

  it("blocks passive FX-driven spikes via Setup 2 Filter and triggers Exhaustion Curvature Hooks via Setup 3", () => {
    // 1. Construct a trajectory with CW FX-led rotation sliding along an Iso-XAUUSD contour inside basin (Setup 2 Filter)
    const cwBars: MarketBar[] = [];
    for (let i = 0; i < 60; i++) {
      const theta = (i * 2 * Math.PI) / 20;
      // CW spiral where X and Y move in opposite standardized directions (sliding along hyperbola)
      const x = 3500 + 8 * Math.sin(theta) - 4 * Math.cos(theta);
      const y = 1.12 + 0.004 * Math.cos(theta);
      const g = x * y;
      cwBars.push({
        timestamp: 1700000000 + i * 60,
        datetime: `2026-10-29 02:${String(i % 60).padStart(2, "0")}`,
        xaueur: x,
        eurusd: y,
        xauusd: g,
        usdeur: 1 / y,
        source: "simulated",
      });
    }

    const resCw = computeWhitepaperStrategy(cwBars, {
      pair: "EUR",
      period: 16,
    });
    const totalFilteredBars = resCw.fakeoutFiltered.reduce((a, b) => a + b, 0);
    expect(totalFilteredBars).toBeGreaterThan(0);

    // 2. Construct an Exhaustion Blow-Off followed by a sharp Frenet-Serret Curvature Hook (Setup 3 SELL)
    const hookBars: MarketBar[] = [];
    for (let i = 0; i < 45; i++) {
      let x = 3500 + Math.sin(i * 0.4) * 3;
      let y = 1.12 + Math.cos(i * 0.4) * 0.001;
      if (i >= 30 && i <= 35) {
        // Parabolic blow-off across Iso-XAUUSD contours
        const step = i - 29;
        x = 3500 + step * step * 3.5;
        y = 1.12 + step * step * 0.0012;
      } else if (i === 36) {
        // Sudden V-hook reversal (high 3D curvature κ & decelerating velocity while still > 2σ above spine)
        x = 3500 + 25 * 3.5 - 18;
        y = 1.12 + 25 * 0.0012 - 0.006;
      } else if (i > 36) {
        // Mean reversion back to spine
        const decay = Math.max(0, 1 - (i - 36) * 0.2);
        x = 3500 + 60 * decay;
        y = 1.12 + 0.02 * decay;
      }
      hookBars.push({
        timestamp: 1700000000 + i * 60,
        datetime: `2026-10-29 03:${String(i % 60).padStart(2, "0")}`,
        xaueur: x,
        eurusd: y,
        xauusd: x * y,
        usdeur: 1 / y,
        source: "simulated",
      });
    }

    const resHook = computeWhitepaperStrategy(hookBars, {
      pair: "EUR",
      period: 20,
      enableSetup1: false,
      enableSetup2: false,
      enableSetup3: true,
      enableSetup4: false,
      enableSetup5: false,
    });
    const sellEvents = resHook.events.filter(
      (e) => e.action === "SELL" && e.setupId === 3
    );
    expect(sellEvents.length).toBeGreaterThanOrEqual(1);
    // Must not short prematurely during the accelerating blow-off bars [30..35]
    expect(sellEvents[0].barIndex).toBe(36);
    expect(sellEvents[0].stopLossXauusd).toBeGreaterThan(
      sellEvents[0].priceXauusd
    );
    expect(sellEvents[0].takeProfitXauusd).toBeLessThan(
      sellEvents[0].priceXauusd
    );
  });

  it("enforces strict zero-lookahead causal invariance for Phase-Space Entropy (Turning, Permutation, Markov)", () => {
    const halfLen = 140;
    const prefixBars = sampleBars.slice(0, halfLen);

    const shockedBars = sampleBars.map((b, idx) =>
      idx < halfLen
        ? b
        : {
            ...b,
            xauusd: b.xauusd * 2.9,
            xaueur: b.xaueur * 2.9,
            eurusd: b.eurusd * 0.68,
          }
    );

    const entPrefix = computePhaseEntropy(prefixBars, 24);
    const entShocked = computePhaseEntropy(shockedBars, 24);

    for (let i = 0; i < halfLen; i++) {
      expect(entShocked.permutationEntropy[i]).toBeCloseTo(
        entPrefix.permutationEntropy[i],
        10
      );
      expect(entShocked.turningEntropy[i]).toBeCloseTo(
        entPrefix.turningEntropy[i],
        10
      );
      expect(entShocked.markovRegimeEntropy[i]).toBeCloseTo(
        entPrefix.markovRegimeEntropy[i],
        10
      );
      expect(entShocked.compositeEntropyPct[i]).toBeCloseTo(
        entPrefix.compositeEntropyPct[i],
        10
      );
      expect(entShocked.entropyQualityCoilScore[i]).toBeCloseTo(
        entPrefix.entropyQualityCoilScore[i],
        10
      );
    }
  });

  it("empirically separates low-entropy ordered trajectories (ballistic trend & harmonic orbit) from high-entropy random chop", () => {
    const n = 96;
    const omega = (2 * Math.PI) / 28;
    const trendBars: MarketBar[] = [];
    const orbitBars: MarketBar[] = [];
    const chopBars: MarketBar[] = [];

    for (let i = 0; i < n; i++) {
      // 1. Ballistic monotonic trend
      const xTrend = 2500 + i * 3.0;
      const yTrend = 1.1 + i * 0.0006;
      trendBars.push({
        timestamp: 1700000000 + i * 60,
        datetime: `2026-10-29 02:${String(i % 60).padStart(2, "0")}`,
        xaueur: xTrend,
        eurusd: yTrend,
        xauusd: xTrend * yTrend,
        usdeur: 1 / yTrend,
        source: "simulated",
      });

      // 2. Smooth harmonic CCW orbit
      const theta = i * omega;
      const xOrb = 2500 + 20 * Math.cos(theta);
      const yOrb = 1.12 + 0.012 * Math.sin(theta);
      orbitBars.push({
        timestamp: 1700000000 + i * 60,
        datetime: `2026-10-29 02:${String(i % 60).padStart(2, "0")}`,
        xaueur: xOrb,
        eurusd: yOrb,
        xauusd: xOrb * yOrb,
        usdeur: 1 / yOrb,
        source: "simulated",
      });

      // 3. Multi-directional deterministic pseudo-random chop (irrational golden-angle scatter + alternating sign)
      const goldenAngle = i * 2.399963229728653 * (i % 2 === 0 ? 1 : -1.7);
      const rJitter = 1.2 + (i % 5) * 0.45;
      const xChop = 2500 + rJitter * Math.cos(goldenAngle);
      const yChop = 1.12 + rJitter * 0.0008 * Math.sin(goldenAngle * 1.37);
      chopBars.push({
        timestamp: 1700000000 + i * 60,
        datetime: `2026-10-29 02:${String(i % 60).padStart(2, "0")}`,
        xaueur: xChop,
        eurusd: yChop,
        xauusd: xChop * yChop,
        usdeur: 1 / yChop,
        source: "simulated",
      });
    }

    const entTrend = computePhaseEntropy(trendBars, 28);
    const entOrbit = computePhaseEntropy(orbitBars, 28);
    const geoChop = computePhaseGeometry3D(chopBars, 28, 28);
    const entChop = computePhaseEntropy(chopBars, 28, geoChop);

    const last = n - 1;
    // Ballistic trend has near-zero permutation and turning entropy
    expect(entTrend.permutationEntropy[last]).toBeLessThan(0.05);
    expect(entTrend.turningEntropy[last]).toBeLessThan(0.05);
    expect(entTrend.compositeEntropyPct[last]).toBeLessThan(5);

    // Smooth harmonic orbit maintains low turning & composite entropy (< 35%)
    expect(entOrbit.turningEntropy[last]).toBeLessThan(0.25);
    expect(entOrbit.compositeEntropyPct[last]).toBeLessThan(35);

    // Multi-directional chop exhibits high permutation, turning, and composite entropy (> 75%)
    expect(entChop.permutationEntropy[last]).toBeGreaterThan(0.75);
    expect(entChop.turningEntropy[last]).toBeGreaterThan(0.75);
    expect(entChop.compositeEntropyPct[last]).toBeGreaterThan(75);

    // Entropy-Quality Coil Score suppresses high-entropy chop relative to raw coilScore
    expect(entChop.entropyQualityCoilScore[last]).toBeLessThan(
      geoChop.coilScore[last] * 0.55
    );
  });

  it("enforces strict zero-lookahead causal invariance for the Multi-Proxy Cross-Confirmation & Implied XAUUSD Bounce Confluence Engine", () => {
    const halfLen = 140;
    const prefixBars = sampleBars.slice(0, halfLen);
    const prefixProxies = synthesizeCompanionProxySeries(prefixBars, "EUR");

    // Mutate future bars [halfLen .. end] with extreme multi-proxy shocks
    const shockedBars = sampleBars.map((b, idx) =>
      idx < halfLen
        ? { ...b }
        : {
            ...b,
            xaueur: b.xaueur * 1.38,
            eurusd: b.eurusd * 0.82,
            xauusd: b.xaueur * 1.38 * (b.eurusd * 0.82),
          }
    );
    const shockedProxies = synthesizeCompanionProxySeries(shockedBars, "EUR");

    const cpPrefix = computeCrossProxyConfluence(prefixBars, {
      primaryPair: "EUR",
      period: 20,
      crossProxySeries: prefixProxies,
    });
    const cpShocked = computeCrossProxyConfluence(shockedBars, {
      primaryPair: "EUR",
      period: 20,
      crossProxySeries: shockedProxies,
      effectiveEnd: halfLen,
    });

    expect(cpPrefix.proxyCount).toBe(6);
    expect(cpShocked.proxyCount).toBe(6);

    for (let i = 0; i < halfLen; i++) {
      expect(cpShocked.bullionBreadth[i]).toBeCloseTo(
        cpPrefix.bullionBreadth[i],
        10
      );
      expect(cpShocked.chiralityConsensus[i]).toBeCloseTo(
        cpPrefix.chiralityConsensus[i],
        10
      );
      expect(cpShocked.consensusSpineXauusd[i]).toBeCloseTo(
        cpPrefix.consensusSpineXauusd[i],
        8
      );
      expect(cpShocked.consensusSpineZ[i]).toBeCloseTo(
        cpPrefix.consensusSpineZ[i],
        8
      );
      expect(cpShocked.nearestSupportXauusd[i]).toBeCloseTo(
        cpPrefix.nearestSupportXauusd[i],
        8
      );
      expect(cpShocked.nearestResistanceXauusd[i]).toBeCloseTo(
        cpPrefix.nearestResistanceXauusd[i],
        8
      );
      expect(cpShocked.bounceSignalBias[i]).toBeCloseTo(
        cpPrefix.bounceSignalBias[i],
        10
      );
    }

    // Clustered bounce zones at effectiveEnd = halfLen must match identically
    expect(cpShocked.latestBounceZones.length).toBe(
      cpPrefix.latestBounceZones.length
    );
    for (let z = 0; z < cpPrefix.latestBounceZones.length; z++) {
      expect(cpShocked.latestBounceZones[z].centerPriceXauusd).toBeCloseTo(
        cpPrefix.latestBounceZones[z].centerPriceXauusd,
        8
      );
      expect(cpShocked.latestBounceZones[z].confluenceScore).toBe(
        cpPrefix.latestBounceZones[z].confluenceScore
      );
    }
  });

  it("projects ranked High-Probability XAUUSD Support & Resistance Bounce Zones across all 6 G10 triads and achieves positive PnL on all 5 setups", () => {
    const pairs = ["EUR", "JPY", "GBP", "CHF", "AUD", "CAD"] as const;
    const tfs = ["1m", "5m", "15m", "1h", "1d"] as const;

    const pnlBySetup: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalWins = 0;
    let totalTrades = 0;
    let totalPnl = 0;

    for (const pair of pairs) {
      for (const tf of tfs) {
        const bars = generateFallbackTimeframe(tf, pair);
        const crossProxySeries = synthesizeCompanionProxySeries(bars, pair);
        const res = computeWhitepaperStrategy(bars, {
          pair,
          period: 20,
          enableCrossProxyConfirmation: true,
          crossProxySeries,
        });

        expect(res.crossProxy.proxyCount).toBe(6);
        expect(res.crossProxy.latestTriadSnapshots.length).toBe(6);
        expect(res.crossProxy.latestBounceZones.length).toBeGreaterThanOrEqual(
          2
        );

        const lastG = bars[bars.length - 1].xauusd;
        const lastIdx = bars.length - 1;
        expect(res.crossProxy.nearestSupportXauusd[lastIdx]).toBeLessThan(
          lastG
        );
        expect(
          res.crossProxy.nearestResistanceXauusd[lastIdx]
        ).toBeGreaterThan(lastG);

        // Bounce zones must be sorted in descending order of confluenceScore
        for (let z = 1; z < res.crossProxy.latestBounceZones.length; z++) {
          expect(
            res.crossProxy.latestBounceZones[z - 1].confluenceScore
          ).toBeGreaterThanOrEqual(
            res.crossProxy.latestBounceZones[z].confluenceScore
          );
          expect(
            res.crossProxy.latestBounceZones[z].bounceProbabilityPct
          ).toBeGreaterThanOrEqual(35);
          expect(
            res.crossProxy.latestBounceZones[z].bounceProbabilityPct
          ).toBeLessThanOrEqual(94);
        }

        totalWins += res.summary.winningTrades;
        totalTrades += res.summary.totalTrades;
        totalPnl += res.summary.totalNetPnlUsd;
        for (const t of res.trades) {
          pnlBySetup[t.setupId] += t.pnlUsd;
        }
      }
    }

    const multiProxyWinRate = (totalWins / Math.max(1, totalTrades)) * 100;
    expect(multiProxyWinRate).toBeGreaterThan(65);
    expect(totalPnl).toBeGreaterThan(900);

    // Every single one of the 5 setups must be individually net profitable
    expect(pnlBySetup[1]).toBeGreaterThan(0);
    expect(pnlBySetup[2]).toBeGreaterThan(0);
    expect(pnlBySetup[3]).toBeGreaterThan(0);
    expect(pnlBySetup[4]).toBeGreaterThan(0);
    expect(pnlBySetup[5]).toBeGreaterThan(0);
  });

  it("renders 3D Cross-Proxy Bounce Zone iso-contours and summary readouts for both CCY_USD (EUR) and USD_CCY (JPY)", () => {
    const configs = createDefaultIndicatorConfigs();
    expect(configs["cross-proxy-bounce-3d"]).toBeDefined();
    expect(configs["cross-proxy-bounce-3d"].enabled).toBe(true);

    // 1. Test CCY_USD (EUR): X * Y = G_zone on 3D contours
    const eurTraces = CROSS_PROXY_BOUNCE_PLUGIN.buildTraces3D({
      triadPair: "EUR",
      fullSeries: sampleBars,
      activeSlice: sampleBars,
      startIdx: 0,
      effectiveEnd: sampleBars.length,
      xVals: sampleBars.map((d) => d.xaueur),
      yVals: sampleBars.map((d) => d.eurusd),
      zVals: sampleBars.map((_, idx) => idx),
      zFloor: 0,
      timeframe: "15m",
      isReplaying: false,
      params: configs["cross-proxy-bounce-3d"].params,
      allConfigs: configs,
    });
    expect(eurTraces.length).toBeGreaterThanOrEqual(3);

    const eurAnchorTrace = eurTraces.find(
      (t) => t.name === "Implied XAUUSD Bounce Anchors"
    );
    expect(eurAnchorTrace).toBeDefined();
    expect((eurAnchorTrace?.x as number[]).length).toBeGreaterThanOrEqual(2);

    const eurReadout = CROSS_PROXY_BOUNCE_PLUGIN.getSummaryReadout?.({
      triadPair: "EUR",
      fullSeries: sampleBars,
      activeSlice: sampleBars,
      startIdx: 0,
      effectiveEnd: sampleBars.length,
      xVals: sampleBars.map((d) => d.xaueur),
      yVals: sampleBars.map((d) => d.eurusd),
      zVals: sampleBars.map((_, idx) => idx),
      zFloor: 0,
      timeframe: "15m",
      isReplaying: false,
      params: configs["cross-proxy-bounce-3d"].params,
      allConfigs: configs,
    });
    expect(eurReadout).not.toBeNull();
    expect(eurReadout?.label).toContain("6G10");
    expect(eurReadout?.secondaryValue).toContain("$");

    // 2. Test USD_CCY (JPY): X / Y = G_zone on 3D contours
    const jpyBars = generateFallbackTimeframe("15m", "JPY");
    const jpyTraces = CROSS_PROXY_BOUNCE_PLUGIN.buildTraces3D({
      triadPair: "JPY",
      fullSeries: jpyBars,
      activeSlice: jpyBars,
      startIdx: 0,
      effectiveEnd: jpyBars.length,
      xVals: jpyBars.map((d) => d.xaueur),
      yVals: jpyBars.map((d) => d.eurusd),
      zVals: jpyBars.map((_, idx) => idx),
      zFloor: 0,
      timeframe: "15m",
      isReplaying: false,
      params: configs["cross-proxy-bounce-3d"].params,
      allConfigs: configs,
    });
    expect(jpyTraces.length).toBeGreaterThanOrEqual(3);

    const firstContour = jpyTraces[0];
    const cx = (firstContour.x as number[])[0];
    const cy = (firstContour.y as number[])[0];
    const impliedJpyGold = cx / cy;
    expect(impliedJpyGold).toBeGreaterThan(2000);
    expect(impliedJpyGold).toBeLessThan(8000);
  });
});
