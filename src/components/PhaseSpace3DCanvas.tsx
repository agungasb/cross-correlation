"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import {
  BUILTIN_INDICATOR_PLUGINS,
  IndicatorRenderContext,
  PlotlyTrace,
} from "@/lib/quant/plugins";
import { computeVectorMA, getTimeUnitConfig } from "@/lib/quant/math";
import { CameraPreset, TRIAD_CONFIGS } from "@/types/market";

interface PlotlySceneCamera {
  up: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
  eye: { x: number; y: number; z: number };
}

interface PlotlyInternalScene {
  getCamera?: () => PlotlySceneCamera;
  camera?: {
    lookAt?: (
      eye: [number, number, number],
      center: [number, number, number],
      up: [number, number, number]
    ) => void;
  };
  glplot?: {
    redraw?: () => void;
  };
}

interface PlotlyHTMLElement extends HTMLDivElement {
  _fullLayout?: {
    _guiEditing?: boolean;
    scene?: {
      _scene?: PlotlyInternalScene;
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
        resize: (el: HTMLElement) => Promise<void> | void;
      };
    };
  }
}

function isPlotInitialized(
  el: PlotlyHTMLElement | null
): el is PlotlyHTMLElement {
  return Boolean(
    el && typeof window !== "undefined" && window.Plotly && el._fullLayout
  );
}

function getCameraSetting(preset: CameraPreset) {
  if (preset === "top") {
    return {
      eye: { x: 0, y: 0, z: 2.3 },
      center: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
    };
  }
  if (preset === "side") {
    return {
      eye: { x: -2.3, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 0, z: 1 },
    };
  }
  if (preset === "front") {
    return {
      eye: { x: 0, y: -2.3, z: 0 },
      center: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 0, z: 1 },
    };
  }
  return {
    eye: { x: 1.6, y: -1.7, z: 1.3 },
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  };
}

function computeCameraBasis(cam: PlotlySceneCamera) {
  const vx = cam.center.x - cam.eye.x;
  const vy = cam.center.y - cam.eye.y;
  const vz = cam.center.z - cam.eye.z;
  const dist = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
  const fx = vx / dist;
  const fy = vy / dist;
  const fz = vz / dist;

  // Right = normalize(forward x up)
  let rx = fy * cam.up.z - fz * cam.up.y;
  let ry = fz * cam.up.x - fx * cam.up.z;
  let rz = fx * cam.up.y - fy * cam.up.x;
  let rLen = Math.sqrt(rx * rx + ry * ry + rz * rz);
  if (rLen < 1e-5) {
    rx = 1;
    ry = 0;
    rz = 0;
    rLen = 1;
  }
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  // True screen-plane Up = normalize(right x forward)
  let ux = ry * fz - rz * fy;
  let uy = rz * fx - rx * fz;
  let uz = rx * fy - ry * fx;
  const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
  ux /= uLen;
  uy /= uLen;
  uz /= uLen;

  return {
    dist,
    right: { x: rx, y: ry, z: rz },
    trueUp: { x: ux, y: uy, z: uz },
  };
}

