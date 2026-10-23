"use client";

import React, { useEffect, useRef } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";

const SPEEDS = [1, 2, 5, 10, 25, 60];

export default function ReplayTransportBar() {
  const dataSeries = useAnalyzerStore((s) => s.dataSeries);
  const isReplaying = useAnalyzerStore((s) => s.isReplaying);
  const setIsReplaying = useAnalyzerStore((s) => s.setIsReplaying);
  const toggleReplay = useAnalyzerStore((s) => s.toggleReplay);
  const replayIndex = useAnalyzerStore((s) => s.replayIndex);
  const setReplayIndex = useAnalyzerStore((s) => s.setReplayIndex);
  const stepReplay = useAnalyzerStore((s) => s.stepReplay);
  const restartReplay = useAnalyzerStore((s) => s.restartReplay);
  const jumpToLive = useAnalyzerStore((s) => s.jumpToLive);
  const replaySpeed = useAnalyzerStore((s) => s.replaySpeed);
  const setReplaySpeed = useAnalyzerStore((s) => s.setReplaySpeed);
  const replayTraceMode = useAnalyzerStore((s) => s.replayTraceMode);
  const setReplayTraceMode = useAnalyzerStore((s) => s.setReplayTraceMode);
  const isReplayLoop = useAnalyzerStore((s) => s.isReplayLoop);
  const toggleReplayLoop = useAnalyzerStore((s) => s.toggleReplayLoop);

  const floatIdxRef = useRef<number>(replayIndex || 1);
  const lastFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    floatIdxRef.current = replayIndex || 1;
  }, [replayIndex]);

  useEffect(() => {
    if (!isReplaying || dataSeries.length === 0) {
      lastFrameTimeRef.current = null;
      return;
    }

    let animId = 0;

    const step = (ts: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = ts;
      }
      const deltaSec = (ts - lastFrameTimeRef.current) / 1000.0;
      lastFrameTimeRef.current = ts;

      const state = useAnalyzerStore.getState();
      if (!state.isReplaying) return;

      const total = state.dataSeries.length;
      floatIdxRef.current += deltaSec * state.replaySpeed;
      const targetIdx = Math.min(total, Math.floor(floatIdxRef.current));

      if (targetIdx !== state.replayIndex) {
        state.setReplayIndex(targetIdx);
      }

      if (targetIdx >= total) {
        if (state.isReplayLoop) {
          floatIdxRef.current = 1.0;
          state.setReplayIndex(1);
          animId = requestAnimationFrame(step);
        } else {
          state.setIsReplaying(false);
          return;
        }
      } else {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isReplaying, dataSeries.length, setIsReplaying]);

  const totalBars = dataSeries.length;
  const effectiveIdx = Math.max(1, Math.min(totalBars || 1, replayIndex || totalBars || 1));
  const currentBar = dataSeries[effectiveIdx - 1];

  return (
    <footer className="bg-[#111522] border-t border-[#232d42] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs select-none shrink-0">
      {/* Transport Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleReplay}
          className={`px-3 py-1 rounded font-bold text-white shadow-sm transition cursor-pointer ${
            isReplaying
              ? "bg-rose-500 hover:bg-rose-600"
              : "bg-gradient-to-r from-pink-500 to-violet-600 hover:opacity-95"
          }`}
        >
          {isReplaying
            ? "⏸ Pause Replay"
            : effectiveIdx >= totalBars && totalBars > 0
            ? "▶ Start Replay"
            : "▶ Resume Replay"}
        </button>

        <button
          onClick={restartReplay}
          className="px-2 py-1 rounded bg-[#1a2234] hover:bg-[#253048] text-slate-200 border border-[#28354f] cursor-pointer"
          title="Restart Replay from Bar 1"
        >
          ⏮ Restart
        </button>

        <button
          onClick={() => stepReplay(-1)}
          className="px-2 py-1 rounded bg-[#1a2234] hover:bg-[#253048] text-slate-200 border border-[#28354f] cursor-pointer"
          title="Step Back 1 Bar (Left Arrow)"
        >
          ◀ Step
        </button>

        <button
          onClick={() => stepReplay(1)}
          className="px-2 py-1 rounded bg-[#1a2234] hover:bg-[#253048] text-slate-200 border border-[#28354f] cursor-pointer"
          title="Step Forward 1 Bar (Right Arrow)"
        >
          Step ▶
        </button>

        <button
          onClick={jumpToLive}
          className="px-2 py-1 rounded bg-[#1a2234] hover:bg-[#253048] text-cyan-300 border border-[#28354f] cursor-pointer"
          title="Jump to Latest Live Bar"
        >
          Live ⏭
        </button>

        <button
          onClick={toggleReplayLoop}
          className={`px-2 py-1 rounded font-semibold border transition cursor-pointer ${
            isReplayLoop
              ? "bg-emerald-600 text-white border-emerald-400"
              : "bg-[#1a2234] text-slate-400 border-[#28354f] hover:text-white"
          }`}
        >
          {isReplayLoop ? "Loop: ON 🔁" : "Loop: OFF"}
        </button>
      </div>

      {/* Scrubber & Bar Info */}
      <div className="flex items-center gap-2.5 flex-1 min-w-[220px] max-w-md">
        <span className="font-mono font-semibold text-pink-400 whitespace-nowrap text-[11px]">
          {currentBar ? currentBar.datetime : "---- -- --:--"}
        </span>

        <input
          type="range"
          min={1}
          max={Math.max(1, totalBars)}
          value={effectiveIdx}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            floatIdxRef.current = v;
            setReplayIndex(v);
          }}
          className="flex-1 accent-pink-500 cursor-pointer"
        />

        <span className="font-mono text-slate-400 whitespace-nowrap text-[11px]">
          Bar {effectiveIdx}/{totalBars}
        </span>
      </div>

      {/* Speed & Trace Mode */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold uppercase text-pink-400 mr-0.5">
            Speed:
          </span>
          {SPEEDS.map((spd) => (
            <button
              key={spd}
              onClick={() => setReplaySpeed(spd)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                replaySpeed === spd
                  ? "bg-pink-600 text-white font-bold border border-pink-400"
                  : "bg-[#1a2234] text-slate-400 hover:text-white"
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        <div className="flex items-center bg-[#090d16] p-0.5 rounded border border-[#232d42]">
          <button
            onClick={() => setReplayTraceMode("accumulate")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              replayTraceMode === "accumulate"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Accumulate
          </button>
          <button
            onClick={() => setReplayTraceMode("window")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
              replayTraceMode === "window"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Sliding Window
          </button>
        </div>
      </div>
    </footer>
  );
}
