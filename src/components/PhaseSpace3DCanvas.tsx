"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import {
  BUILTIN_INDICATOR_PLUGINS,
  IndicatorRenderContext,
  PlotlyTrace,
} from "@/lib/quant/plugins";
import { computeVectorMA, getTimeUnitConfig } from "@/lib/quant/math";
import { CameraPreset } from "@/types/market";

interface PlotlyHTMLElement extends HTMLDivElement {
  _fullLayout?: {
    _guiEditing?: boolean;
    scene?: {
      _scene?: {
        getCamera?: () => Record<string, unknown>;
      };
    };
  };
}

declare global {
  interface Window {
    Plotly?: {
      react: (
        el: HTMLElement,
        data: PlotlyTrace[],
        layout: Record<string, unknown>,
        config: Record<string, unknown>
      ) => Promise<void>;
      relayout: (
        el: HTMLElement,
        update: Record<string, unknown>
      ) => Promise<void>;
      Plots: {
        resize: (el: HTMLElement) => void;
      };
    };
  }
}

/**
 * Ensures Plotly has completed initial `Plotly.react` layout creation (`_fullLayout`)
 * before invoking `Plotly.relayout` or `Plotly.Plots.resize`.
 */
function isPlotInitialized(
  el: PlotlyHTMLElement | null
): el is PlotlyHTMLElement {
  return Boolean(el && typeof window !== "undefined" && window.Plotly && el._fullLayout);
}

function getCameraSetting(preset: CameraPreset) {
  if (preset === "top") {
    return { eye: { x: 0, y: 0, z: 2.3 }, up: { x: 0, y: 1, z: 0 } };
  }
  if (preset === "side") {
    return { eye: { x: -2.3, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 } };
  }
  if (preset === "front") {
    return { eye: { x: 0, y: -2.3, z: 0 }, up: { x: 0, y: 0, z: 1 } };
  }
  return { eye: { x: 1.6, y: -1.7, z: 1.3 }, up: { x: 0, y: 0, z: 1 } };
}