export default function PhaseSpace3DCanvas() {
  const containerRef = useRef<PlotlyHTMLElement | null>(null);
  const [plotlyReady, setPlotlyReady] = useState(false);
  const [touchDragMode, setTouchDragMode] = useState<"orbit" | "pan">("orbit");
  const touchDragModeRef = useRef<"orbit" | "pan">("orbit");
  const rotateAngleRef = useRef(0);
  const lastCameraPresetRef = useRef<CameraPreset>("orbit");
  const userCameraRef = useRef<Record<string, unknown> | null>(null);

  const toggleTouchDragMode = () => {
    const next = touchDragMode === "orbit" ? "pan" : "orbit";
    touchDragModeRef.current = next;
    setTouchDragMode(next);
  };

  const applyCameraState = (
    nextEye: { x: number; y: number; z: number },
    nextCenter: { x: number; y: number; z: number },
    nextUp: { x: number; y: number; z: number }
  ) => {
    const el = containerRef.current;
    const scene = el?._fullLayout?.scene?._scene;
    userCameraRef.current = {
      eye: nextEye,
      center: nextCenter,
      up: nextUp,
    };

    if (scene?.camera?.lookAt && scene.glplot?.redraw) {
      scene.camera.lookAt(
        [nextEye.x, nextEye.y, nextEye.z],
        [nextCenter.x, nextCenter.y, nextCenter.z],
        [nextUp.x, nextUp.y, nextUp.z]
      );
      scene.glplot.redraw();
    } else if (el && window.Plotly) {
      window.Plotly.relayout(el, {
        "scene.camera": userCameraRef.current,
      });
    }
  };

  const zoom3DByFactor = (factor: number) => {
    const el = containerRef.current;
    const scene = el?._fullLayout?.scene?._scene;
    if (!scene?.getCamera) return;
    const cam = scene.getCamera();
    const dx = cam.eye.x - cam.center.x;
    const dy = cam.eye.y - cam.center.y;
    const dz = cam.eye.z - cam.center.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const nextDist = Math.max(0.35, Math.min(8.0, dist * factor));
    const ratio = nextDist / dist;

    const nextEye = {
      x: cam.center.x + dx * ratio,
      y: cam.center.y + dy * ratio,
      z: cam.center.z + dz * ratio,
    };
    applyCameraState(nextEye, cam.center, cam.up);
  };

  const pan3DByPixels = (dxPx: number, dyPx: number) => {
    const el = containerRef.current;
    const scene = el?._fullLayout?.scene?._scene;
    if (!scene?.getCamera) return;
    const cam = scene.getCamera();
    const { dist, right, trueUp } = computeCameraBasis(cam);
    const viewportH = Math.max(240, el?.clientHeight || 400);
    const panScale = (dist / viewportH) * 1.15;

    const shiftRight = -dxPx * panScale;
    const shiftUp = dyPx * panScale;
    const ox = right.x * shiftRight + trueUp.x * shiftUp;
    const oy = right.y * shiftRight + trueUp.y * shiftUp;
    const oz = right.z * shiftRight + trueUp.z * shiftUp;

    applyCameraState(
      { x: cam.eye.x + ox, y: cam.eye.y + oy, z: cam.eye.z + oz },
      { x: cam.center.x + ox, y: cam.center.y + oy, z: cam.center.z + oz },
      cam.up
    );
  };

  const pinchAndPan3D = (
    scaleFactor: number,
    midDxPx: number,
    midDyPx: number,
    focalOffsetX: number,
    focalOffsetY: number
  ) => {
    const el = containerRef.current;
    const scene = el?._fullLayout?.scene?._scene;
    if (!scene?.getCamera) return;
    const cam = scene.getCamera();
    const { dist, right, trueUp } = computeCameraBasis(cam);
    const viewportH = Math.max(240, el?.clientHeight || 400);
    const panScale = (dist / viewportH) * 1.15;

    const nextDist = Math.max(0.35, Math.min(8.0, dist * scaleFactor));
    const ratio = nextDist / dist;

    // Shift camera center both by 2-finger pan (midDxPx/midDyPx) and toward the pinch focal point
    const shiftRight =
      (-midDxPx + (1 - ratio) * focalOffsetX * 0.85) * panScale;
    const shiftUp =
      (midDyPx - (1 - ratio) * focalOffsetY * 0.85) * panScale;

    const nextCenter = {
      x: cam.center.x + right.x * shiftRight + trueUp.x * shiftUp,
      y: cam.center.y + right.y * shiftRight + trueUp.y * shiftUp,
      z: cam.center.z + right.z * shiftRight + trueUp.z * shiftUp,
    };

    const ex = cam.eye.x - cam.center.x;
    const ey = cam.eye.y - cam.center.y;
    const ez = cam.eye.z - cam.center.z;

    const nextEye = {
      x: nextCenter.x + ex * ratio,
      y: nextCenter.y + ey * ratio,
      z: nextCenter.z + ez * ratio,
    };

    applyCameraState(nextEye, nextCenter, cam.up);
  };

  const resetCameraView = () => {
    const cam = getCameraSetting(cameraPreset);
    applyCameraState(cam.eye, cam.center, cam.up);
  };

  const triadPair = useAnalyzerStore((s) => s.triadPair);
  const timeframe = useAnalyzerStore((s) => s.timeframe);
  const dataSeries = useAnalyzerStore((s) => s.dataSeries);
  const isLoading = useAnalyzerStore((s) => s.isLoading);
  const trailLength = useAnalyzerStore((s) => s.trailLength);
  const stretch = useAnalyzerStore((s) => s.stretch);
  const cameraPreset = useAnalyzerStore((s) => s.cameraPreset);
  const setCameraPreset = useAnalyzerStore((s) => s.setCameraPreset);
  const autoRotate = useAnalyzerStore((s) => s.autoRotate);
  const toggleAutoRotate = useAnalyzerStore((s) => s.toggleAutoRotate);
  const indicators = useAnalyzerStore((s) => s.indicators);
  const isReplaying = useAnalyzerStore((s) => s.isReplaying);
  const replayIndex = useAnalyzerStore((s) => s.replayIndex);
  const replayTraceMode = useAnalyzerStore((s) => s.replayTraceMode);
  const subPaneMode = useAnalyzerStore((s) => s.subPaneMode);
  const sidebarOpen = useAnalyzerStore((s) => s.sidebarOpen);

  const triad = TRIAD_CONFIGS[triadPair] ?? TRIAD_CONFIGS.EUR;

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
      if (
        plotlyReady &&
        isPlotInitialized(containerRef.current) &&
        window.Plotly
      ) {
        window.Plotly.relayout(containerRef.current, {
          "scene.camera": cam,
        });
      }
    }
  }, [cameraPreset, plotlyReady]);

  // Fast aspect ratio relayout when stretch sliders move
  useEffect(() => {
    if (
      !plotlyReady ||
      !isPlotInitialized(containerRef.current) ||
      !window.Plotly
    ) {
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
      if (
        isPlotInitialized(el) &&
        window.Plotly &&
        el.isConnected &&
        el.offsetParent !== null &&
        el.clientWidth > 0 &&
        el.clientHeight > 0
      ) {
        try {
          Promise.resolve(window.Plotly.Plots.resize(el)).catch(() => {});
        } catch {
          // ignore resize on hidden or unmounted element
        }
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

  // Native 2-Finger Pinch-to-Zoom + 2-Finger Pan + 1-Finger Pan Mode Bridge for Mobile WebGL
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let lastPinchDist: number | null = null;
    let lastMidX: number | null = null;
    let lastMidY: number | null = null;
    let lastSingleX: number | null = null;
    let lastSingleY: number | null = null;

    const getTouchDist = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStartCapture = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.stopPropagation();
        e.preventDefault();
        lastPinchDist = getTouchDist(e.touches[0], e.touches[1]);
        lastMidX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
        lastMidY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
        lastSingleX = null;
        lastSingleY = null;
      } else if (e.touches.length === 1 && touchDragModeRef.current === "pan") {
        e.stopPropagation();
        e.preventDefault();
        lastSingleX = e.touches[0].clientX;
        lastSingleY = e.touches[0].clientY;
        lastPinchDist = null;
      } else {
        lastPinchDist = null;
        lastMidX = null;
        lastMidY = null;
        lastSingleX = null;
        lastSingleY = null;
      }
    };

    const onTouchMoveCapture = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.stopPropagation();
        e.preventDefault();
        const currDist = getTouchDist(e.touches[0], e.touches[1]);
        const currMidX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
        const currMidY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;

        const rect = el.getBoundingClientRect();
        const focalOffsetX = currMidX - (rect.left + rect.width * 0.5);
        const focalOffsetY = currMidY - (rect.top + rect.height * 0.5);

        const scaleFactor =
          lastPinchDist && lastPinchDist > 8 && currDist > 8
            ? lastPinchDist / currDist
            : 1;
        const midDx = lastMidX !== null ? currMidX - lastMidX : 0;
        const midDy = lastMidY !== null ? currMidY - lastMidY : 0;

        pinchAndPan3D(scaleFactor, midDx, midDy, focalOffsetX, focalOffsetY);

        lastPinchDist = currDist;
        lastMidX = currMidX;
        lastMidY = currMidY;
      } else if (
        e.touches.length === 1 &&
        touchDragModeRef.current === "pan" &&
        lastSingleX !== null &&
        lastSingleY !== null
      ) {
        e.stopPropagation();
        e.preventDefault();
        const dx = e.touches[0].clientX - lastSingleX;
        const dy = e.touches[0].clientY - lastSingleY;
        pan3DByPixels(dx, dy);
        lastSingleX = e.touches[0].clientX;
        lastSingleY = e.touches[0].clientY;
      }
    };

    const onTouchEndCapture = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastPinchDist = null;
        lastMidX = null;
        lastMidY = null;
      }
      if (e.touches.length === 0) {
        lastSingleX = null;
        lastSingleY = null;
      }
    };

    el.addEventListener("touchstart", onTouchStartCapture, {
      capture: true,
      passive: false,
    });
    el.addEventListener("touchmove", onTouchMoveCapture, {
      capture: true,
      passive: false,
    });
    el.addEventListener("touchend", onTouchEndCapture, {
      capture: true,
      passive: false,
    });

    return () => {
      el.removeEventListener("touchstart", onTouchStartCapture, {
        capture: true,
      });
      el.removeEventListener("touchmove", onTouchMoveCapture, {
        capture: true,
      });
      el.removeEventListener("touchend", onTouchEndCapture, {
        capture: true,
      });
    };
  }, [plotlyReady]);

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
        `<b>${triad.xTicker} (X):</b> ${triad.currencySymbol}${d.xaueur.toFixed(
          triad.xDecimals
        )}<br>` +
        `<b>${triad.yTicker} (Y):</b> ${d.eurusd.toFixed(triad.yDecimals)} (${
          triad.fxUnitLabel
        })<br>` +
        `<b>XAUUSD:</b> $${d.xauusd.toFixed(2)}<br>` +
        `<b>${triad.inverseTicker} (Inv):</b> ${d.usdeur.toFixed(5)}`;
      if (showMA && maXSlice && maYSlice) {
        txt += `<br><b>${maType}(${maPeriod}) X:</b> ${
          triad.currencySymbol
        }${maXSlice[i].toFixed(triad.xDecimals)}<br><b>${maType}(${maPeriod}) Y:</b> ${maYSlice[
          i
        ].toFixed(triad.yDecimals)}`;
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
      triadPair,
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
        }<br>${triad.xTicker}: ${triad.currencySymbol}${latest.xaueur.toFixed(
          triad.xDecimals
        )}<br>${triad.yTicker}: ${latest.eurusd.toFixed(
          triad.yDecimals
        )}<br>XAUUSD: $${latest.xauusd.toFixed(2)}`,
      ],
    });

    const existingSceneCam =
      containerRef.current._fullLayout?.scene?._scene?.getCamera?.() as
        | Record<string, unknown>
        | undefined;

    const activeCamera =
      existingSceneCam ||
      userCameraRef.current ||
      getCameraSetting(cameraPreset);

    const layout: Record<string, unknown> = {
      paper_bgcolor: "#0a0e17",
      plot_bgcolor: "#0a0e17",
      showlegend: false,
      margin: { l: 0, r: 0, b: 0, t: 0 },
      uirevision: `${triadPair}_${timeframe}`,
      scene: {
        xaxis: {
          title: {
            text: `${triad.xTicker} (${triad.currencySymbol}/oz)`,
            font: { color: "#f59e0b", size: 12 },
          },
          backgroundcolor: "#0e1422",
          gridcolor: "#1f293d",
          showbackground: true,
          tickfont: { color: "#9ca3af", size: 10 },
        },
        yaxis: {
          title: {
            text: `${triad.yTicker} (${triad.fxUnitLabel})`,
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

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    const config = {
      responsive: false,
      displayModeBar: !isMobile,
      displaylogo: false,
      modeBarButtonsToRemove: ["resetCameraDefault3d", "tableRotation"],
    };

    window.Plotly.react(containerRef.current, traces, layout, config);
  }, [
    plotlyReady,
    triadPair,
    triad,
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
    <div className="relative flex-1 min-h-0 w-full bg-[#0a0e17] overflow-hidden select-none">
      {/* Floating Quick Camera Pills (Touch-Friendly for Mobile & Desktop) */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-[#0d131f]/85 backdrop-blur-xs border border-[#1f293d] rounded-md p-0.5 shadow-lg">
        {(
          [
            { id: "orbit", label: "3D" },
            { id: "top", label: "Top" },
            { id: "side", label: "Side" },
            { id: "front", label: "Front" },
          ] as { id: CameraPreset; label: string }[]
        ).map((cam) => (
          <button
            key={cam.id}
            onClick={() => setCameraPreset(cam.id)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
              cameraPreset === cam.id
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {cam.label}
          </button>
        ))}
        <button
          onClick={toggleAutoRotate}
          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
            autoRotate
              ? "bg-pink-600 text-white"
              : "text-slate-400 hover:text-white"
          }`}
          title="Auto-Orbit 3D Camera"
        >
          ⟳
        </button>
        <span className="w-px h-3 bg-[#1f293d] mx-0.5" />
        <button
          onClick={toggleTouchDragMode}
          className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
            touchDragMode === "pan"
              ? "bg-amber-500 text-slate-950"
              : "bg-white/5 text-slate-300 hover:text-white"
          }`}
          title="Toggle 1-Finger Drag Mode (Orbit Rotate vs. Pan Move)"
        >
          {touchDragMode === "pan" ? "✥ Pan" : "↻ Orbit"}
        </button>
        <button
          onClick={() => zoom3DByFactor(0.82)}
          className="px-2 py-0.5 rounded text-[11px] font-bold text-cyan-300 hover:bg-white/10 cursor-pointer"
          title="Zoom In 3D"
        >
          ＋
        </button>
        <button
          onClick={() => zoom3DByFactor(1.22)}
          className="px-2 py-0.5 rounded text-[11px] font-bold text-cyan-300 hover:bg-white/10 cursor-pointer"
          title="Zoom Out 3D"
        >
          －
        </button>
        <button
          onClick={resetCameraView}
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          title="Reset Camera Center & Zoom"
        >
          RST
        </button>
      </div>

      {(!plotlyReady || isLoading) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0e17]/75 backdrop-blur-xs pointer-events-none">
          <div className="flex items-center gap-3 px-5 py-3 rounded-lg bg-[#111827] border border-[#1f293d] shadow-2xl text-cyan-400 text-sm font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span>
              Synchronizing {triad.xTicker} / {triad.yTicker} Phase Space...
            </span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
