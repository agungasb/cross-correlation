"use client";

import React, { useState } from "react";
import { useTradeStore } from "@/store/useTradeStore";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import { ExecutionMode } from "@/types/trade";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ExternalLink,
  Flame,
  Radio,
  RefreshCw,
  Scale,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Wallet,
  X,
  Zap,
} from "lucide-react";

export default function MT5ExecutionModal() {
  const modalOpen = useTradeStore((s) => s.modalOpen);
  const setModalOpen = useTradeStore((s) => s.setModalOpen);

  const executionMode = useTradeStore((s) => s.executionMode);
  const setExecutionMode = useTradeStore((s) => s.setExecutionMode);

  const lotSize = useTradeStore((s) => s.lotSize);
  const setLotSize = useTradeStore((s) => s.setLotSize);

  const minConfidence = useTradeStore((s) => s.minConfidence);
  const setMinConfidence = useTradeStore((s) => s.setMinConfidence);

  const slippagePoints = useTradeStore((s) => s.slippagePoints);
  const setSlippagePoints = useTradeStore((s) => s.setSlippagePoints);

  const bridgeUrl = useTradeStore((s) => s.bridgeUrl);
  const setBridgeUrl = useTradeStore((s) => s.setBridgeUrl);

  const authToken = useTradeStore((s) => s.authToken);
  const setAuthToken = useTradeStore((s) => s.setAuthToken);

  const bridgeHealth = useTradeStore((s) => s.bridgeHealth);
  const account = useTradeStore((s) => s.account);
  const positions = useTradeStore((s) => s.positions);
  const isPolling = useTradeStore((s) => s.isPolling);
  const isDispatching = useTradeStore((s) => s.isDispatching);
  const error = useTradeStore((s) => s.error);

  const brokerQuote = useTradeStore((s) => s.brokerQuote);
  const slTpMode = useTradeStore((s) => s.slTpMode);
  const setSlTpMode = useTradeStore((s) => s.setSlTpMode);
  const maxBasisPoints = useTradeStore((s) => s.maxBasisPoints);
  const setMaxBasisPoints = useTradeStore((s) => s.setMaxBasisPoints);

  const dataSeries = useAnalyzerStore((s) => s.dataSeries);
  const currentBar = dataSeries.length > 0 ? dataSeries[dataSeries.length - 1] : null;
  const webappPrice = currentBar?.xauusd ?? null;
  const brokerMidPrice = brokerQuote ? (brokerQuote.bid + brokerQuote.ask) / 2 : null;
  const basisDrift = webappPrice && brokerMidPrice ? brokerMidPrice - webappPrice : null;
  const basisDriftAbs = basisDrift !== null ? Math.abs(basisDrift) : null;

  const pollBridgeStatus = useTradeStore((s) => s.pollBridgeStatus);
  const closePosition = useTradeStore((s) => s.closePosition);
  const triggerKillSwitch = useTradeStore((s) => s.triggerKillSwitch);

  const [confirmKill, setConfirmKill] = useState(false);
  const [activeTab, setActiveTab] = useState<"positions" | "basis" | "config">("positions");

  if (!modalOpen) return null;

  const isConnected = bridgeHealth?.status === "ok" || bridgeHealth?.connected;
  const isMock = bridgeHealth?.mode === "mock";

  const totalFloatingPnl = positions.reduce((acc, p) => acc + p.profit, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                MT5 Broker Execution & Risk Gateway
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    isConnected
                      ? isMock
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {isConnected ? (isMock ? "MOCK SIMULATOR" : "LIVE BROKER") : "OFFLINE"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct IPC pipeline connecting 3D Phase-Space signals to MetaTrader 5
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Ribbon */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 mr-2">Execution Mode:</span>
            {(["OFF", "MANUAL", "AUTONOMOUS"] as ExecutionMode[]).map((m) => {
              const active = executionMode === m;
              return (
                <button
                  key={m}
                  onClick={() => setExecutionMode(m)}
                  className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                    active
                      ? m === "AUTONOMOUS"
                        ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                        : m === "MANUAL"
                        ? "bg-sky-600 text-white shadow-lg shadow-sky-900/40"
                        : "bg-slate-700 text-slate-200"
                      : "bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {m === "AUTONOMOUS" && "⚡ Auto-Trade"}
                  {m === "MANUAL" && "🔔 1-Click Confirm"}
                  {m === "OFF" && "⏸️ Off (Monitor)"}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => pollBridgeStatus()}
            disabled={isPolling}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
            title="Refresh Account & Positions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? "animate-spin text-sky-400" : ""}`} />
            <span>Sync Broker</span>
          </button>
        </div>

        {/* Account Metrics Bar */}
        <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 border-b border-slate-800/60 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Balance</span>
            <span className="text-sm font-bold text-white">
              {account ? `$${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Equity</span>
            <span className="text-sm font-bold text-emerald-400">
              {account ? `$${account.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Floating PnL</span>
            <span
              className={`text-sm font-bold ${
                totalFloatingPnl >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {positions.length > 0
                ? `${totalFloatingPnl >= 0 ? "+" : ""}$${totalFloatingPnl.toFixed(2)}`
                : "$0.00"}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Free Margin</span>
            <span className="text-sm font-bold text-slate-200">
              {account ? `$${account.margin_free.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-5 pt-2 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("positions")}
            className={`pb-2.5 transition border-b-2 cursor-pointer ${
              activeTab === "positions"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Active Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab("basis")}
            className={`pb-2.5 transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "basis"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Feed Reconciliation & Basis Guard</span>
            {basisDrift !== null && basisDriftAbs !== null && (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                  basisDriftAbs <= 3.0
                    ? "bg-emerald-500/20 text-emerald-300"
                    : basisDriftAbs <= 10.0
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {basisDrift >= 0 ? "+" : ""}${basisDrift.toFixed(2)}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`pb-2.5 transition border-b-2 cursor-pointer ${
              activeTab === "config"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Risk & Gateway Settings
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {activeTab === "positions" && (
            <div>
              {positions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                  <p>No open positions on MT5 account.</p>
                  <p className="text-[11px] text-slate-600">
                    Strategy entries will populate here in real-time.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="p-2.5">Ticket</th>
                        <th className="p-2.5">Symbol</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Lots</th>
                        <th className="p-2.5">Open Price</th>
                        <th className="p-2.5">Current</th>
                        <th className="p-2.5">SL / TP</th>
                        <th className="p-2.5">Profit</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {positions.map((p) => {
                        const isBuy = p.direction === "BUY";
                        return (
                          <tr key={p.ticket} className="hover:bg-slate-800/30">
                            <td className="p-2.5 text-slate-400">{p.ticket}</td>
                            <td className="p-2.5 font-bold text-white">{p.symbol}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                }`}
                              >
                                {p.direction}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-300">{p.volume.toFixed(2)}</td>
                            <td className="p-2.5 text-slate-300">${p.price_open.toFixed(2)}</td>
                            <td className="p-2.5 text-slate-300">${p.price_current.toFixed(2)}</td>
                            <td className="p-2.5 text-slate-400">
                              {p.sl > 0 ? `$${p.sl.toFixed(2)}` : "—"} /{" "}
                              {p.tp > 0 ? `$${p.tp.toFixed(2)}` : "—"}
                            </td>
                            <td
                              className={`p-2.5 font-bold ${
                                p.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {p.profit >= 0 ? "+" : ""}${p.profit.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-right font-sans">
                              <button
                                onClick={() => closePosition(p.ticket)}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 text-slate-300 border border-slate-700 transition cursor-pointer"
                              >
                                Close
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "basis" && (
            <div className="space-y-4">
              {/* Basis Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    WebApp Signal Feed (XAUUSD)
                  </span>
                  <span className="text-base font-bold text-white font-mono block mt-1">
                    {webappPrice ? `$${webappPrice.toFixed(2)}` : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Source: Binance / Yahoo Spot Gold
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    MT5 Broker Quote (Bid / Ask)
                  </span>
                  <span className="text-base font-bold text-white font-mono block mt-1">
                    {brokerQuote
                      ? `$${brokerQuote.bid.toFixed(2)} / $${brokerQuote.ask.toFixed(2)}`
                      : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {brokerQuote ? `Spread: ${brokerQuote.spread_points} pts` : "Awaiting sync"}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Instantaneous Basis Drift
                  </span>
                  <span
                    className={`text-base font-bold font-mono block mt-1 ${
                      basisDriftAbs === null
                        ? "text-slate-500"
                        : basisDriftAbs <= 3.0
                        ? "text-emerald-400"
                        : basisDriftAbs <= 10.0
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {basisDrift !== null
                      ? `${basisDrift >= 0 ? "+" : ""}$${basisDrift.toFixed(2)} / oz`
                      : "—"}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {basisDriftAbs === null
                      ? "Connecting..."
                      : basisDriftAbs <= 3.0
                      ? "Normal OTC spread alignment"
                      : basisDriftAbs <= 10.0
                      ? "Moderate drift (Relative pts safe)"
                      : "Severe drift (Circuit breaker active)"}
                  </span>
                </div>
              </div>

              {/* SL / TP Mode Selection */}
              <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>SL / TP Anchoring Strategy (Basis Risk Elimination)</span>
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Spot Gold is an OTC instrument where liquidity providers quote different spreads.
                  Select how the strategy targets are translated into MT5 broker orders:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div
                    onClick={() => setSlTpMode("RELATIVE_POINTS")}
                    className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                      slTpMode === "RELATIVE_POINTS"
                        ? "bg-emerald-950/30 border-emerald-500/70 text-white shadow-sm shadow-emerald-950/50"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <span>Relative Point Distance</span>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                            Recommended
                          </span>
                        </span>
                        {slTpMode === "RELATIVE_POINTS" && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-300 mt-1.5 leading-normal">
                        Calculates structural stop distance in points (&Delta;) and anchors SL/TP
                        to the broker&apos;s <strong>actual instantaneous fill price</strong>. Guarantees
                        exact risk/reward ratio and dollar risk regardless of basis offset.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setSlTpMode("ABSOLUTE_PRICE")}
                    className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                      slTpMode === "ABSOLUTE_PRICE"
                        ? "bg-amber-950/30 border-amber-500/70 text-white shadow-sm shadow-amber-950/50"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                          <span>Absolute Price Levels</span>
                        </span>
                        {slTpMode === "ABSOLUTE_PRICE" && (
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-300 mt-1.5 leading-normal">
                        Sends the raw dollar targets directly to MT5. If the broker quotes with a basis gap,
                        your effective risk will stretch or shrink, and could trigger premature stop-outs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Basis Circuit Breaker Slider */}
              <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Basis Drift Circuit Breaker Limit</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    ${(maxBasisPoints / 100).toFixed(2)} / oz ({maxBasisPoints} pts)
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Rejects trade dispatch if the broker quote deviates from the webapp price by more than
                  this threshold. Protects against stale web feeds, illiquid rollover gaps, or incorrect ticker mapping.
                </p>
                <input
                  type="range"
                  min={200}
                  max={3000}
                  step={100}
                  value={maxBasisPoints}
                  onChange={(e) => setMaxBasisPoints(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 accent-amber-400 cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === "config" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block text-[11px]">
                    Default Lot Size (Volume)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="5.0"
                    value={lotSize}
                    onChange={(e) => setLotSize(parseFloat(e.target.value) || 0.01)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:border-sky-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">e.g. 0.01 = 1 oz Gold / 1,000 units</span>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block text-[11px]">
                    Min Auto-Trade Confidence (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseInt(e.target.value) || 60)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:border-sky-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Filters low-conviction signals</span>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block text-[11px]">
                    Max Slippage (Points)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="200"
                    value={slippagePoints}
                    onChange={(e) => setSlippagePoints(parseInt(e.target.value) || 30)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:border-sky-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Rejects orders if price slips</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 block">Bridge Connection</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400 text-[10px]">MT5 Bridge URL</label>
                    <input
                      type="text"
                      value={bridgeUrl}
                      onChange={(e) => setBridgeUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-[11px] font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 text-[10px]">Authorization Bearer Token</label>
                    <input
                      type="password"
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-[11px] font-mono outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Kill-Switch */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? (isMock ? "bg-amber-400" : "bg-emerald-400") : "bg-rose-400"
              }`}
            />
            <span>
              {account ? `MT5 #${account.login} (${account.server})` : "Bridge Not Connected"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {confirmKill ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-rose-400 font-bold">Confirm Flatten?</span>
                <button
                  onClick={async () => {
                    await triggerKillSwitch();
                    setConfirmKill(false);
                  }}
                  className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-rose-900/50"
                >
                  YES, CLOSE ALL
                </button>
                <button
                  onClick={() => setConfirmKill(false)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmKill(true)}
                disabled={positions.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  positions.length > 0
                    ? "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>KILL-SWITCH (Close All)</span>
              </button>
            )}

            <button
              onClick={() => setModalOpen(false)}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