export default function PhaseSpace3DCanvas() {
  const containerRef = useRef<PlotlyHTMLElement | null>(null);
  const [plotlyReady, setPlotlyReady] = useState(false);
  const rotateAngleRef = useRef(0);
  const lastCameraPresetRef = useRef<CameraPreset>("orbit");
  const userCameraRef = useRef<Record<string, unknown> | null>(null);

  const timeframe = useAnalyzerStore((s) => s.timeframe);
  const dataSeries = useAnalyzerStore((s) => s.dataSeries);
  const isLoading = useAnalyzerStore((s) => s.isLoading);
  const trailLength = useAnalyzerStore((s) => s.trailLength);
  const stretch = useAnalyzerStore((s) => s.stretch);
  const cameraPreset = useAnalyzerStore((s) => s.cameraPreset);
  const autoRotate = useAnalyzerStore((s) => s.autoRotate);
  const indicators = useAnalyzerStore((s) => s.indicators);
  const isReplaying = useAnalyzerStore((s) => s.isReplaying);
  const replayIndex = useAnalyzerStore((s) => s.replayIndex);
  const replayTraceMode = useAnalyzerStore((s) => s.replayTraceMode);
  const subPaneMode = useAnalyzerStore((s) => s.subPaneMode);
  const sidebarOpen = useAnalyzerStore((s) => s.sidebarOpen);

  // Check for window.Plotly readiness
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Plotly) {
      setPlotlyReady(true);
      return;
    }
    const timer = setInterval(() => {
      if (window.Plotly) {
        setPlotlyReady(true);
        clearInterval(timer);
      }
    }, 80);
    return () => clearInterval(timer);
  }, []);

  // Update camera when preset explicitly changes
  useEffect(() => {
    if (lastCameraPresetRef.current !== cameraPreset) {
      lastCameraPresetRef.current = cameraPreset;
      const cam = getCameraSetting(cameraPreset);
      userCameraRef.current = cam;
      if (plotlyReady && isPlotInitialized(containerRef.current) && window.Plotly) {
        window.Plotly.relayout(containerRef.current, {
          "scene.camera": cam,
        });
      }
    }
  }, [cameraPreset, plotlyReady]);

  // Fast aspect ratio relayout when stretch sliders move
  useEffect(() => {
    if (!plotlyReady || !isPlotInitialized(containerRef.current) || !window.Plotly) {
      return;
    }
    window.Plotly.relayout(containerRef.current, {
      "scene.aspectmode": "manual",
      "scene.aspectratio.x": stretch.x,
      "scene.aspectratio.y": stretch.y,
      "scene.aspectratio.z": stretch.z,
    });
  }, [stretch.x, stretch.y, stretch.z, plotlyReady]);

  // Auto-rotation interval
  useEffect(() => {
    if (!autoRotate || !plotlyReady) return;
    const id = setInterval(() => {
      if (!isPlotInitialized(containerRef.current) || !window.Plotly) return;
      rotateAngleRef.current += 0.022;
      const r = 2.35;
      const eye = {
        x: r * Math.cos(rotateAngleRef.current),
        y: r * Math.sin(rotateAngleRef.current),
        z: 1.2,
      };
      userCameraRef.current = { eye, up: { x: 0, y: 0, z: 1 } };
      window.Plotly.relayout(containerRef.current, {
        "scene.camera.eye": eye,
      });
    }, 40);
    return () => clearInterval(id);
  }, [autoRotate, plotlyReady]);

  // Resize observer on layout changes
  useEffect(() => {
    if (!plotlyReady || !containerRef.current) return;
    const el = containerRef.current;
    const handleResize = () => {
      if (isPlotInitialized(el) && window.Plotly) {
        window.Plotly.Plots.resize(el);
      }
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(el);
    window.addEventListener("resize", handleResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [plotlyReady, subPaneMode, sidebarOpen]);

  // Main 3D WebGL Render Effect
  useEffect(() => {
    if (
      !plotlyReady ||
      !containerRef.current ||
      !window.Plotly ||
      dataSeries.length === 0
    ) {
      return;
    }

    const effectiveEnd = Math.max(
      1,
      Math.min(dataSeries.length, replayIndex || dataSeries.length)
    );

    const startIdx =
      replayTraceMode === "accumulate"
        ? Math.max(0, effectiveEnd - 1000)
        : Math.max(0, effectiveEnd - trailLength);

    const activeSlice = dataSeries.slice(startIdx, effectiveEnd);
    if (activeSlice.length === 0) return;

    const n = activeSlice.length;
    const latest = activeSlice[n - 1];
    const timeCfg = getTimeUnitConfig(timeframe);

    const xVals = activeSlice.map((d) => d.xaueur);
    const yVals = activeSlice.map((d) => d.eurusd);
    const zMinTime = activeSlice[0].timestamp;
    const zVals = activeSlice.map(
      (d) => (d.timestamp - zMinTime) / timeCfg.divisor
    );
    const zFloor = 0;

    const colorVals = activeSlice.map((_, i) => i / (n - 1 || 1));

    // Check primary MA for hover enrichment
    const maCfg = indicators["vector-ma"];
    const showMA = maCfg?.enabled ?? true;
    const maPeriod = Number(maCfg?.params?.period ?? 20);
    const maType = (
      maCfg?.params?.maType === "EMA" ? "EMA" : "SMA"
    ) as "SMA" | "EMA";

    let maXSlice: Float64Array | null = null;
    let maYSlice: Float64Array | null = null;
    if (showMA) {
      const { xMA, yMA } = computeVectorMA(dataSeries, maPeriod, maType);
      maXSlice = xMA.slice(startIdx, effectiveEnd);
      maYSlice = yMA.slice(startIdx, effectiveEnd);
    }

    const hoverTexts = activeSlice.map((d, i) => {
      let txt =
        `<b>Date/Time:</b> ${d.datetime}<br>` +
        `<b>XAUEUR (X):</b> €${d.xaueur.toFixed(2)}<br>` +
        `<b>EURUSD (Y):</b> $${d.eurusd.toFixed(4)}<br>` +
        `<b>XAUUSD:</b> $${d.xauusd.toFixed(2)}<br>` +
        `<b>USDEUR (Inv):</b> €${d.usdeur.toFixed(4)}`;
      if (showMA && maXSlice && maYSlice) {
        txt += `<br><b>${maType}(${maPeriod}) X:</b> €${maXSlice[i].toFixed(
          2
        )}<br><b>${maType}(${maPeriod}) Y:</b> $${maYSlice[i].toFixed(4)}`;
      }
      return txt;
    });

    const traces: PlotlyTrace[] = [];

    // 1. Primary 3D Trajectory Ribbon
    traces.push({
      type: "scatter3d",
      mode: "lines+markers",
      name: "Trajectory",
      x: xVals,
      y: yVals,
      z: zVals,
      text: hoverTexts,
      hoverinfo: "text",
      line: {
        color: colorVals,
        colorscale: "Plasma",
        width: 4,
      },
      marker: {
        size: timeframe === "1d" ? 4.5 : 3,
        color: colorVals,
        colorscale: "Plasma",
        opacity: 0.82,
      },
    });

    // 2. Pluggable Quantitative Indicators
    const renderCtxBase: Omit<IndicatorRenderContext, "params"> = {
      fullSeries: dataSeries,
      activeSlice,
      startIdx,
      effectiveEnd,
      xVals,
      yVals,
      zVals,
      zFloor,
      timeframe,
      isReplaying,
      allConfigs: indicators,
    };

    for (const plugin of BUILTIN_INDICATOR_PLUGINS) {
      const inst = indicators[plugin.id];
      if (inst && inst.enabled) {
        const pluginTraces = plugin.buildTraces3D({
          ...renderCtxBase,
          params: inst.params,
        });
        traces.push(...pluginTraces);
      }
    }

    // 3. Active Head Diamond Marker (NOW / REPLAY)
    traces.push({
      type: "scatter3d",
      mode: "markers+text",
      name: "Head",
      x: [latest.xaueur],
      y: [latest.eurusd],
      z: [zVals[n - 1]],
      text: [isReplaying ? "REPLAY" : "NOW"],
      textposition: "top center",
      textfont: {
        color: isReplaying ? "#ec4899" : "#38bdf8",
        size: 11,
        family: "sans-serif",
      },
      marker: {
        size: 10.5,
        color: isReplaying ? "#ec4899" : "#38bdf8",
        symbol: "diamond",
        line: { color: "#ffffff", width: 2 },
      },
      hoverinfo: "text",
      hovertext: [
        `<b>${isReplaying ? "REPLAY BAR" : "LATEST BAR"}</b><br>${
          latest.datetime
        }<br>XAUEUR: €${latest.xaueur.toFixed(
          2
        )}<br>EURUSD: $${latest.eurusd.toFixed(
          4
        )}<br>XAUUSD: $${latest.xauusd.toFixed(2)}`,
      ],
    });

    // Read current scene camera from DOM if user orbited manually
    const existingSceneCam =
      containerRef.current._fullLayout?.scene?._scene?.getCamera?.();

    const activeCamera =
      existingSceneCam ||
      userCameraRef.current ||
      getCameraSetting(cameraPreset);

    const layout: Record<string, unknown> = {
      paper_bgcolor: "#0a0e17",
      plot_bgcolor: "#0a0e17",
      showlegend: false,
      margin: { l: 0, r: 0, b: 0, t: 0 },
      uirevision: timeframe,
      scene: {
        xaxis: {
          title: {
            text: "XAUEUR (€/oz)",
            font: { color: "#f59e0b", size: 12 },
          },
          backgroundcolor: "#0e1422",
          gridcolor: "#1f293d",
          showbackground: true,
          tickfont: { color: "#9ca3af", size: 10 },
        },
        yaxis: {
          title: {
            text: "EURUSD ($/€)",
            font: { color: "#38bdf8", size: 12 },
          },
          backgroundcolor: "#0e1422",
          gridcolor: "#1f293d",
          showbackground: true,
          tickfont: { color: "#9ca3af", size: 10 },
        },
        zaxis: {
          title: {
            text: timeCfg.label,
            font: { color: "#a78bfa", size: 12 },
          },
          backgroundcolor: "#0a0e17",
          gridcolor: "#1f293d",
          showbackground: true,
          tickfont: { color: "#9ca3af", size: 10 },
        },
        aspectmode: "manual",
        aspectratio: { x: stretch.x, y: stretch.y, z: stretch.z },
        camera: activeCamera,
      },
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["resetCameraDefault3d", "tableRotation"],
    };

    window.Plotly.react(containerRef.current, traces, layout, config);
  }, [
    plotlyReady,
    dataSeries,
    timeframe,
    trailLength,
    indicators,
    isReplaying,
    replayIndex,
    replayTraceMode,
    stretch.x,
    stretch.y,
    stretch.z,
    cameraPreset,
  ]);

  return (
    <div className="relative flex-1 w-full h-full bg-[#0a0e17] overflow-hidden select-none">
      {(!plotlyReady || isLoading) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0e17]/75 backdrop-blur-xs pointer-events-none">
          <div className="flex items-center gap-3 px-5 py-3 rounded-lg bg-[#111827] border border-[#1f293d] shadow-2xl text-cyan-400 text-sm font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Synchronizing 3D Phase Space Bars...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
