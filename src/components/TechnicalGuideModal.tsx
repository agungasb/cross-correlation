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
