"use client";

import React, { useEffect, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import {
  Activity,
  BookOpen,
  Boxes,
  CheckCircle2,
  Compass,
  Cpu,
  ExternalLink,
  Flame,
  Layers,
  ShieldAlert,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";

type GuideSectionId =
  | "all"
  | "playbook"
  | "verification"
  | "clusters"
  | "geometry"
  | "indicators"
  | "manifold"
  | "roadmap";

export default function TechnicalGuideModal() {
  const isOpen = useAnalyzerStore((s) => s.guideModalOpen);
  const setIsOpen = useAnalyzerStore((s) => s.setGuideModalOpen);
  const [activeFilter, setActiveFilter] = useState<GuideSectionId>("all");

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const navItems: { id: GuideSectionId; label: string; icon: React.ReactNode }[] =
    [
      {
        id: "all",
        label: "Complete Whitepaper",
        icon: <BookOpen className="w-3.5 h-3.5 text-cyan-400" />,
      },
      {
        id: "playbook",
        label: "5-Setup Playbook",
        icon: <Target className="w-3.5 h-3.5 text-emerald-400" />,
      },
      {
        id: "verification",
        label: "Manual Check & 6G10",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />,
      },
      {
        id: "clusters",
        label: "Clusters & Basins (#6)",
        icon: <Boxes className="w-3.5 h-3.5 text-pink-400" />,
      },
      {
        id: "geometry",
        label: "3D Geometry & Lz (#2)",
        icon: <Compass className="w-3.5 h-3.5 text-cyan-300" />,
      },
      {
        id: "indicators",
        label: "Core Indicators",
        icon: <Layers className="w-3.5 h-3.5 text-amber-400" />,
      },
      {
        id: "manifold",
        label: "Manifold Math",
        icon: <Activity className="w-3.5 h-3.5 text-sky-400" />,
      },
      {
        id: "roadmap",
        label: "Future Roadmap",
        icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
      },
    ];

  const show = (sec: GuideSectionId) =>
    activeFilter === "all" || activeFilter === sec;

  return (
    <div
      onClick={() => setIsOpen(false)}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-text"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[90dvh] bg-[#0b101b] border border-cyan-500/35 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Popup Header */}
        <div className="bg-[#090d16] border-b border-[#1f293d] px-4 py-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-400 bg-clip-text text-transparent truncate">
                    TECHNICAL WHITEPAPER &amp; 5-SETUP PLAYBOOK
                  </h2>
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    v2.0 Field Guide
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Indicator Objectives, State Interpretation &amp; High-Conviction Playbook
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 transition cursor-pointer shrink-0"
              title="Close Guide (Esc)"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="mt-2.5 pt-2 border-t border-[#182235] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const active = activeFilter === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveFilter(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition whitespace-nowrap cursor-pointer ${
                    active
                      ? "bg-[#1e293b] text-white border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Popup Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-6">
          {/* Executive Abstract Banner */}
          <section className="rounded-xl bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#131c31] border border-[#263554] p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              <Zap className="w-3.5 h-3.5" />
              <span>Core Research Thesis</span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              Why 3D Phase-Space Manifold Analysis Outperforms 2D XAUUSD Charts
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              A standard 2D <code className="text-amber-300 font-mono">XAUUSD</code>{" "}
              chart collapses two independent stochastic processes—<strong>intrinsic global bullion demand</strong> and{" "}
              <strong>US Dollar FX valuation</strong>—onto a single axis. By projecting{" "}
              <code className="text-amber-300 font-mono">X = Cross-Gold</code>,{" "}
              <code className="text-sky-300 font-mono">Y = G10 FX Proxy</code>, and{" "}
              <code className="text-purple-300 font-mono">Z = Time</code> into a 3D manifold, this workstation separates passive USD currency translation from genuine intrinsic bullion accumulation.
            </p>
          </section>

          {/* SECTION: HIGH-CONVICTION COMBINED PLAYBOOK */}
          {show("playbook") && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#1f293d] pb-1.5">
                <Target className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  High-Conviction Combined Playbook (5 Operational Setups)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Setup 1 */}
                <div className="bg-[#111827] border border-emerald-500/35 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-white">
                        Setup 1: &ldquo;Coiled Bullion Breakout&rdquo;
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                      Trend Entry
                    </span>
                  </div>
                  <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-2.5 space-y-1 text-xs text-slate-300">
                    <div className="font-bold text-cyan-300">
                      1. Pre-Conditions (Compression Build-Up):
                    </div>
                    <div>
                      • Regime = <code className="text-sky-300 font-mono">C0: Coil</code> for ≥ 5 bars &amp; <code className="text-cyan-300 font-mono">Coil Score &gt; 45/100</code>.
                    </div>
                    <div>
                      • <code className="text-pink-300 font-mono">Basin Distance &lt; 1.2σ</code> inside an established 3D Attractor Basin.
                    </div>
                    <div className="font-bold text-emerald-300 pt-1">
                      2. Execution Trigger:
                    </div>
                    <div>
                      • Regime flips <code className="text-amber-300 font-mono">C0 → C2: Breakout</code> &amp; <code className="text-pink-300 font-mono">Basin Distance &gt; 1.8σ (Vacuum)</code>.
                    </div>
                    <div>
                      • <code className="text-emerald-300 font-mono">Lévy Area Lz &gt; 0 (CCW: Cross-Gold Leads)</code> &amp; trajectory cuts <strong>orthogonally across</strong> Iso-XAUUSD contours.
                    </div>
                  </div>
                </div>

                {/* Setup 2 */}
                <div className="bg-[#111827] border border-sky-500/35 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="text-xs font-bold text-white">
                        Setup 2: &ldquo;Fake Dollar-Induced Gold Spike&rdquo;
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/20 text-sky-300">
                      Filter / Fade
                    </span>
                  </div>
                  <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-2.5 space-y-1 text-xs text-slate-300">
                    <div className="font-bold text-sky-300">
                      Diagnostic Signature:
                    </div>
                    <div>
                      • <strong>Floor Shadow:</strong> Slides <strong>parallel</strong> to the <code className="text-amber-300 font-mono">Iso-XAUUSD</code> floor contour rather than cutting across it.
                    </div>
                    <div>
                      • <strong>Chirality:</strong> <code className="text-sky-300 font-mono">Lévy Area Lz &lt; -0.5 (CW: FX Leads)</code>—confirming the move originated in FX, not bullion.
                    </div>
                    <div>
                      • <strong>Containment:</strong> <code className="text-pink-300 font-mono">Basin Distance &lt; 1.5σ</code> (trapped in basin).
                    </div>
                    <div className="text-amber-300 font-semibold pt-1">
                      → Action: Do not chase XAUUSD; fade back to 3D MA spine once FX stalls.
                    </div>
                  </div>
                </div>

                {/* Setup 3 */}
                <div className="bg-[#111827] border border-rose-500/35 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="text-xs font-bold text-white">
                        Setup 3: &ldquo;Exhaustion Blow-Off &amp; Curvature Hook&rdquo;
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300">
                      Mean-Reversion
                    </span>
                  </div>
                  <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-2.5 space-y-1 text-xs text-slate-300">
                    <div className="font-bold text-rose-300">
                      Trigger Checklist:
                    </div>
                    <div>
                      • Regime = <code className="text-rose-400 font-mono">C3: Tail / Shock</code> &amp; <code className="text-emerald-300 font-mono">Phase Z-Score &gt; +2.2σ</code>.
                    </div>
                    <div>
                      • <code className="text-pink-300 font-mono">Basin Distance &gt; 2.3σ (LIQUIDITY VACUUM)</code>.
                    </div>
                    <div>
                      • <strong>Frenet-Serret Hook:</strong> <code className="text-amber-300 font-mono">Phase Velocity (v)</code> ticks down on the exact bar that <code className="text-purple-300 font-mono">3D Curvature (κ) &gt; 0.38</code> spikes.
                    </div>
                    <div className="text-emerald-300 font-semibold pt-1">
                      → Target: Snap-back to Primary 3D MA Spine (0.0σ).
                    </div>
                  </div>
                </div>

                {/* Setup 4 & 5 */}
                <div className="bg-[#111827] border border-purple-500/35 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="text-xs font-bold text-white">
                        Setup 4 &amp; 5: Vacuum Transit &amp; Orbital Lead-Lag
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300">
                      Structural Flow
                    </span>
                  </div>
                  <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-2.5 space-y-1.5 text-xs text-slate-300">
                    <div>
                      <span className="font-bold text-pink-300">
                        Setup 4 (Liquidity Vacuum Transit):
                      </span>{" "}
                      When price exits a high-dwell Basin (<code className="font-mono">&gt;2.0σ Vacuum</code>) in <code className="text-amber-300 font-mono">C2: Breakout</code> with <code className="font-mono">v_t &gt; 0.75σ/b</code> and low curvature (<code className="font-mono">κ &lt; 0.18</code>), ride momentum to the next 3D Basin center.
                    </div>
                    <div className="pt-1 border-t border-white/[0.06]">
                      <span className="font-bold text-cyan-300">
                        Setup 5 (Orbital Lead-Lag in C1: Orbit):
                      </span>{" "}
                      When <code className="text-sky-300 font-mono">Lz &lt; -1.0 (CW: FX Leads)</code>, watch the FX leg at the <code className="font-mono">±2σ</code> Bollinger rail for a 1–4 bar leading inflection before Gold turns.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION: MANUAL SIGNAL VERIFICATION & 6G10 TELEMETRY GUIDE */}
          {(show("verification") || activeFilter === "playbook") && (
            <section className="space-y-3.5">
              <div className="flex items-center gap-2 border-b border-[#1f293d] pb-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Manual Signal Verification Guide &amp; 6G10 Multi-Proxy Telemetry
                </h3>
              </div>

              {/* 1. What 6G10 Breadth Means */}
              <div className="bg-gradient-to-br from-[#0e1a24] to-[#111827] border border-teal-500/35 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-teal-300">
                    How to Read &ldquo;6G10 -77% BEAR / +45% BULL&rdquo; (Current State vs. Prediction)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                    Causal Telemetry
                  </span>
                </div>
                <p className="leading-relaxed">
                  <code className="text-teal-300 font-mono font-bold">6G10 -77% BEAR</code> is a{" "}
                  <strong className="text-white">real-time measurement of current multi-currency Gold momentum and positioning</strong> across all 6 G10 non-USD Gold crosses (<code className="font-mono text-amber-300">XAUEUR, XAUJPY, XAUGBP, XAUCHF, XAUAUD, XAUCAD</code>)—<strong>NOT</strong> a price-percentage forecast (it does not mean Gold will fall 77%).
                </p>
                <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-2.5 font-mono text-[11px] text-slate-200">
                  Breadth_t = 0.75 · (1/6) Σ tanh(1.35·Δx̃_k,t + 0.35·x̃_k,t) + 0.25 · tanh(0.45·(G_t − G_slow,t)/σ_G,t)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-0.5">
                  <div className="bg-[#090d16] border border-emerald-500/25 rounded p-2">
                    <div className="font-bold text-emerald-400">
                      &gt; +15% (BULL):
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Gold is rising intrinsically across most G10 currencies at once. Confirms <code className="text-emerald-300">▲ BUY</code> trend breakouts (S1, S4) and blocks <code className="text-rose-300">▼ SELL</code> breakouts.
                    </p>
                  </div>
                  <div className="bg-[#090d16] border border-rose-500/25 rounded p-2">
                    <div className="font-bold text-rose-400">
                      &lt; -15% (BEAR):
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Synchronized global bullion selling across G10 currencies. Confirms <code className="text-rose-300">▼ SELL</code> breakouts; at extreme readings (<code className="font-mono">-75%..-90%</code>), wait for a 3D Curvature Hook (S3) off the <code className="text-emerald-300">SUP Bounce Zone</code> before buying.
                    </p>
                  </div>
                  <div className="bg-[#090d16] border border-slate-600/30 rounded p-2">
                    <div className="font-bold text-slate-200">
                      -15% to +15% (NEUT):
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Cross-gold flows are mixed; 2D <code className="font-mono">XAUUSD</code> moves are mostly passive US Dollar FX noise rather than intrinsic bullion demand.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Where to Find Each Indicator Value in Tools -> Metrics */}
              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">
                    Where to Find Each Indicator Value in Tools → Metrics (or Matrix › on Mobile)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Tip: Tap any row in &ldquo;Recent Signals&rdquo; to scrub to that exact bar
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-[#090d16] border border-white/[0.05] rounded p-2">
                    <div className="font-bold text-emerald-300">
                      Whitepaper Strategy Signals Card
                    </div>
                    <div className="text-slate-300">
                      • <code className="font-mono text-white">Iso-XAUUSD Cut Efficiency</code> (% Orthogonal Cut vs. FX Slide)
                    </div>
                    <div className="text-slate-300">
                      • <code className="font-mono text-white">Conviction (%)</code>, <code className="font-mono text-white">Stop (SL)</code>, <code className="font-mono text-white">Target (TP)</code>, <code className="font-mono text-white">3D Spine</code>
                    </div>
                  </div>
                  <div className="bg-[#090d16] border border-white/[0.05] rounded p-2">
                    <div className="font-bold text-teal-300">
                      Cross-Proxy &amp; Bounce Matrix Card
                    </div>
                    <div className="text-slate-300">
                      • <code className="font-mono text-white">Bullion Breadth</code>, <code className="font-mono text-white">Chirality Consensus</code>, <code className="font-mono text-white">Rail Bounce Bias</code>
                    </div>
                    <div className="text-slate-300">
                      • <code className="font-mono text-white">Implied XAUUSD Bounce Zones</code> &amp; <code className="font-mono text-white">6-Triad Z(X)</code>
                    </div>
                  </div>
                  <div className="bg-[#090d16] border border-white/[0.05] rounded p-2">
                    <div className="font-bold text-cyan-300">
                      Geometry (#2), Cluster (#6) &amp; Entropy Cards
                    </div>
                    <div className="text-slate-300">
                      • <code className="font-mono text-white">Phase Velocity (v)</code>, <code className="font-mono text-white">3D Curvature (κ)</code>, <code className="font-mono text-white">Coil Score</code>, <code className="font-mono text-white">Turn (Δθ)</code>, <code className="font-mono text-white">Lévy Area (Lz)</code>
                    </div>
                    <div className="text-slate-300">
                      • <code className="font-mono text-white">Regime (C0..C3)</code>, <code className="font-mono text-white">Basin Distance (σ)</code>, <code className="font-mono text-white">Composite Disorder (%)</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Step-by-Step Manual Verification Checklists for All 5 Setups */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* S1 Manual Check */}
                <div className="bg-[#111827] border border-emerald-500/30 rounded-xl p-3 space-y-1.5">
                  <div className="font-bold text-emerald-300">
                    Manual Check — Setup 1: 3D Coil Release (S1)
                  </div>
                  <div className="text-slate-300 space-y-1 text-[11px]">
                    <div>
                      ☑ <strong>1. Prior Coil Build-Up:</strong> Over the prior 3–12 bars, <code className="font-mono text-cyan-300">Compression Coil Score ≥ 42/100</code> (or <code className="font-mono">C0: Coil</code>) with <code className="font-mono text-pink-300">Basin Distance &lt; 1.35σ</code>.
                    </div>
                    <div>
                      ☑ <strong>2. Entropy S/N Filter:</strong> <code className="font-mono text-amber-300">Composite Disorder &lt; 88%</code> (not in white-noise chop).
                    </div>
                    <div>
                      ☑ <strong>3. Breakout Expansion:</strong> Regime switches to <code className="font-mono text-amber-300">C2: Breakout</code> (or <code className="font-mono">C1</code> with <code className="font-mono">v ≥ 0.50 σ/b</code>) and <code className="font-mono text-pink-300">Basin Distance ≥ 1.48σ</code>.
                    </div>
                    <div>
                      ☑ <strong>4. Bullion-Led Cut:</strong> <code className="font-mono text-emerald-300">Iso-Cut Efficiency ≥ 52%</code> &amp; <code className="font-mono text-emerald-300">Lévy Area Lz ≥ -0.10</code>.
                    </div>
                    <div>
                      ☑ <strong>5. Direction:</strong> <code className="text-emerald-400 font-bold">▲ BUY</code> if <code className="font-mono">XAUUSD &gt; 3D Spine (+0.15σ)</code> &amp; rising; <code className="text-rose-400 font-bold">▼ SELL</code> if below spine &amp; falling.
                    </div>
                  </div>
                </div>

                {/* S2 Manual Check */}
                <div className="bg-[#111827] border border-sky-500/30 rounded-xl p-3 space-y-1.5">
                  <div className="font-bold text-sky-300">
                    Manual Check — Setup 2: Fakeout Filter &amp; Fade (S2)
                  </div>
                  <div className="text-slate-300 space-y-1 text-[11px]">
                    <div>
                      ☑ <strong>Part A — Blocked Fakeout (<code className="text-sky-300">✕ S2</code>):</strong> <code className="font-mono text-sky-300">Iso-Cut Efficiency &lt; 52% (FX Slide)</code> + <code className="font-mono text-sky-300">Lévy Area Lz &lt; -0.30 (CW FX Leads)</code> + <code className="font-mono text-pink-300">Basin Distance &lt; 1.65σ</code>.
                    </div>
                    <div>
                      ☑ <strong>Part B — Active Fade (<code className="text-emerald-300">▲ BUY</code> / <code className="text-rose-300">▼ SELL</code>):</strong> All Part A conditions hold + <code className="font-mono">XAUUSD</code> stretched <code className="font-mono">≥ 1.25σ</code> from 3D Spine.
                    </div>
                    <div>
                      ☑ <strong>Stall &amp; Bounce Confirmation:</strong> <code className="font-mono text-amber-300">Phase Velocity (v)</code> decelerates (<code className="font-mono">v_t &lt; v_t-1</code>) or <code className="font-mono">Turn Δθ ≥ 65°</code> with <code className="font-mono text-teal-300">Rail Bounce Bias ≥ +15%</code> toward the 3D Spine.
                    </div>
                  </div>
                </div>

                {/* S3 Manual Check */}
                <div className="bg-[#111827] border border-rose-500/30 rounded-xl p-3 space-y-1.5">
                  <div className="font-bold text-rose-300">
                    Manual Check — Setup 3: Exhaustion Curvature Hook (S3)
                  </div>
                  <div className="text-slate-300 space-y-1 text-[11px]">
                    <div>
                      ☑ <strong>1. Tail Stretch:</strong> Regime is/was <code className="font-mono text-rose-400">C3: Shock</code> or <code className="font-mono text-amber-300">Phase Z-Score ≥ 1.90σ</code>, with <code className="font-mono">XAUUSD ≥ 1.85σ</code> from the 3D Spine.
                    </div>
                    <div>
                      ☑ <strong>2. Liquidity Vacuum:</strong> <code className="font-mono text-pink-300">Basin Distance ≥ 1.71σ (Vacuum)</code>.
                    </div>
                    <div>
                      ☑ <strong>3. Frenet-Serret Hook:</strong> <code className="font-mono text-purple-300">3D Curvature κ ≥ 0.34</code> while <code className="font-mono text-amber-300">Velocity (v)</code> decelerates or <code className="font-mono">Turn Δθ ≥ 75°</code> (or hairpin <code className="font-mono">Δθ ≥ 135°</code> with <code className="font-mono">κ ≥ 0.25</code>).
                    </div>
                    <div>
                      ☑ <strong>4. Cross-Proxy Hook:</strong> Primary Cross-Gold Z-score (<code className="font-mono text-teal-300">x̃_k</code>) hooks <code className="font-mono">≥ 0.22σ</code> back toward <code className="font-mono">0.00σ</code> off its <code className="font-mono">±2σ</code> Bounce Zone.
                    </div>
                  </div>
                </div>

                {/* S4 & S5 Manual Check */}
                <div className="bg-[#111827] border border-purple-500/30 rounded-xl p-3 space-y-1.5">
                  <div className="font-bold text-purple-300">
                    Manual Check — Setup 4 (Vacuum) &amp; Setup 5 (Orbit)
                  </div>
                  <div className="text-slate-300 space-y-1 text-[11px]">
                    <div>
                      ☑ <strong>Setup 4 (Vacuum Transit):</strong> Regime = <code className="font-mono text-amber-300">C2: Breakout</code>, <code className="font-mono text-pink-300">Basin Distance ≥ 1.71σ</code>, high speed <code className="font-mono text-amber-300">v ≥ 0.60 σ/b</code>, straight line (<code className="font-mono text-purple-300">κ &lt; 0.24</code>, <code className="font-mono">Δθ &lt; 65°</code>), <code className="font-mono text-emerald-300">Iso-Cut ≥ 54%</code>, and spine stretch <code className="font-mono">&lt; 2.25σ</code>.
                    </div>
                    <div className="pt-1 border-t border-white/[0.06]">
                      ☑ <strong>Setup 5 (Orbital Rotation):</strong> Regime = <code className="font-mono text-emerald-300">C1: Orbit</code> with Markov <code className="font-mono">→ Orbit ≥ 44%</code>, outer ring (<code className="font-mono">1.15σ ≤ r ≤ 2.25σ</code>, <code className="font-mono">v ≤ 1.35 σ/b</code>), and leading leg (<code className="font-mono">XAUEUR</code> if <code className="font-mono">Lz ≥ +0.50</code>; <code className="font-mono">FX</code> if <code className="font-mono">Lz ≤ -0.50</code>) inflects from <code className="font-mono">≥ 1.10σ</code> back toward the 3D Spine.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION: PILLAR #6 CLUSTERS & MARKOV */}
          {show("clusters") && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#1f293d] pb-1.5">
                <Boxes className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Pillar #6: Phase Regime Clusters (K=4), Markov Odds &amp; 3D Attractor Basins
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-[#111827] border border-sky-500/40 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-extrabold text-sky-300">
                    C0: Compression Coil
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Low radius <code className="font-mono">r_t</code>, low speed <code className="font-mono">v_t</code>, high turning <code className="font-mono">κ_t</code>. Spring winding near spine; watch Markov odds for transition to <code className="text-amber-300">C2: Breakout</code>.
                  </p>
                </div>

                <div className="bg-[#111827] border border-emerald-500/40 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-extrabold text-emerald-300">
                    C1: Equilibrium Orbit
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Moderate displacement, high rotational area <code className="font-mono">|Lz|</code>. Two-way rotational market; fade <code className="text-purple-300">±2σ</code> Bollinger touches back to the spine.
                  </p>
                </div>

                <div className="bg-[#111827] border border-amber-500/40 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-extrabold text-amber-300">
                    C2: Directional Breakout
                  </div>
                  <p className="text-[11px] text-slate-300">
                    High speed <code className="font-mono">v_t</code>, expanding radius <code className="font-mono">r_t</code>, low curvature <code className="font-mono">κ_t</code>. Ballistic trend trajectory; ride momentum.
                  </p>
                </div>

                <div className="bg-[#111827] border border-rose-500/40 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-extrabold text-rose-300">
                    C3: Tail / Shock Regime
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Extreme <code className="font-mono">&gt;2.2σ</code> excursion + velocity &amp; curvature spike. Exhaustion blow-off or news shock; prepare for snap-back.
                  </p>
                </div>
              </div>

              <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-pink-300">
                  Spatial 3D Attractor Basins (3D Clusters Plugin):
                </div>
                <div>
                  • <strong>Dwell Share (%):</strong> Identifies the 3D consolidation basins where price spent the most time (<code className="font-mono">&gt;45%</code> = dominant 3D value area).
                </div>
                <div>
                  • <strong>Basin Distance (&lt; 1.5σ vs. &gt; 2.0σ Vacuum):</strong> Below <code className="font-mono">1.5σ</code>, price is pulled toward the basin center; above <code className="text-rose-400 font-mono">2.0σ (LIQUIDITY VACUUM)</code>, price slices rapidly through thin order-book space.
                </div>
              </div>
            </section>
          )}

          {/* SECTION: PILLAR #2 DIFFERENTIAL GEOMETRY */}
          {show("geometry") && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#1f293d] pb-1.5">
                <Compass className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Pillar #2: 3D Differential Geometry &amp; Spiral Chirality (Velocity, Curvature &amp; Lévy Lz)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-1.5">
                  <div className="font-bold text-emerald-400">
                    Signed Lévy Area Lz — Who Leads the Spiral?
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 bg-[#090d16] px-2 py-1 rounded">
                    Lz = ½ Σ (x̃_k-1 Δỹ_k − ỹ_k-1 Δx̃_k)
                  </div>
                  <div className="text-emerald-300">
                    • <strong>Lz &gt; +0.5 (CCW — Cross-Gold Leads):</strong> Bullion flows initiate the move; FX reacts with a lag.
                  </div>
                  <div className="text-sky-300">
                    • <strong>Lz &lt; -0.5 (CW — FX Leads):</strong> FX (<code className="font-mono">EURUSD</code>/<code className="font-mono">USDJPY</code>) initiates the move; Gold follows passively.
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-1.5">
                  <div className="font-bold text-cyan-400">
                    Compression Coil Score (0..100) &amp; 3D Curvature (κ)
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 bg-[#090d16] px-2 py-1 rounded">
                    κ_t = ||γ&apos;(t) × γ&apos;&apos;(t)|| / (x̃&apos;² + ỹ&apos;² + 1)^(3/2)
                  </div>
                  <div className="text-cyan-300">
                    • <strong>Coil Score ≥ 45/100:</strong> Tight spring winding around the 3D MA spine (Cyan 3D rings appear).
                  </div>
                  <div className="text-rose-300">
                    • <strong>Curvature κ &gt; 0.38 after High Velocity:</strong> Sharp phase-space hook / V-reversal inflection.
                  </div>
                </div>

                <div className="md:col-span-2 bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-1.5">
                  <div className="font-bold text-amber-300">
                    Top-Down Turning / Deflection Angle (Δθ_t: &lt;90° Forward vs. ≥90° Hairpin) &amp; Hairpin Ratio (%)
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 bg-[#090d16] px-2 py-1 rounded">
                    Δθ_t = arccos( (Δu_t-1 · Δu_t) / (||Δu_t-1|| ||Δu_t||) ) ∈ [0°, 180°]
                  </div>
                  <div className="text-emerald-300">
                    • <strong>Δθ_t &lt; 90° (Acute / Forward Continuation) &amp; Hairpin Ratio ≤ 25% (Laminar Flow):</strong> Consecutive top-down (X,Y) steps maintain positive directional alignment—confirming smooth trend continuation or orbital sweep.
                  </div>
                  <div className="text-rose-300">
                    • <strong>Δθ_t ≥ 90° (Obtuse / Hairpin Reversal) &amp; Hairpin Ratio ≥ 50% (Whipsaw Chop):</strong> Consecutive steps fold back against themselves (Rose diamond markers in 3D &amp; 2D), signaling either a violent V-reversal at an extreme or high-frequency bid-ask chop near the spine.
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION: CORE INDICATORS */}
          {show("indicators") && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#1f293d] pb-1.5">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Core 3D &amp; 2D Structural Indicators
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-1">
                  <div className="font-bold text-emerald-400">
                    Primary &amp; Slow 3D MA Spines (vector-ma / slow-ma)
                  </div>
                  <p>
                    Tracks the central equilibrium trajectory <code className="font-mono">(MA_X, MA_Y, t)</code>. A 3D crossover between the Fast (20) and Slow (50) spines confirms a multivariate regime transition.
                  </p>
                </div>

                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-1">
                  <div className="font-bold text-amber-400">
                    Phase Displacement (%) &amp; Causal Z-Score
                  </div>
                  <p>
                    Measures percentage distance from the 3D MA spine. <code className="text-sky-300 font-mono">Z &lt; -0.8σ</code> indicates quiet equilibrium compression; <code className="text-rose-400 font-mono">Z &gt; +2.0σ</code> flags statistical overextension.
                  </p>
                </div>

                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-1">
                  <div className="font-bold text-purple-400">
                    3D Volatility Bollinger Tube (bollinger-3d)
                  </div>
                  <p>
                    Wraps the spine in <code className="font-mono">±kσ</code> elliptical rings. Pinched rings signal a bilateral volatility squeeze; horizontally wide rings indicate Gold-dominant volatility.
                  </p>
                </div>

                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 space-y-1">
                  <div className="font-bold text-amber-300">
                    Iso-XAUUSD Floor Contours (iso-contours)
                  </div>
                  <p>
                    Constant-USD-Gold hyperbolas on <code className="font-mono">Z=0</code>. Sliding parallel to curves = pure FX translation; cutting perpendicularly across curves = true USD Gold revaluation.
                  </p>
                </div>

                <div className="md:col-span-2 bg-[#111827] border border-amber-500/30 rounded-lg p-3 space-y-1.5">
                  <div className="font-bold text-amber-400">
                    3D Phase-Space Entropy &amp; Signal-to-Noise Filter (phase-entropy-3d &amp; Entropy 2D Pane)
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 bg-[#090d16] px-2 py-1 rounded">
                    H_perm(d=3) = -Σ p_π ln(p_π)/ln(6) | H_Δφ = 0.55·H_sector(Δφ) + 0.45·(1 - R̄_Δφ²) | H_Markov = -Σ P_ij ln(P_ij)/ln(4)
                  </div>
                  <p>
                    Combines <strong>Turning-Angle Circular Entropy (H_Δφ)</strong>, <strong>Bandt–Pompe Ordinal Permutation Entropy (d=3)</strong> on primary <code className="font-mono">XAUUSD</code> &amp; <code className="font-mono">FX</code> legs, and <strong>Markov Regime Transition Entropy</strong> into a 0–100% Composite Disorder Index:
                  </p>
                  <div className="text-emerald-300">
                    • <strong>&lt; 45% (ORDERED FLOW):</strong> Coherent ballistic trend or structured harmonic orbit—high signal-to-noise ratio.
                  </div>
                  <div className="text-rose-300">
                    • <strong>≥ 75% (MAX ENTROPY CHOP / NO-TRADE):</strong> Multi-directional white-noise chop; automatically dampens false-positive <code className="font-mono">coilScore</code> spikes via <code className="font-mono">entropyQualityCoilScore</code>.
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION: MANIFOLD MATH */}
          {show("manifold") && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#1f293d] pb-1.5">
                <Activity className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Cross-Rate Identities (CCY_USD vs. USD_CCY)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 font-mono text-emerald-300 space-y-1">
                  <div className="text-amber-400 font-sans font-bold">
                    CCY_USD (EURUSD, GBPUSD, AUDUSD):
                  </div>
                  <div>XAUUSD / XAUEUR = EURUSD</div>
                  <div>XAUEUR / XAUUSD = USDEUR = 1 / EURUSD</div>
                </div>
                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3 font-mono text-sky-300 space-y-1">
                  <div className="text-sky-400 font-sans font-bold">
                    USD_CCY (USDJPY, USDCHF, USDCAD):
                  </div>
                  <div>XAUJPY / USDJPY = XAUUSD</div>
                  <div>XAUJPY = XAUUSD × USDJPY</div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION: FUTURE ROADMAP */}
          {show("roadmap") && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#1f293d] pb-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Future Quantitative Research Roadmap (#1, #3, #4, #5)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3">
                  <strong className="text-amber-400">
                    #1 Orthogonal Driver Decomposition:
                  </strong>{" "}
                  Iso-Gold Tangent/Normal projection + Rolling OLS <code className="font-mono">β_t</code> residual alpha.
                </div>
                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3">
                  <strong className="text-purple-400">
                    #3 Mahalanobis Distance &amp; PCA Eigen-Tubes:
                  </strong>{" "}
                  Full <code className="font-mono">2×2</code> covariance <code className="font-mono">Σ⁻¹</code> distance and rotated 3D Bollinger eigen-rings.
                </div>
                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3">
                  <strong className="text-sky-400">
                    #4 Unbiased Primary Correlation &amp; Lead-Lag ρ(τ):
                  </strong>{" "}
                  Direct <code className="font-mono">r(Δln XAUUSD, Δln FX)</code> cross-correlation profile across lags <code className="font-mono">τ ∈ [-10, +10]</code>.
                </div>
                <div className="bg-[#111827] border border-[#1f293d] rounded-lg p-3">
                  <strong className="text-emerald-400">
                    #5 Multi-Currency G10 Gold Dispersion:
                  </strong>{" "}
                  Global Gold Factor <code className="font-mono">r̄_XAU</code> vs. Cross-Currency Dispersion <code className="font-mono">σ_disp</code> across all 6 G10 triads.
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Popup Footer */}
        <div className="bg-[#090d16] border-t border-[#1f293d] px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Press Esc or click outside to close</span>
          <div className="flex items-center gap-3">
            <a
              href="/guide"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
            >
              <span>Open Full Page in New Tab</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
