"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { computeRollingStatsSeries, computeVectorMA } from "@/lib/quant/math";
import { SubPaneMode } from "@/types/market";
import { Activity, BarChart3, ChevronDown, ChevronUp, GitCompare } from "lucide-react";

export default function SynchronizedSubPane2D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const dataSeries = useAnalyzerStore((s) => s.dataSeries);
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

  const quantData = useMemo(() => {
    if (dataSeries.length === 0) return null;
    const ma = computeVectorMA(dataSeries, maPeriod, maType);
    const rolling = computeRollingStatsSeries(dataSeries, Math.max(10, maPeriod));
    return { ma, rolling };
  }, [dataSeries, maPeriod, maType]);

  const effectiveEnd = Math.max(
    1,
    Math.min(dataSeries.length, replayIndex || dataSeries.length)
  );
  const startIdx =
    replayTraceMode === "accumulate"
      ? Math.max(0, effectiveEnd - 1000)
      : Math.max(0, effectiveEnd - trailLength);

  useEffect(() => {
    if (subPaneMode === "hidden" || !canvasRef.current || !quantData || dataSeries.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(200, Math.floor(rect.width));
    const height = Math.max(80, Math.floor(rect.height));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = "#080c14";
    ctx.fillRect(0, 0, width, height);

    const padLeft = 52;
    const padRight = 18;
    const padTop = 14;
    const padBottom = 20;
    const plotW = Math.max(10, width - padLeft - padRight);
    const plotH = Math.max(10, height - padTop - padBottom);

    const sliceLen = Math.max(1, effectiveEnd - startIdx);
    const xAt = (i: number) =>
      padLeft + (sliceLen <= 1 ? plotW : (i / (sliceLen - 1)) * plotW);

    // Subtle horizontal grid lines
    ctx.strokeStyle = "#162032";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const gy = padTop + (g / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, gy);
      ctx.lineTo(padLeft + plotW, gy);
      ctx.stroke();
    }

    if (subPaneMode === "displacement") {
      // Plot Z-Score (-3 to +3) and Displacement %
      const zSlice = quantData.ma.displacementZScore.subarray(
        startIdx,
        effectiveEnd
      );
      const dispSlice = quantData.ma.displacementPct.subarray(
        startIdx,
        effectiveEnd
      );

      let maxZ = 3.0;
      for (let i = 0; i < zSlice.length; i++) {
        const az = Math.abs(zSlice[i]);
        if (az > maxZ) maxZ = Math.min(5.0, az * 1.1);
      }

      const yAtZ = (z: number) =>
        padTop + ((maxZ - z) / (2 * maxZ)) * plotH;

      // Zero line & +2/-2 sigma bands
      const yZero = yAtZ(0);
      const yPlus2 = yAtZ(2);
      const yMinus2 = yAtZ(-2);

      ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, yPlus2);
      ctx.lineTo(padLeft + plotW, yPlus2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
      ctx.beginPath();
      ctx.moveTo(padLeft, yMinus2);
      ctx.lineTo(padLeft + plotW, yMinus2);
      ctx.stroke();

      ctx.strokeStyle = "#2b3954";
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padLeft, yZero);
      ctx.lineTo(padLeft + plotW, yZero);
      ctx.stroke();

      // Fill area under Z-Score
      ctx.beginPath();
      for (let i = 0; i < zSlice.length; i++) {
        const px = xAt(i);
        const py = yAtZ(zSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`+2.0σ`, padLeft - 6, yPlus2 + 3);
      ctx.fillText(`0.0σ`, padLeft - 6, yZero + 3);
      ctx.fillText(`-2.0σ`, padLeft - 6, yMinus2 + 3);

      // Latest badge
      const lastZ = zSlice[zSlice.length - 1] ?? 0;
      const lastD = dispSlice[dispSlice.length - 1] ?? 0;
      ctx.fillStyle = "#34d399";
      ctx.textAlign = "left";
      ctx.fillText(
        `Disp: ${lastD.toFixed(2)}% | Z: ${lastZ >= 0 ? "+" : ""}${lastZ.toFixed(2)}σ`,
        padLeft + 8,
        padTop + 11
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
      ctx.strokeStyle = "#2b3954";
      ctx.beginPath();
      ctx.moveTo(padLeft, yZero);
      ctx.lineTo(padLeft + plotW, yZero);
      ctx.stroke();

      // Level correlation (Cyan dashed)
      ctx.beginPath();
      for (let i = 0; i < lvlSlice.length; i++) {
        const px = xAt(i);
        const py = yAtCorr(lvlSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Stationary Log-Return correlation (Gold/Emerald solid)
      ctx.beginPath();
      for (let i = 0; i < retSlice.length; i++) {
        const px = xAt(i);
        const py = yAtCorr(retSlice[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.9;
      ctx.stroke();

      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText("+1.0", padLeft - 6, padTop + 6);
      ctx.fillText("0.0", padLeft - 6, yZero + 3);
      ctx.fillText("-1.0", padLeft - 6, padTop + plotH);

      const lastRet = retSlice[retSlice.length - 1] ?? 0;
      const lastLvl = lvlSlice[lvlSlice.length - 1] ?? 0;
      ctx.textAlign = "left";
      ctx.fillStyle = "#f59e0b";
      ctx.fillText(
        `r_return(ΔlnX, ΔlnY): ${lastRet.toFixed(3)}`,
        padLeft + 8,
        padTop + 11
      );
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(
        `r_level(X, Y): ${lastLvl.toFixed(3)}`,
        padLeft + 210,
        padTop + 11
      );
    } else if (subPaneMode === "basis") {
      const basisSlice = quantData.rolling.basisPips.subarray(
        startIdx,
        effectiveEnd
      );
      let maxB = 0.5;
      for (let i = 0; i < basisSlice.length; i++) {
        const ab = Math.abs(basisSlice[i]);
        if (ab > maxB) maxB = ab * 1.15;
      }

      const yAtB = (b: number) =>
        padTop + ((maxB - b) / (2 * maxB)) * plotH;
      const yZero = yAtB(0);

      ctx.strokeStyle = "#2b3954";
      ctx.beginPath();
      ctx.moveTo(padLeft, yZero);
      ctx.lineTo(padLeft + plotW, yZero);
      ctx.stroke();

      // Histogram bars
      const barW = Math.max(1, Math.min(6, plotW / sliceLen - 1));
      for (let i = 0; i < basisSlice.length; i++) {
        const val = basisSlice[i];
        const px = xAt(i);
        const py = yAtB(val);
        ctx.fillStyle =
          val >= 0 ? "rgba(16, 185, 129, 0.65)" : "rgba(239, 68, 68, 0.65)";
        ctx.fillRect(
          px - barW / 2,
          Math.min(yZero, py),
          barW,
          Math.max(1, Math.abs(py - yZero))
        );
      }

      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`+${maxB.toFixed(1)}p`, padLeft - 6, padTop + 6);
      ctx.fillText(`0.0p`, padLeft - 6, yZero + 3);
      ctx.fillText(`-${maxB.toFixed(1)}p`, padLeft - 6, padTop + plotH);

      const lastB = basisSlice[basisSlice.length - 1] ?? 0;
      ctx.textAlign = "left";
      ctx.fillStyle = "#a78bfa";
      ctx.fillText(
        `Cross-Rate Basis (Δ EURUSD): ${lastB >= 0 ? "+" : ""}${lastB.toFixed(2)} pips`,
        padLeft + 8,
        padTop + 11
      );
    }

    // Hover crosshair & timestamp
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < sliceLen) {
      const hx = xAt(hoverIdx);
      ctx.strokeStyle = "rgba(236, 72, 153, 0.7)";
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
          `${bar.datetime} | €${bar.xaueur.toFixed(2)} | $${bar.eurusd.toFixed(4)} (Click to Scrub)`,
          padLeft + plotW - 4,
          padTop + 11
        );
      }
    }

    // Time axis start/end labels
    const firstBar = dataSeries[startIdx];
    const lastBar = dataSeries[effectiveEnd - 1];
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    if (firstBar) {
      ctx.textAlign = "left";
      ctx.fillText(firstBar.datetime, padLeft, height - 5);
    }
    if (lastBar) {
      ctx.textAlign = "right";
      ctx.fillText(lastBar.datetime, padLeft + plotW, height - 5);
    }

    ctx.restore();
  }, [
    subPaneMode,
    quantData,
    dataSeries,
    startIdx,
    effectiveEnd,
    hoverIdx,
  ]);

  const handlePointer = (
    e: React.MouseEvent<HTMLCanvasElement>,
    shouldScrub: boolean
  ) => {
    if (!canvasRef.current || dataSeries.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const padLeft = 52;
    const padRight = 18;
    const plotW = Math.max(10, rect.width - padLeft - padRight);
    const relX = Math.max(0, Math.min(plotW, e.clientX - rect.left - padLeft));
    const sliceLen = Math.max(1, effectiveEnd - startIdx);
    const localIdx = Math.round((relX / plotW) * (sliceLen - 1));
    setHoverIdx(localIdx);

    if (shouldScrub) {
      const targetBarCount = startIdx + localIdx + 1;
      setReplayIndex(targetBarCount);
    }
  };

  const tabs: { id: SubPaneMode; label: string; icon: React.ReactNode }[] = [
    {
      id: "displacement",
      label: `3D Phase Z-Score & Displacement (${maType} ${maPeriod})`,
      icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      id: "correlation",
      label: `Rolling Correlation r(ΔlnX, ΔlnY) vs r(X,Y)`,
      icon: <GitCompare className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      id: "basis",
      label: "Triad Arbitrage Basis (Pips)",
      icon: <BarChart3 className="w-3.5 h-3.5 text-purple-400" />,
    },
  ];

  return (
    <div
      className={`border-t border-[#1f293d] bg-[#0b101b] flex flex-col transition-all duration-150 ${
        subPaneMode === "hidden" ? "h-8" : "h-40"
      }`}
    >
      {/* Sub-Pane Header */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-[#182235] bg-[#0d131f] text-xs select-none shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            2D Sync Pane:
          </span>
          {tabs.map((t) => {
            const active = subPaneMode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubPaneMode(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  active
                    ? "bg-[#1e293b] text-white border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() =>
            setSubPaneMode(subPaneMode === "hidden" ? "displacement" : "hidden")
          }
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
          title="Toggle 2D Sub-Pane"
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

      {/* 2D Canvas */}
      {subPaneMode !== "hidden" && (
        <div className="relative flex-1 w-full">
          <canvas
            ref={canvasRef}
            onMouseMove={(e) => handlePointer(e, e.buttons === 1)}
            onMouseDown={(e) => handlePointer(e, true)}
            onMouseLeave={() => setHoverIdx(null)}
            className="w-full h-full block cursor-crosshair"
          />
        </div>
      )}
    </div>
  );
}
