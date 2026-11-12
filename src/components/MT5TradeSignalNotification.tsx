"use client";

import React, { useState } from "react";
import { useTradeStore } from "@/store/useTradeStore";
import { STRATEGY_SETUP_META } from "@/lib/quant/math";
import { ArrowUpRight, ArrowDownRight, Check, X, Zap, Loader2 } from "lucide-react";

export default function MT5TradeSignalNotification() {
  const executionMode = useTradeStore((s) => s.executionMode);
  const pendingSignal = useTradeStore((s) => s.pendingSignalAlert);
  const dismissAlert = useTradeStore((s) => s.dismissPendingAlert);
  const dispatchFromSignal = useTradeStore((s) => s.dispatchFromSignal);
  const lotSize = useTradeStore((s) => s.lotSize);
  const isDispatching = useTradeStore((s) => s.isDispatching);

  const [lastDispatchedKey, setLastDispatchedKey] = useState<string | null>(null);

  if (executionMode !== "MANUAL" || !pendingSignal) return null;

  const isBuy = pendingSignal.action === "BUY";
  const setupMeta = STRATEGY_SETUP_META[pendingSignal.setupId];
  const sigKey = `${pendingSignal.setupId}_${pendingSignal.timestamp}_${pendingSignal.action}`;

  const isDone = lastDispatchedKey === sigKey;

  const handleExecute = async () => {
    try {
      await dispatchFromSignal(pendingSignal);
      setLastDispatchedKey(sigKey);
      setTimeout(() => {
        dismissAlert();
        setLastDispatchedKey(null);
      }, 1500);
    } catch {
      // handled in store
    }
  };

  return (
    <div className="fixed bottom-14 right-4 z-40 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#0f172a]/95 border-2 border-sky-500/80 rounded-xl shadow-2xl p-3.5 backdrop-blur-md text-white flex flex-col gap-2.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`p-1 rounded text-xs font-black flex items-center justify-center ${
                isBuy ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"
              }`}
            >
              {isBuy ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </span>
            <div>
              <span className="text-xs font-black tracking-wide text-white block">
                {pendingSignal.action} XAUUSD ({lotSize} Lots)
              </span>
              <span className="text-[10px] text-sky-400 font-semibold">
                {setupMeta?.name || `Setup ${pendingSignal.setupId}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
              {Math.round(pendingSignal.confidence)}% Conf
            </span>
            <button
              onClick={dismissAlert}
              className="text-slate-400 hover:text-white p-0.5 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2 rounded-lg text-[10px] border border-slate-800">
          <div>
            <span className="text-slate-400 block">Signal Price</span>
            <span className="font-mono font-bold text-slate-200">
              ${pendingSignal.priceXauusd.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Stop Loss</span>
            <span className="font-mono font-bold text-rose-400">
              {!Number.isNaN(pendingSignal.stopLossXauusd)
                ? `$${pendingSignal.stopLossXauusd.toFixed(2)}`
                : "None"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Take Profit</span>
            <span className="font-mono font-bold text-emerald-400">
              {!Number.isNaN(pendingSignal.takeProfitXauusd)
                ? `$${pendingSignal.takeProfitXauusd.toFixed(2)}`
                : "None"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={handleExecute}
            disabled={isDispatching || isDone}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-black transition cursor-pointer shadow-md ${
              isDone
                ? "bg-emerald-600 text-white"
                : isBuy
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/40"
                : "bg-rose-500 hover:bg-rose-400 text-white shadow-rose-950/40"
            }`}
          >
            {isDispatching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sending to MT5...</span>
              </>
            ) : isDone ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Executed!</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Execute on MT5</span>
              </>
            )}
          </button>

          <button
            onClick={dismissAlert}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            Ignore
          </button>
        </div>
      </div>
    </div>
  );
}
