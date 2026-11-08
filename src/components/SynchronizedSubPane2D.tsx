"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import {
  buildSummaryFromSlice,
  computePhaseClusters,
  computePhaseEntropy,
  computePhaseGeometry3D,
  computeRollingStatsSeries,
  computeVectorMA,
  computeWhitepaperStrategy,
  PHASE_REGIME_META,
  STRATEGY_SETUP_META,
  StrategySetupId,
  synthesizeCompanionProxySeries,
} from "@/lib/quant/math";
import { PhaseRegimeId, SubPaneMode, TRIAD_CONFIGS } from "@/types/market";
import {
  Activity,
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronUp,
  Compass,
  GitCompare,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Sparkles,
  Target,
} from "lucide-react";

export default function SynchronizedSubPane2D() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [paneHeight, setPaneHeight] = useState<number>(175);
  const [canvasDims, setCanvasDims] = useState<{ width: number; height: number }>({
    width: 800,
    height: 145,
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setPaneHeight(140);
    }
  }, []);

  const triadPair = useAnalyzerStore((s) => s.triadPair);
  const dataSeries = useAnalyzerStore((s) => s.dataSeries);
  const triad = TRIAD_CONFIGS[triadPair] ?? TRIAD_CONFIGS.EUR;
  const subPaneMode = useAnalyzerStore((s) => s.subPaneMode);
  const setSubPaneMode = useAnalyzerStore((s) => s.setSubPaneMode);
  const replayIndex = useAnalyzerStore((s) => s.replayIndex);
  const setReplayIndex = useAnalyzerStore((s) => s.setReplayIndex);
  const replayTraceMode = useAnalyzerStore((s) => s.replayTraceMode);
  const trailLength = useAnalyzerStore((s) => s.trailLength);
  const indicators = useAnalyzerStore((s) => s.indicators);

  const maPeriod = Number(indicators["vector-ma"]?.params?.period ?? 20);
  const maType = (
    indicators["vector-ma"]?.params?.maType === "EMA" ? "EMA" : "SMA"
  ) as "SMA" | "EMA";
  const stratCfg = indicators["strategy-signals-3d"]?.params;
  const coilThreshold = Number(stratCfg?.coilThreshold ?? 42);
  const curvatureHookThreshold = Number(
    stratCfg?.curvatureHookThreshold ?? 0.34
  );
  const minConfidence = Number(stratCfg?.minConfidence ?? 52);

  const quantData = useMemo(() => {
    if (dataSeries.length === 0) return null;
    const ma = computeVectorMA(dataSeries, maPeriod, maType);
    const rolling = computeRollingStatsSeries(
      dataSeries,
      Math.max(10, maPeriod),
      triadPair
    );
    const geo = computePhaseGeometry3D(dataSeries, maPeriod, maPeriod);
    const clusters = computePhaseClusters(dataSeries, maPeriod, geo);
    const entropy = computePhaseEntropy(dataSeries, maPeriod, geo, clusters);
    const crossProxySeries = synthesizeCompanionProxySeries(
      dataSeries,
      triadPair
    );
    const strategy = computeWhitepaperStrategy(dataSeries, {
      pair: triadPair,
      period: maPeriod,
      maType,
      coilThreshold,
      curvatureHookThreshold,
      minConfidence,
      crossProxySeries,
      precomputedMA: ma,
      precomputedGeo: geo,
      precomputedClusters: clusters,
      precomputedEntropy: entropy,
    });
    return { ma, rolling, geo, clusters, entropy, strategy };
  }, [
    dataSeries,
    maPeriod,
    maType,
    triadPair,
    coilThreshold,
    curvatureHookThreshold,
    minConfidence,
  ]);

  const effectiveEnd = Math.max(
    1,
    Math.min(dataSeries.length, replayIndex || dataSeries.length)
  );
  const startIdx =
    replayTraceMode === "accumulate"
      ? Math.max(0, effectiveEnd - 1000)
      : Math.max(0, effectiveEnd - trailLength);

  // Observe wrapper dimensions without feedback loops
  useEffect(() => {
    if (subPaneMode === "hidden" || !wrapperRef.current) return;
    const el = wrapperRef.current;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(200, Math.floor(rect.width));
      const h = Math.max(80, Math.floor(rect.height));
      setCanvasDims((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h }
      );
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [subPaneMode, paneHeight]);

  // Drag-to-resize top border handler (Mouse + Touch)
  const startResizeAtY = (startY: number, isTouch: boolean) => {
    const startH = paneHeight;

    const applyDelta = (clientY: number) => {
      const deltaY = startY - clientY;
      const nextH = Math.max(110, Math.min(480, startH + deltaY));
      setPaneHeight(nextH);
      if (subPaneMode === "hidden") {
        setSubPaneMode("displacement");
      }
    };

    if (isTouch) {
      const onTouchMove = (te: TouchEvent) => {
        if (te.touches[0]) applyDelta(te.touches[0].clientY);
      };
      const onTouchEnd = () => {
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
      };
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend", onTouchEnd);
    } else {
      const onMove = (me: MouseEvent) => applyDelta(me.clientY);
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
  };

  // Main 2D Canvas Render
  useEffect(() => {
    if (
      subPaneMode === "hidden" ||
      !canvasRef.current ||
      !quantData ||
      dataSeries.length === 0
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const width = canvasDims.width;
    const height = canvasDims.height;

    const targetW = Math.floor(width * dpr);
    const targetH = Math.floor(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background fill
    ctx.fillStyle = "#080c14";
    ctx.fillRect(0, 0, width, height);

    const padLeft = 56;
    const padRight = 56;
    const padTop = 24;
    const padBottom = 22;
    const plotW = Math.max(20, width - padLeft - padRight);
    const plotH = Math.max(20, height - padTop - padBottom);

    const sliceLen = Math.max(1, effectiveEnd - startIdx);
    const xAt = (i: number) =>
      padLeft + (sliceLen <= 1 ? plotW : (i / (sliceLen - 1)) * plotW);

    // Subtle horizontal grid lines
    ctx.strokeStyle = "#141d2e";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const gy = padTop + (g / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, gy);
      ctx.lineTo(padLeft + plotW, gy);
      ctx.stroke();
    }

    // Plot Frame Border
    ctx.strokeStyle = "#1e293b";
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    if (subPaneMode === "displacement") {
      const zSlice = quantData.ma.displacementZScore.subarray(
        startIdx,
        effectiveEnd
      );
      const dispSlice = quantData.ma.displacementPct.subarray(
        startIdx,
        effectiveEnd
      );

      let maxZ = 2.8;
      let maxDisp = 0.25;
      for (let i = 0; i < zSlice.length; i++) {
        const az = Math.abs(zSlice[i]);
        if (az > maxZ) maxZ = Math.min(4.5, az * 1.1);
        if (dispSlice[i] > maxDisp) maxDisp = dispSlice[i] * 1.15;
      }

      const yAtZ = (z: number) => {
        const clamped = Math.max(-maxZ, Math.min(maxZ, z));
        return padTop + ((maxZ - clamped) / (2 * maxZ)) * plotH;
      };

      const yAtDisp = (d: number) => {
        const clamped = Math.max(0, Math.min(maxDisp, d));
        return padTop + (1 - clamped / maxDisp) * plotH;
      };

      const yZero = yAtZ(0);
      const yPlus2 = yAtZ(2);
      const yMinus1 = yAtZ(-1);

      // +2.0σ statistical threshold line
      ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, yPlus2);
      ctx.lineTo(padLeft + plotW, yPlus2);
      ctx.stroke();

      // -1.0σ quiet equilibrium band
      ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
      ctx.beginPath();
      ctx.moveTo(padLeft, yMinus1);
      ctx.lineTo(padLeft + plotW, yMinus1);
      ctx.stroke();

      // 0.0σ mean line
      ctx.strokeStyle = "#334155";
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padLeft, yZero);
      ctx.lineTo(padLeft + plotW, yZero);
      ctx.stroke();

      // Shaded area under Displacement % (Amber secondary axis)
      if (dispSlice.length > 1) {
        ctx.beginPath();
        ctx.moveTo(xAt(0), padTop + plotH);
        for (let i = 0; i < dispSlice.length; i++) {
          ctx.lineTo(xAt(i), yAtDisp(dispSlice[i]));
        }
        ctx.lineTo(xAt(dispSlice.length - 1), padTop + plotH);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
        grad.addColorStop(0, "rgba(245, 158, 11, 0.22)");
        grad.addColorStop(1, "rgba(245, 158, 11, 0.02)");
        ctx.fillStyle = grad;
        ctx.fill();

        // Displacement % line (Amber)
        ctx.beginPath();
        for (let i = 0; i < dispSlice.length; i++) {
          const px = xAt(i);
          const py = yAtDisp(dispSlice[i]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // Z-Score Curve (Bright Emerald)
      ctx.beginPath();
      for (let i = 0; i < zSlice.length; i++) {
        const px = xAt(i);
        const py = yAtZ(zSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 1.9;
      ctx.stroke();

      // Left Y-axis labels (Z-Score)
      ctx.fillStyle = "#34d399";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`+2.0σ`, padLeft - 6, yPlus2 + 3);
      ctx.fillText(`0.0σ`, padLeft - 6, yZero + 3);
      ctx.fillText(`-1.0σ`, padLeft - 6, yMinus1 + 3);

      // Right Y-axis labels (Displacement %)
      ctx.fillStyle = "#f59e0b";
      ctx.textAlign = "left";
      ctx.fillText(
        `${maxDisp.toFixed(2)}%`,
        padLeft + plotW + 5,
        padTop + 8
      );
      ctx.fillText(
        `${(maxDisp / 2).toFixed(2)}%`,
        padLeft + plotW + 5,
        padTop + plotH / 2 + 3
      );
      ctx.fillText(`0.00%`, padLeft + plotW + 5, padTop + plotH);

      // Top Legend Readout
      const lastZ = zSlice[zSlice.length - 1] ?? 0;
      const lastD = dispSlice[dispSlice.length - 1] ?? 0;
      ctx.textAlign = "left";
      ctx.fillStyle = "#34d399";
      ctx.fillText(
        `● Phase Z-Score: ${lastZ >= 0 ? "+" : ""}${lastZ.toFixed(2)}σ`,
        padLeft + 4,
        padTop - 7
      );
      ctx.fillStyle = "#f59e0b";
      ctx.fillText(
        `● Phase Displacement: ${lastD.toFixed(3)}%`,
        padLeft + 185,
        padTop - 7
      );
    } else if (subPaneMode === "correlation") {
      const retSlice = quantData.rolling.returnCorrelation.subarray(
        startIdx,
        effectiveEnd
      );
      const lvlSlice = quantData.rolling.levelCorrelation.subarray(
        startIdx,
        effectiveEnd
      );

      const yAtCorr = (r: number) =>
        padTop + ((1.0 - Math.max(-1, Math.min(1, r))) / 2.0) * plotH;

      const yZero = yAtCorr(0);
      const yPlusHalf = yAtCorr(0.5);
      const yMinusHalf = yAtCorr(-0.5);

      ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, yPlusHalf);
      ctx.lineTo(padLeft + plotW, yPlusHalf);
      ctx.moveTo(padLeft, yMinusHalf);
      ctx.lineTo(padLeft + plotW, yMinusHalf);
      ctx.stroke();

      ctx.strokeStyle = "#334155";
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padLeft, yZero);
      ctx.lineTo(padLeft + plotW, yZero);
      ctx.stroke();

      // Level correlation (Sky Blue)
      ctx.beginPath();
      for (let i = 0; i < lvlSlice.length; i++) {
        const px = xAt(i);
        const py = yAtCorr(lvlSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Stationary Log-Return correlation (Amber/Gold)
      ctx.beginPath();
      for (let i = 0; i < retSlice.length; i++) {
        const px = xAt(i);
        const py = yAtCorr(retSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.0;
      ctx.stroke();

      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText("+1.0", padLeft - 6, padTop + 8);
      ctx.fillText("+0.5", padLeft - 6, yPlusHalf + 3);
      ctx.fillText("0.0", padLeft - 6, yZero + 3);
      ctx.fillText("-0.5", padLeft - 6, yMinusHalf + 3);
      ctx.fillText("-1.0", padLeft - 6, padTop + plotH);

      const lastRet = retSlice[retSlice.length - 1] ?? 0;
      const lastLvl = lvlSlice[lvlSlice.length - 1] ?? 0;
      ctx.textAlign = "left";
      ctx.fillStyle = "#f59e0b";
      ctx.fillText(
        `● Stationary Return r(ΔlnX, ΔlnY): ${lastRet.toFixed(3)}`,
        padLeft + 4,
        padTop - 7
      );
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(
        `● Phase Level r(X, Y): ${lastLvl.toFixed(3)}`,
        padLeft + 265,
        padTop - 7
      );
    } else if (subPaneMode === "basis") {
      const basisSlice = quantData.rolling.basisPips.subarray(
        startIdx,
        effectiveEnd
      );
      let maxB = 0.25;
      for (let i = 0; i < basisSlice.length; i++) {
        const ab = Math.abs(basisSlice[i]);
        if (ab > maxB) maxB = ab * 1.15;
      }

      const yAtB = (b: number) => {
        const clamped = Math.max(-maxB, Math.min(maxB, b));
        return padTop + ((maxB - clamped) / (2 * maxB)) * plotH;
      };
      const yZero = yAtB(0);

      ctx.strokeStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(padLeft, yZero);
      ctx.lineTo(padLeft + plotW, yZero);
      ctx.stroke();

      const barW = Math.max(1.5, Math.min(7, plotW / sliceLen - 1));
      for (let i = 0; i < basisSlice.length; i++) {
        const val = basisSlice[i];
        const px = xAt(i);
        const py = yAtB(val);
        ctx.fillStyle =
          val >= 0 ? "rgba(16, 185, 129, 0.75)" : "rgba(239, 68, 68, 0.75)";
        ctx.fillRect(
          px - barW / 2,
          Math.min(yZero, py),
          barW,
          Math.max(1.5, Math.abs(py - yZero))
        );
      }

      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`+${maxB.toFixed(2)}p`, padLeft - 6, padTop + 8);
      ctx.fillText(`0.00p`, padLeft - 6, yZero + 3);
      ctx.fillText(`-${maxB.toFixed(2)}p`, padLeft - 6, padTop + plotH);

      const lastB = basisSlice[basisSlice.length - 1] ?? 0;
      ctx.textAlign = "left";
      ctx.fillStyle = "#a78bfa";
      ctx.fillText(
        `● Cross-Rate Basis (Market ${triad.yTicker} − Implied ${triad.yTicker}): ${
          lastB >= 0 ? "+" : ""
        }${lastB.toFixed(2)} pips`,
        padLeft + 4,
        padTop - 7
      );
    } else if (subPaneMode === "geometry") {
      const levySlice = quantData.geo.levyArea.subarray(startIdx, effectiveEnd);
      const coilSlice = quantData.geo.coilScore.subarray(
        startIdx,
        effectiveEnd
      );
      const velSlice = quantData.geo.velocity.subarray(startIdx, effectiveEnd);
      const angleSlice = quantData.geo.turningAngleDeg.subarray(
        startIdx,
        effectiveEnd
      );
      const hairpinSlice = quantData.geo.hairpinRatioPct.subarray(
        startIdx,
        effectiveEnd
      );

      let maxLevy = 1.5;
      for (let i = 0; i < levySlice.length; i++) {
        const al = Math.abs(levySlice[i]);
        if (al > maxLevy) maxLevy = al * 1.15;
      }

      const yAtLevy = (l: number) => {
        const clamped = Math.max(-maxLevy, Math.min(maxLevy, l));
        return padTop + ((maxLevy - clamped) / (2 * maxLevy)) * plotH;
      };

      const yAtScore = (s: number) => {
        const clamped = Math.max(0, Math.min(100, s));
        return padTop + (1 - clamped / 100) * plotH;
      };

      const yZero = yAtLevy(0);

      // Zero line for Lévy Area
      ctx.strokeStyle = "#334155";
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padLeft, yZero);
      ctx.lineTo(padLeft + plotW, yZero);
      ctx.stroke();

      // Bi-directional Signed Lévy Area Histogram (CCW Gold Leads vs CW FX Leads)
      const barW = Math.max(1.5, Math.min(6, plotW / sliceLen - 1));
      for (let i = 0; i < levySlice.length; i++) {
        const val = levySlice[i];
        const px = xAt(i);
        const py = yAtLevy(val);
        ctx.fillStyle =
          val >= 0
            ? "rgba(52, 211, 153, 0.45)"
            : "rgba(56, 189, 248, 0.45)";
        ctx.fillRect(
          px - barW / 2,
          Math.min(yZero, py),
          barW,
          Math.max(1.2, Math.abs(py - yZero))
        );
      }

      // Compression Coil Score Curve (0..100, Cyan)
      ctx.beginPath();
      for (let i = 0; i < coilSlice.length; i++) {
        const px = xAt(i);
        const py = yAtScore(coilSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // >90° Top-Down Hairpin Reversal Dots on Coil Curve (Rose)
      ctx.fillStyle = "#fb7185";
      for (let i = 0; i < angleSlice.length; i++) {
        if (angleSlice[i] >= 90.0 && velSlice[i] >= 0.12) {
          const px = xAt(i);
          const py = yAtScore(coilSlice[i]);
          ctx.beginPath();
          ctx.arc(px, py, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Left Y-axis labels (Signed Lévy Area)
      ctx.fillStyle = "#34d399";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`+${maxLevy.toFixed(1)}`, padLeft - 6, padTop + 8);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`0.0`, padLeft - 6, yZero + 3);
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`-${maxLevy.toFixed(1)}`, padLeft - 6, padTop + plotH);

      // Right Y-axis labels (Coil Score 0..100)
      ctx.fillStyle = "#22d3ee";
      ctx.textAlign = "left";
      ctx.fillText(`100`, padLeft + plotW + 5, padTop + 8);
      ctx.fillText(`50`, padLeft + plotW + 5, padTop + plotH / 2 + 3);
      ctx.fillText(`0`, padLeft + plotW + 5, padTop + plotH);

      const lastLevy = levySlice[levySlice.length - 1] ?? 0;
      const lastCoil = coilSlice[coilSlice.length - 1] ?? 0;
      const lastVel = velSlice[velSlice.length - 1] ?? 0;
      const lastAngle = angleSlice[angleSlice.length - 1] ?? 0;
      const lastHairpin = hairpinSlice[hairpinSlice.length - 1] ?? 0;

      ctx.textAlign = "left";
      ctx.fillStyle = lastLevy >= 0 ? "#34d399" : "#38bdf8";
      ctx.fillText(
        `● Lz: ${lastLevy >= 0 ? "+" : ""}${lastLevy.toFixed(2)} (${
          lastLevy >= 0 ? `CCW ${triad.xTicker}` : `CW ${triad.yTicker}`
        })`,
        padLeft + 4,
        padTop - 7
      );
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(
        `● Coil: ${lastCoil.toFixed(0)}/100 | v: ${lastVel.toFixed(2)}σ/b`,
        padLeft + 185,
        padTop - 7
      );
      ctx.fillStyle = lastAngle >= 90 ? "#fb7185" : "#a7f3d0";
      ctx.fillText(
        `● Turn Δθ: ${lastAngle.toFixed(1)}° (${
          lastAngle >= 90 ? ">90° Hairpin" : "<90° Forward"
        } | ${lastHairpin.toFixed(0)}% Chop)`,
        padLeft + 365,
        padTop - 7
      );
    } else if (subPaneMode === "clusters") {
      const regSlice = quantData.clusters.regime.subarray(
        startIdx,
        effectiveEnd
      );
      const basinDistSlice = quantData.clusters.nearestBasinDist.subarray(
        startIdx,
        effectiveEnd
      );
      const coilSlice = quantData.geo.coilScore.subarray(
        startIdx,
        effectiveEnd
      );

      const ribbonH = 12;
      const innerTop = padTop + ribbonH + 4;
      const innerH = Math.max(20, plotH - ribbonH - 4);

      // Top Discrete 4-State Regime Ribbon
      const cellW = Math.max(1.5, plotW / Math.max(1, regSlice.length));
      for (let i = 0; i < regSlice.length; i++) {
        const rId = (regSlice[i] & 3) as PhaseRegimeId;
        ctx.fillStyle = PHASE_REGIME_META[rId].color;
        ctx.fillRect(padLeft + (i / Math.max(1, regSlice.length)) * plotW, padTop + 1, cellW + 0.8, ribbonH);
      }

      let maxDist = 2.8;
      for (let i = 0; i < basinDistSlice.length; i++) {
        if (basinDistSlice[i] > maxDist) maxDist = basinDistSlice[i] * 1.15;
      }

      const yAtDist = (d: number) => {
        const clamped = Math.max(0, Math.min(maxDist, d));
        return innerTop + (1 - clamped / maxDist) * innerH;
      };

      const yAtCoil = (c: number) => {
        const clamped = Math.max(0, Math.min(100, c));
        return innerTop + (1 - clamped / 100) * innerH;
      };

      // +2.0σ Liquidity Vacuum threshold
      const yVac = yAtDist(2.0);
      ctx.strokeStyle = "rgba(244, 63, 94, 0.45)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, yVac);
      ctx.lineTo(padLeft + plotW, yVac);
      ctx.stroke();
      ctx.setLineDash([]);

      // Shaded Coil Score area (Sky/Cyan)
      if (coilSlice.length > 1) {
        ctx.beginPath();
        ctx.moveTo(xAt(0), innerTop + innerH);
        for (let i = 0; i < coilSlice.length; i++) {
          ctx.lineTo(xAt(i), yAtCoil(coilSlice[i]));
        }
        ctx.lineTo(xAt(coilSlice.length - 1), innerTop + innerH);
        ctx.closePath();
        ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
        ctx.fill();
      }

      // Nearest Attractor Basin Distance Curve (Pink/Magenta)
      ctx.beginPath();
      for (let i = 0; i < basinDistSlice.length; i++) {
        const px = xAt(i);
        const py = yAtDist(basinDistSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 1.9;
      ctx.stroke();

      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#f472b6";
      ctx.textAlign = "right";
      ctx.fillText(`${maxDist.toFixed(1)}σ`, padLeft - 6, innerTop + 8);
      ctx.fillText(`2.0σ`, padLeft - 6, yVac + 3);
      ctx.fillText(`0.0σ`, padLeft - 6, innerTop + innerH);

      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "left";
      ctx.fillText(`100%`, padLeft + plotW + 5, innerTop + 8);
      ctx.fillText(`0%`, padLeft + plotW + 5, innerTop + innerH);

      const lastRegimeId = ((regSlice[regSlice.length - 1] ?? 0) &
        3) as PhaseRegimeId;
      const lastMeta = PHASE_REGIME_META[lastRegimeId];
      const lastDist = basinDistSlice[basinDistSlice.length - 1] ?? 0;

      ctx.textAlign = "left";
      ctx.fillStyle = lastMeta.color;
      ctx.fillText(
        `● Active Cluster [${lastRegimeId}]: ${lastMeta.label.toUpperCase()}`,
        padLeft + 4,
        padTop - 7
      );
      ctx.fillStyle = "#f472b6";
      ctx.fillText(
        `● Attractor Dist: ${lastDist.toFixed(2)}σ ${
          lastDist > 2.0 ? "(LIQUIDITY VACUUM)" : "(IN BASIN)"
        }`,
        padLeft + 255,
        padTop - 7
      );
    } else if (subPaneMode === "entropy") {
      const ent = quantData.entropy;
      const permSlice = ent.permutationEntropy.subarray(startIdx, effectiveEnd);
      const turnSlice = ent.turningEntropy.subarray(startIdx, effectiveEnd);
      const markovSlice = ent.markovRegimeEntropy.subarray(
        startIdx,
        effectiveEnd
      );
      const compSlice = ent.compositeEntropyPct.subarray(
        startIdx,
        effectiveEnd
      );
      const qualCoilSlice = ent.entropyQualityCoilScore.subarray(
        startIdx,
        effectiveEnd
      );

      const ribbonH = 10;
      const innerTop = padTop + ribbonH + 4;
      const innerH = Math.max(20, plotH - ribbonH - 4);

      // Top Disorder Regime Ribbon (<45% Emerald Ordered, 45..75% Amber Transitional, >=75% Rose High-Entropy Chop)
      const cellW = Math.max(1.5, plotW / Math.max(1, compSlice.length));
      for (let i = 0; i < compSlice.length; i++) {
        const cPct = compSlice[i];
        ctx.fillStyle =
          cPct < 45
            ? "rgba(16, 185, 129, 0.85)"
            : cPct >= 75
            ? "rgba(244, 63, 94, 0.85)"
            : "rgba(245, 158, 11, 0.75)";
        ctx.fillRect(
          padLeft + (i / Math.max(1, compSlice.length)) * plotW,
          padTop + 1,
          cellW + 0.8,
          ribbonH
        );
      }

      const yAtPct = (pct: number) => {
        const clamped = Math.max(0, Math.min(100, pct));
        return innerTop + (1 - clamped / 100) * innerH;
      };

      // 75% High-Entropy Chop / No-Trade Zone & 45% Coherent Order Zone
      const yChop = yAtPct(75);
      const yOrder = yAtPct(45);
      ctx.fillStyle = "rgba(244, 63, 94, 0.07)";
      ctx.fillRect(padLeft, innerTop, plotW, Math.max(1, yChop - innerTop));
      ctx.fillStyle = "rgba(16, 185, 129, 0.06)";
      ctx.fillRect(
        padLeft,
        yOrder,
        plotW,
        Math.max(1, innerTop + innerH - yOrder)
      );

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(244, 63, 94, 0.5)";
      ctx.beginPath();
      ctx.moveTo(padLeft, yChop);
      ctx.lineTo(padLeft + plotW, yChop);
      ctx.stroke();

      ctx.strokeStyle = "rgba(16, 185, 129, 0.45)";
      ctx.beginPath();
      ctx.moveTo(padLeft, yOrder);
      ctx.lineTo(padLeft + plotW, yOrder);
      ctx.stroke();
      ctx.setLineDash([]);

      // Shaded Entropy-Quality True Coil Score (Cyan background fill)
      if (qualCoilSlice.length > 1) {
        ctx.beginPath();
        ctx.moveTo(xAt(0), innerTop + innerH);
        for (let i = 0; i < qualCoilSlice.length; i++) {
          ctx.lineTo(xAt(i), yAtPct(qualCoilSlice[i]));
        }
        ctx.lineTo(xAt(qualCoilSlice.length - 1), innerTop + innerH);
        ctx.closePath();
        ctx.fillStyle = "rgba(34, 211, 238, 0.14)";
        ctx.fill();
      }

      // 1. Markov Regime Transition Entropy H_Markov (Emerald dotted)
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      for (let i = 0; i < markovSlice.length; i++) {
        const px = xAt(i);
        const py = yAtPct(markovSlice[i] * 100);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "rgba(52, 211, 153, 0.7)";
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // 2. Bandt-Pompe Ordinal Permutation Entropy H_perm d=3 (Purple dashed)
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < permSlice.length; i++) {
        const px = xAt(i);
        const py = yAtPct(permSlice[i] * 100);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Turning-Angle Circular & Sector Entropy H_Δφ (Sky Blue solid)
      ctx.beginPath();
      for (let i = 0; i < turnSlice.length; i++) {
        const px = xAt(i);
        const py = yAtPct(turnSlice[i] * 100);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 4. Composite Phase Disorder Score (Bold Amber/Rose)
      ctx.beginPath();
      for (let i = 0; i < compSlice.length; i++) {
        const px = xAt(i);
        const py = yAtPct(compSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.1;
      ctx.stroke();

      // Highlight Entropy-Verified True Coils (Cyan dots) & Max-Chop Warning spikes (Rose dots)
      for (let i = 0; i < compSlice.length; i++) {
        if (qualCoilSlice[i] >= 42 && compSlice[i] < 55) {
          const px = xAt(i);
          const py = yAtPct(compSlice[i]);
          ctx.fillStyle = "#22d3ee";
          ctx.beginPath();
          ctx.arc(px, py, 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (compSlice[i] >= 80) {
          const px = xAt(i);
          const py = yAtPct(compSlice[i]);
          ctx.fillStyle = "#fb7185";
          ctx.beginPath();
          ctx.arc(px, py, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Interactive hover markers on the 4 entropy curves
      const inspectIdx =
        hoverIdx !== null && hoverIdx >= 0 && hoverIdx < compSlice.length
          ? hoverIdx
          : Math.max(0, compSlice.length - 1);

      if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < compSlice.length) {
        const hx = xAt(hoverIdx);
        const pts: { y: number; color: string }[] = [
          { y: yAtPct(compSlice[hoverIdx]), color: "#f59e0b" },
          { y: yAtPct(turnSlice[hoverIdx] * 100), color: "#38bdf8" },
          { y: yAtPct(permSlice[hoverIdx] * 100), color: "#a78bfa" },
          { y: yAtPct(markovSlice[hoverIdx] * 100), color: "#34d399" },
        ];
        for (const pt of pts) {
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(hx, pt.y, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#0b101b";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Y-Axis Labels
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#f59e0b";
      ctx.textAlign = "right";
      ctx.fillText(`100%`, padLeft - 6, innerTop + 8);
      ctx.fillStyle = "#fb7185";
      ctx.fillText(`75%`, padLeft - 6, yChop + 3);
      ctx.fillStyle = "#34d399";
      ctx.fillText(`45%`, padLeft - 6, yOrder + 3);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`0%`, padLeft - 6, innerTop + innerH);

      ctx.fillStyle = "#22d3ee";
      ctx.textAlign = "left";
      ctx.fillText(`1.00`, padLeft + plotW + 5, innerTop + 8);
      ctx.fillText(`0.50`, padLeft + plotW + 5, innerTop + innerH * 0.5 + 3);
      ctx.fillText(`0.00`, padLeft + plotW + 5, innerTop + innerH);

      const lastComp = compSlice[inspectIdx] ?? 0;
      const lastTurn = turnSlice[inspectIdx] ?? 0;
      const lastPerm = permSlice[inspectIdx] ?? 0;
      const lastMarkov = markovSlice[inspectIdx] ?? 0;
      const lastQualCoil = qualCoilSlice[inspectIdx] ?? 0;

      const stateLabel =
        lastComp < 45
          ? "ORDERED FLOW"
          : lastComp >= 75
          ? "MAX ENTROPY CHOP (NO-TRADE)"
          : "TRANSITIONAL";

      ctx.textAlign = "left";
      ctx.fillStyle =
        lastComp < 45 ? "#10b981" : lastComp >= 75 ? "#fb7185" : "#f59e0b";
      ctx.fillText(
        `● Disorder: ${lastComp.toFixed(0)}% (${stateLabel})`,
        padLeft + 4,
        padTop - 7
      );

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(
        `● Turn H_Δφ: ${lastTurn.toFixed(2)}`,
        padLeft + 245,
        padTop - 7
      );

      ctx.fillStyle = "#a78bfa";
      ctx.fillText(
        `● Perm H_3: ${lastPerm.toFixed(2)}`,
        padLeft + 375,
        padTop - 7
      );

      ctx.fillStyle = "#34d399";
      ctx.fillText(
        `● Markov H: ${lastMarkov.toFixed(2)} | True Coil: ${lastQualCoil.toFixed(
          0
        )}/100`,
        padLeft + 500,
        padTop - 7
      );
    } else if (subPaneMode === "signals") {
      const strat = quantData.strategy;
      const posSlice = strat.position.subarray(startIdx, effectiveEnd);
      const spineSlice = strat.spineXauusd.subarray(startIdx, effectiveEnd);
      const eqSlice = strat.equityCurvePct.subarray(startIdx, effectiveEnd);
      const slSlice = strat.stopLossSeries.subarray(startIdx, effectiveEnd);
      const tpSlice = strat.takeProfitSeries.subarray(startIdx, effectiveEnd);
      const filtSlice = strat.fakeoutFiltered.subarray(startIdx, effectiveEnd);

      const ribbonH = 10;
      const innerTop = padTop + ribbonH + 4;
      const innerH = Math.max(20, plotH - ribbonH - 4);

      // Top Position State Ribbon (Emerald = LONG, Rose = SHORT, Slate = FLAT, Sky-Blue ticks = Blocked Fakeout)
      const cellW = Math.max(1.5, plotW / Math.max(1, posSlice.length));
      for (let i = 0; i < posSlice.length; i++) {
        const pos = posSlice[i];
        ctx.fillStyle =
          pos === 1
            ? "rgba(16, 185, 129, 0.85)"
            : pos === -1
            ? "rgba(244, 63, 94, 0.85)"
            : "#1e293b";
        ctx.fillRect(
          padLeft + (i / Math.max(1, posSlice.length)) * plotW,
          padTop + 1,
          cellW + 0.8,
          ribbonH
        );
        if (filtSlice[i] === 1) {
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(
            padLeft + (i / Math.max(1, posSlice.length)) * plotW,
            padTop + ribbonH - 3,
            Math.max(2, cellW),
            3
          );
        }
      }

      // Compute price bounds for XAUUSD + Spine + Active SL/TP
      let minP = Infinity;
      let maxP = -Infinity;
      for (let i = 0; i < sliceLen; i++) {
        const g = dataSeries[startIdx + i]?.xauusd ?? 0;
        const sp = spineSlice[i] || g;
        if (g < minP) minP = g;
        if (g > maxP) maxP = g;
        if (sp < minP) minP = sp;
        if (sp > maxP) maxP = sp;
      }
      const pSpan = Math.max(1.0, maxP - minP);
      minP -= pSpan * 0.12;
      maxP += pSpan * 0.12;

      const yAtPrice = (p: number) => {
        const clamped = Math.max(minP, Math.min(maxP, p));
        return innerTop + ((maxP - clamped) / (maxP - minP || 1)) * innerH;
      };

      // Compute equity curve bounds (%)
      let minEq = -0.15;
      let maxEq = 0.25;
      for (let i = 0; i < eqSlice.length; i++) {
        if (eqSlice[i] < minEq) minEq = eqSlice[i] * 1.15;
        if (eqSlice[i] > maxEq) maxEq = eqSlice[i] * 1.15;
      }
      const eqSpan = Math.max(0.2, maxEq - minEq);

      const yAtEq = (eq: number) => {
        const clamped = Math.max(minEq, Math.min(maxEq, eq));
        return innerTop + ((maxEq - clamped) / eqSpan) * innerH;
      };

      // Shaded Cumulative Strategy Equity Curve (Cyan/Emerald background fill)
      if (eqSlice.length > 1) {
        const yEqZero = yAtEq(0);
        ctx.beginPath();
        ctx.moveTo(xAt(0), yEqZero);
        for (let i = 0; i < eqSlice.length; i++) {
          ctx.lineTo(xAt(i), yAtEq(eqSlice[i]));
        }
        ctx.lineTo(xAt(eqSlice.length - 1), yEqZero);
        ctx.closePath();
        ctx.fillStyle = "rgba(34, 211, 238, 0.10)";
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < eqSlice.length; i++) {
          const px = xAt(i);
          const py = yAtEq(eqSlice[i]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(34, 211, 238, 0.55)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // 3D MA Spine Implied XAUUSD Equilibrium Curve (Dashed Emerald)
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < spineSlice.length; i++) {
        const px = xAt(i);
        const py = yAtPrice(spineSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "rgba(52, 211, 153, 0.65)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Primary XAUUSD Spot Price Curve
      ctx.beginPath();
      for (let i = 0; i < sliceLen; i++) {
        const g = dataSeries[startIdx + i]?.xauusd ?? 0;
        const px = xAt(i);
        const py = yAtPrice(g);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Active Stop-Loss & Take-Profit horizontal guide ticks on latest bar if in position
      const lastPos = posSlice[posSlice.length - 1] ?? 0;
      const lastSl = slSlice[slSlice.length - 1];
      const lastTp = tpSlice[tpSlice.length - 1];
      if (lastPos !== 0 && Number.isFinite(lastSl) && Number.isFinite(lastTp)) {
        const ySl = yAtPrice(lastSl);
        const yTp = yAtPrice(lastTp);
        const xStartGuide = Math.max(padLeft, padLeft + plotW - 95);
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = "rgba(244, 63, 94, 0.8)";
        ctx.beginPath();
        ctx.moveTo(xStartGuide, ySl);
        ctx.lineTo(padLeft + plotW, ySl);
        ctx.stroke();

        ctx.strokeStyle = "rgba(16, 185, 129, 0.8)";
        ctx.beginPath();
        ctx.moveTo(xStartGuide, yTp);
        ctx.lineTo(padLeft + plotW, yTp);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw discrete BUY ▲, SELL ▼, and FILTERED ✕ markers
      for (const evt of strat.events) {
        if (evt.barIndex < startIdx || evt.barIndex >= effectiveEnd) continue;
        const localIdx = evt.barIndex - startIdx;
        const px = xAt(localIdx);
        const py = yAtPrice(evt.priceXauusd);

        if (evt.action === "BUY") {
          ctx.fillStyle = "#10b981";
          ctx.beginPath();
          ctx.moveTo(px, py - 2);
          ctx.lineTo(px - 5.5, py + 8);
          ctx.lineTo(px + 5.5, py + 8);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = "bold 9px ui-monospace, SFMono-Regular, Menlo, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "#34d399";
          ctx.fillText(`B•S${evt.setupId}`, px, Math.min(innerTop + innerH - 2, py + 17));
        } else if (evt.action === "SELL") {
          ctx.fillStyle = "#f43f5e";
          ctx.beginPath();
          ctx.moveTo(px, py + 2);
          ctx.lineTo(px - 5.5, py - 8);
          ctx.lineTo(px + 5.5, py - 8);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = "bold 9px ui-monospace, SFMono-Regular, Menlo, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "#fb7185";
          ctx.fillText(`S•S${evt.setupId}`, px, Math.max(innerTop + 9, py - 11));
        } else if (evt.action === "FILTERED") {
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Left Y-axis labels (XAUUSD $)
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "right";
      ctx.fillText(`$${maxP.toFixed(0)}`, padLeft - 5, innerTop + 8);
      ctx.fillText(
        `$${((maxP + minP) * 0.5).toFixed(0)}`,
        padLeft - 5,
        innerTop + innerH * 0.5 + 3
      );
      ctx.fillText(`$${minP.toFixed(0)}`, padLeft - 5, innerTop + innerH);

      // Right Y-axis labels (Cumulative Equity %)
      ctx.fillStyle = "#22d3ee";
      ctx.textAlign = "left";
      ctx.fillText(
        `${maxEq >= 0 ? "+" : ""}${maxEq.toFixed(2)}%`,
        padLeft + plotW + 5,
        innerTop + 8
      );
      ctx.fillText(`0.00%`, padLeft + plotW + 5, yAtEq(0) + 3);
      ctx.fillText(
        `${minEq.toFixed(2)}%`,
        padLeft + plotW + 5,
        innerTop + innerH
      );

      // Top Header Readout
      const sliceSummary = buildSummaryFromSlice(
        strat.events,
        strat.trades,
        strat.equityCurvePct,
        strat.drawdownPct,
        effectiveEnd
      );
      const lastSetupId = (strat.activeSetupId[effectiveEnd - 1] || 1) as StrategySetupId;
      const posBadge =
        lastPos === 1
          ? `▲ LONG (${STRATEGY_SETUP_META[lastSetupId].shortName})`
          : lastPos === -1
          ? `▼ SHORT (${STRATEGY_SETUP_META[lastSetupId].shortName})`
          : "● FLAT / SCANNING";

      ctx.textAlign = "left";
      ctx.fillStyle =
        lastPos === 1 ? "#10b981" : lastPos === -1 ? "#f43f5e" : "#94a3b8";
      ctx.fillText(`Signal: ${posBadge}`, padLeft + 4, padTop - 7);

      ctx.fillStyle = "#34d399";
      ctx.fillText(
        `Trades: ${sliceSummary.totalTrades} (${sliceSummary.buyCount}B/${sliceSummary.sellCount}S) | Win: ${sliceSummary.winRatePct.toFixed(
          0
        )}% | PF: ${sliceSummary.profitFactor.toFixed(2)}`,
        padLeft + 215,
        padTop - 7
      );

      ctx.fillStyle =
        sliceSummary.totalNetPnlUsd >= 0 ? "#22d3ee" : "#fb7185";
      ctx.fillText(
        `Net PnL: ${
          sliceSummary.totalNetPnlUsd >= 0 ? "+" : ""
        }$${sliceSummary.totalNetPnlUsd.toFixed(2)}/oz (${
          sliceSummary.totalReturnPct >= 0 ? "+" : ""
        }${sliceSummary.totalReturnPct.toFixed(2)}%) | Fakeouts Blocked: ${
          sliceSummary.blockedFakeouts
        }`,
        padLeft + 470,
        padTop - 7
      );
    }

    // Hover crosshair & bar inspection
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < sliceLen) {
      const hx = xAt(hoverIdx);
      ctx.strokeStyle = "rgba(236, 72, 153, 0.85)";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      const bar = dataSeries[startIdx + hoverIdx];
      if (bar) {
        ctx.fillStyle = "#f472b6";
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "right";
        ctx.fillText(
          `${bar.datetime} | ${triad.currencySymbol}${bar.xaueur.toFixed(
            triad.xDecimals
          )} | ${bar.eurusd.toFixed(triad.yDecimals)} (Click/Drag to Scrub)`,
          padLeft + plotW - 4,
          padTop - 7
        );
      }
    }

    // Bottom Time Axis Ticks (Start, Mid, End)
    const firstBar = dataSeries[startIdx];
    const midBar = dataSeries[startIdx + Math.floor(sliceLen / 2)];
    const lastBar = dataSeries[effectiveEnd - 1];
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    if (firstBar) {
      ctx.textAlign = "left";
      ctx.fillText(firstBar.datetime, padLeft, height - 6);
    }
    if (midBar && sliceLen > 10) {
      ctx.textAlign = "center";
      ctx.fillText(midBar.datetime, padLeft + plotW / 2, height - 6);
    }
    if (lastBar) {
      ctx.textAlign = "right";
      ctx.fillText(lastBar.datetime, padLeft + plotW, height - 6);
    }
  }, [
    subPaneMode,
    quantData,
    dataSeries,
    startIdx,
    effectiveEnd,
    hoverIdx,
    canvasDims,
    triad,
  ]);

  const handleClientX = (clientX: number, shouldScrub: boolean) => {
    if (!canvasRef.current || dataSeries.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const padLeft = 56;
    const padRight = 56;
    const plotW = Math.max(20, rect.width - padLeft - padRight);
    const relX = Math.max(0, Math.min(plotW, clientX - rect.left - padLeft));
    const sliceLen = Math.max(1, effectiveEnd - startIdx);
    const localIdx = Math.round((relX / plotW) * (sliceLen - 1));
    setHoverIdx(localIdx);

    if (shouldScrub) {
      const targetBarCount = startIdx + localIdx + 1;
      setReplayIndex(targetBarCount);
    }
  };

  const tabs: {
    id: SubPaneMode;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "signals",
      label: "Whitepaper Strategy BUY / SELL Signals & Equity",
      shortLabel: "Buy/Sell Signals",
      icon: <Target className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      id: "displacement",
      label: `3D Phase Z-Score & Displacement (${maType} ${maPeriod})`,
      shortLabel: `Z-Score (${maPeriod})`,
      icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      id: "geometry",
      label: "3D Geometry, Coil & Chirality (Lévy Lz)",
      shortLabel: "Geometry & Lz",
      icon: <Compass className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: "clusters",
      label: "Phase Regime Clusters & Attractor Distance",
      shortLabel: "Clusters (K=4)",
      icon: <Boxes className="w-3.5 h-3.5 text-pink-400" />,
    },
    {
      id: "entropy",
      label: "Phase-Space Entropy (Turning H_Δφ, Ordinal d=3 & Markov)",
      shortLabel: "Entropy",
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      id: "correlation",
      label: `Rolling Correlation r(ΔlnX, ΔlnY) vs r(X,Y)`,
      shortLabel: "Correlation",
      icon: <GitCompare className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      id: "basis",
      label: "Triad Arbitrage Basis (Pips)",
      shortLabel: "Basis Pips",
      icon: <BarChart3 className="w-3.5 h-3.5 text-purple-400" />,
    },
  ];

  return (
    <div
      style={{
        height: subPaneMode === "hidden" ? "34px" : `${paneHeight}px`,
      }}
      className="border-t border-[#1f293d] bg-[#0b101b] flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Top Drag-Resize Handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          startResizeAtY(e.clientY, false);
        }}
        onTouchStart={(e) => {
          if (e.touches[0]) startResizeAtY(e.touches[0].clientY, true);
        }}
        className="h-2 w-full bg-[#111827] hover:bg-cyan-500/40 cursor-ns-resize flex items-center justify-center shrink-0 transition touch-none"
        title="Drag up or down to resize 2D Sync Panel"
      >
        <GripHorizontal className="w-3.5 h-2.5 text-slate-600" />
      </div>

      {/* Sub-Pane Header */}
      <div className="h-7 px-2 sm:px-3 flex items-center justify-between border-b border-[#182235] bg-[#0d131f] text-xs shrink-0 gap-1">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            2D Sync:
          </span>
          {tabs.map((t) => {
            const active = subPaneMode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubPaneMode(t.id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-[#1e293b] text-white border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                {t.icon}
                <span className="hidden md:inline">{t.label}</span>
                <span className="md:hidden">{t.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Pane Height Controls */}
        <div className="flex items-center gap-1">
          {subPaneMode !== "hidden" && (
            <>
              <button
                onClick={() => setPaneHeight(180)}
                className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                  paneHeight <= 190
                    ? "bg-sky-500/20 text-sky-300"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Compact Height"
              >
                <Minimize2 className="w-3 h-3 inline mr-0.5" />
                S
              </button>
              <button
                onClick={() => setPaneHeight(280)}
                className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                  paneHeight > 190 && paneHeight < 350
                    ? "bg-sky-500/20 text-sky-300"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Medium Height"
              >
                M
              </button>
              <button
                onClick={() => setPaneHeight(400)}
                className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                  paneHeight >= 350
                    ? "bg-sky-500/20 text-sky-300"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Large 50/50 Split Height"
              >
                <Maximize2 className="w-3 h-3 inline mr-0.5" />
                L
              </button>
            </>
          )}

          <button
            onClick={() =>
              setSubPaneMode(
                subPaneMode === "hidden" ? "displacement" : "hidden"
              )
            }
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
            title="Collapse / Expand 2D Sub-Pane"
          >
            {subPaneMode === "hidden" ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Expand 2D</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2D Canvas Wrapper with strict overflow-hidden and absolute canvas */}
      {subPaneMode !== "hidden" && (
        <div
          ref={wrapperRef}
          className="relative flex-1 min-h-0 w-full overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            onMouseMove={(e) => handleClientX(e.clientX, e.buttons === 1)}
            onMouseDown={(e) => handleClientX(e.clientX, true)}
            onTouchStart={(e) => {
              if (e.touches[0]) handleClientX(e.touches[0].clientX, true);
            }}
            onTouchMove={(e) => {
              if (e.touches[0]) handleClientX(e.touches[0].clientX, true);
            }}
            onMouseLeave={() => setHoverIdx(null)}
            className="absolute inset-0 w-full h-full block cursor-crosshair touch-none"
          />
        </div>
      )}
    </div>
  );
}
