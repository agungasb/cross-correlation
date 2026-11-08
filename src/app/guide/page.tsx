"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Boxes,
  CheckCircle2,
  Compass,
  Cpu,
  ExternalLink,
  Flame,
  GitCompare,
  Layers,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

type GuideSectionId =
  | "all"
  | "manifold"
  | "indicators"
  | "geometry"
  | "clusters"
  | "playbook"
  | "verification"
  | "roadmap";

export default function TechnicalGuidePage() {
  const [activeFilter, setActiveFilter] = useState<GuideSectionId>("all");

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
        label: "Regime Clusters & Basins (#6)",
        icon: <Boxes className="w-3.5 h-3.5 text-pink-400" />,
      },
      {
        id: "geometry",
        label: "3D Geometry & Chirality (#2)",
        icon: <Compass className="w-3.5 h-3.5 text-cyan-300" />,
      },
      {
        id: "indicators",
        label: "Core 3D/2D Indicators",
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
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col selection:bg-cyan-500/30">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-[#0d131f]/95 backdrop-blur-md border-b border-[#1f293d] px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/icon-192.png"
                alt="3D Triad"
                className="w-6 h-6 rounded-md border border-cyan-500/40"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-400 bg-clip-text text-transparent">
                    3D TRIAD QUANTITATIVE WHITEPAPER & PLAYBOOK
                  </span>
                  <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    v2.0 Field Guide
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Mathematical Foundations, Indicator State Interpretation &
                  High-Conviction Trading Setups
                </p>
              </div>
            </div>

            <Link
              href="/"
              className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>3D App</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to 3D Analyzer Workstation</span>
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="max-w-6xl mx-auto mt-3 pt-2.5 border-t border-[#182235] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const active = activeFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveFilter(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-[#1e293b] text-white border border-cyan-500/40 shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl w-full mx-auto px-4 py-6 space-y-8 flex-1">
        {/* Executive Abstract Banner */}
        <section className="rounded-xl bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#131c31] border border-[#263554] p-5 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <Zap className="w-4 h-4" />
            <span>Core Research Thesis & Purpose</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-extrabold text-white leading-snug">
            Why 3D Phase-Space Manifold Analysis Outperforms 2D XAUUSD Charts
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            A standard 2D <code className="text-amber-300 font-mono">XAUUSD</code>{" "}
            chart collapses two independent stochastic processes—<strong>intrinsic global bullion demand</strong> and{" "}
            <strong>US Dollar foreign exchange valuation</strong>—onto a single vertical axis. On a 2D chart, a{" "}
            <code className="text-emerald-300 font-mono">+$20</code> Gold rally looks identical whether it was caused by passive USD weakness (<code className="text-sky-300 font-mono">EURUSD</code> spiking while Euro-Gold sits flat) or genuine sovereign accumulation across all currencies simultaneously.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#090d16]/90 border border-[#1f293d] rounded-lg p-3">
              <div className="text-xs font-bold text-amber-400 mb-1">
                X-Axis: Synthetic Cross-Gold (X_t)
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tracks Gold priced in the partner G10 currency (<code className="text-slate-200">XAUEUR</code>, <code className="text-slate-200">XAUJPY</code>, <code className="text-slate-200">XAUGBP</code>, <code className="text-slate-200">XAUCHF</code>, <code className="text-slate-200">XAUAUD</code>, <code className="text-slate-200">XAUCAD</code>), stripping out pure US Dollar noise.
              </p>
            </div>
            <div className="bg-[#090d16]/90 border border-[#1f293d] rounded-lg p-3">
              <div className="text-xs font-bold text-sky-400 mb-1">
                Y-Axis: G10 FX Proxy (Y_t)
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tracks the active G10 exchange rate (<code className="text-slate-200">EURUSD</code>, <code className="text-slate-200">USDJPY</code>, etc.) to isolate macro currency flows and interest-rate differential shocks.
              </p>
            </div>
            <div className="bg-[#090d16]/90 border border-[#1f293d] rounded-lg p-3">
              <div className="text-xs font-bold text-purple-400 mb-1">
                Z-Axis: Elapsed Time & Orbital Geometry
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Unfolds 2D phase loops into 3D spirals, exposing <strong>Compression Coils</strong>, <strong>Spiral Chirality (Lead-Lag)</strong>, and <strong>3D Attractor Basins</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 1: MANIFOLD MATH */}
        {show("manifold") && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f293d] pb-2">
              <Activity className="w-5 h-5 text-sky-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                1. Mathematical Cross-Rate Manifold & Iso-XAUUSD Foliation
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Convention A: Direct Currency-USD (CCY_USD)
                </div>
                <p className="text-xs text-slate-300">
                  Applies to <code className="text-amber-300 font-mono">EURUSD</code>,{" "}
                  <code className="text-amber-300 font-mono">GBPUSD</code>, and{" "}
                  <code className="text-amber-300 font-mono">AUDUSD</code> (quoted in USD per 1 unit of foreign currency):
                </p>
                <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 font-mono text-xs text-emerald-300 space-y-1">
                  <div>X_t = XAUEUR = XAUUSD / EURUSD</div>
                  <div>Y_t = EURUSD = XAUUSD / XAUEUR</div>
                  <div>XAUUSD = X_t × Y_t</div>
                  <div className="text-slate-400 text-[11px] pt-1">
                    Note: XAUEUR / XAUUSD = USDEUR = 1 / EURUSD
                  </div>
                </div>
              </div>

              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  Convention B: USD-Base Quotes (USD_CCY)
                </div>
                <p className="text-xs text-slate-300">
                  Applies to <code className="text-sky-300 font-mono">USDJPY</code>,{" "}
                  <code className="text-sky-300 font-mono">USDCHF</code>, and{" "}
                  <code className="text-sky-300 font-mono">USDCAD</code> (quoted in foreign currency units per 1 USD):
                </p>
                <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 font-mono text-xs text-sky-300 space-y-1">
                  <div>X_t = XAUJPY = XAUUSD × USDJPY</div>
                  <div>Y_t = USDJPY = XAUJPY / XAUUSD</div>
                  <div>XAUUSD = X_t / Y_t</div>
                  <div className="text-slate-400 text-[11px] pt-1">
                    Iso-XAUUSD contours form rays Y = X / G_0 on Z=0
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: CORE 3D & 2D INDICATORS */}
        {show("indicators") && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f293d] pb-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                2. Core 3D & 2D Structural Indicators (Objective, Question & Interpretation)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary & Slow 3D MA */}
              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">
                    Primary & Slow 3D Moving Average Spines (vector-ma / slow-ma)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300">
                    Trend Attractor
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  <strong>Question Answered:</strong>{" "}
                  <em>
                    &ldquo;Where is the joint multivariate center of gravity for Cross-Gold and FX over period P, and is the fast spine crossing the slow structural spine in 3D?&rdquo;
                  </em>
                </p>
                <div className="bg-[#090d16] border border-[#1e293b] rounded p-2.5 font-mono text-[11px] text-slate-200">
                  M(t) = ( MA_X(t; P), MA_Y(t; P), Z_t )
                </div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>
                    <strong className="text-white">Orbiting Spine:</strong> Dynamic equilibrium; fade outer deviations back to the spine.
                  </li>
                  <li>
                    <strong className="text-white">Vertical Spine Slope:</strong> Tight price acceptance in both X and Y as time progresses.
                  </li>
                  <li>
                    <strong className="text-white">3D Golden / Death Cross:</strong> When Fast 3D MA (20) crosses Slow 3D MA (50) in both X and Y simultaneously, a structural trend transition is confirmed.
                  </li>
                </ul>
              </div>

              {/* Phase Displacement & Z-Score */}
              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">
                    Phase Displacement (%) & Causal Z-Score
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300">
                    2D Z-Score Tab
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  <strong>Question Answered:</strong>{" "}
                  <em>
                    &ldquo;How far is the active price head stretched from its 3D moving average center in percentage and standard deviation terms?&rdquo;
                  </em>
                </p>
                <div className="bg-[#090d16] border border-[#1e293b] rounded p-2.5 font-mono text-[11px] text-slate-200">
                  Disp% = √[ ((X - MA_X)/MA_X)² + ((Y - MA_Y)/MA_Y)² ] × 100%
                </div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>
                    <strong className="text-sky-300">Z &lt; -0.8σ (Quiet Band):</strong> Trajectory is hugging the 3D MA spine; compression building.
                  </li>
                  <li>
                    <strong className="text-emerald-300">-0.8σ to +1.5σ:</strong> Normal rotational oscillation.
                  </li>
                  <li>
                    <strong className="text-rose-400">Z &gt; +2.0σ (Red Threshold):</strong> Statistical overextension; high snap-back risk unless in early <code className="text-amber-300">C2: Breakout</code>.
                  </li>
                </ul>
              </div>

              {/* 3D Volatility Bollinger Tube */}
              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400">
                    3D Volatility Bollinger Tube (bollinger-3d)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/15 text-purple-300">
                    Volatility Envelope
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  <strong>Question Answered:</strong>{" "}
                  <em>
                    &ldquo;Is the 3D dispersion tunnel pinching into a squeeze or expanding, and which leg is driving the volatility expansion?&rdquo;
                  </em>
                </p>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>
                    <strong className="text-white">Tube Bottleneck (Pinched Rings):</strong> Bilateral volatility squeeze across both Gold and FX.
                  </li>
                  <li>
                    <strong className="text-white">Wide Horizontal Rings (σ_X ≫ σ_Y):</strong> Cross-Gold volatility dominating while FX is stable.
                  </li>
                  <li>
                    <strong className="text-white">Tall Vertical Rings (σ_Y ≫ σ_X):</strong> FX macro shock dominating while Cross-Gold is buffered.
                  </li>
                </ul>
              </div>

              {/* Iso-XAUUSD Floor Contours */}
              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    Iso-XAUUSD Floor Contours & Shadow (iso-contours)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300">
                    Z=0 Foliation
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  <strong>Question Answered:</strong>{" "}
                  <em>
                    &ldquo;Is XAUUSD moving from genuine Gold repricing or passive USD currency translation?&rdquo;
                  </em>
                </p>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>
                    <strong className="text-sky-300">Sliding Parallel to Floor Curves:</strong> Pure FX translation—<code className="text-slate-200">XAUEUR</code> and <code className="text-slate-200">EURUSD</code> offset each other so <code className="text-slate-200">XAUUSD</code> stays constant.
                  </li>
                  <li>
                    <strong className="text-emerald-300">Cutting Orthogonally Across Curves:</strong> Genuine intrinsic Gold impulse across all currencies simultaneously.
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: PILLAR #2 DIFFERENTIAL GEOMETRY & CHIRALITY */}
        {show("geometry") && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f293d] pb-2">
              <Compass className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                3. Pillar #2: 3D Differential Geometry & Spiral Chirality (Velocity, Curvature & Lévy Area)
              </h2>
            </div>

            <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-4">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Visual appearance in a 3D viewport depends on camera angle and manual axis stretching. The{" "}
                <strong className="text-cyan-300">Differential Geometry Engine</strong> (<code className="font-mono text-xs text-slate-200">computePhaseGeometry3D</code>) standardizes <code className="font-mono text-xs">(X_t, Y_t)</code> into dimensionless volatility coordinates <code className="font-mono text-xs">(x̃_t, ỹ_t)</code> around the 3D MA spine and computes four camera-invariant physical metrics:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3.5 space-y-1.5">
                  <div className="text-xs font-bold text-emerald-400">
                    A. Signed Lévy Stochastic Area (L_z,t) — Lead-Lag Chirality
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 bg-[#111827] px-2 py-1 rounded">
                    L_z,t = ½ Σ (x̃_k-1 Δỹ_k − ỹ_k-1 Δx̃_k)
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>Question Answered:</strong> <em>&ldquo;Which market leg (Cross-Gold vs. FX) is initiating the rotational cycle?&rdquo;</em>
                  </p>
                  <ul className="text-xs space-y-1 pt-1">
                    <li className="text-emerald-300">
                      ● <strong>L_z &gt; +0.5 (CCW Spiral — Cross-Gold Leads):</strong> Bullion flows (<code className="font-mono">XAUEUR</code>/<code className="font-mono">XAUJPY</code>) turn first; FX reacts with a phase lag. High trend conviction for Gold.
                    </li>
                    <li className="text-sky-300">
                      ● <strong>L_z &lt; -0.5 (CW Spiral — FX Leads):</strong> The FX leg (<code className="font-mono">EURUSD</code>/<code className="font-mono">USDJPY</code>) turns first; Gold is passively following Dollar flow.
                    </li>
                  </ul>
                </div>

                <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3.5 space-y-1.5">
                  <div className="text-xs font-bold text-cyan-400">
                    B. Compression Coil Score (0..100) & Frenet-Serret Curvature (κ_t)
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 bg-[#111827] px-2 py-1 rounded">
                    κ_t = ||γ&apos;(t) × γ&apos;&apos;(t)|| / (x̃&apos;² + ỹ&apos;² + 1)^(3/2)
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>Question Answered:</strong> <em>&ldquo;Is the 3D trajectory winding into a compressed spring or bending into an exhaustion reversal?&rdquo;</em>
                  </p>
                  <ul className="text-xs space-y-1 pt-1">
                    <li className="text-cyan-300">
                      ● <strong>Coil Score ≥ 45/100 (Cyan 3D Halos):</strong> Low velocity + small radius + high turning rate. Energy is coiling prior to a breakout.
                    </li>
                    <li className="text-amber-300">
                      ● <strong>Velocity v_t &gt; 0.8σ/b &amp; Curvature κ_t &lt; 0.15:</strong> Clean, straight ballistic breakout.
                    </li>
                    <li className="text-rose-300">
                      ● <strong>High v_t + Sudden κ_t &gt; 0.40 Spike:</strong> Trajectory just hit a wall and bent sharply (V-reversal / stop sweep).
                    </li>
                  </ul>
                </div>

                <div className="md:col-span-2 bg-[#090d16] border border-[#1e293b] rounded-lg p-3.5 space-y-1.5">
                  <div className="text-xs font-bold text-amber-300">
                    C. Top-Down Turning / Deflection Angle (Δθ_t: &lt;90° Forward vs. ≥90° Hairpin) &amp; Hairpin Ratio (%)
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 bg-[#111827] px-2 py-1 rounded">
                    Δθ_t = arccos( (Δu_t-1 · Δu_t) / (||Δu_t-1|| ||Δu_t||) ) ∈ [0°, 180°]
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>Question Answered:</strong> <em>&ldquo;When viewed from the top down (XY plane), is the trajectory flowing forward smoothly (&lt;90°) or folding back in sharp hairpin reversals (≥90°)?&rdquo;</em>
                  </p>
                  <ul className="text-xs space-y-1 pt-1">
                    <li className="text-emerald-300">
                      ● <strong>Δθ_t &lt; 90° (Forward Continuation) &amp; Hairpin Ratio ≤ 25% (Laminar Flow):</strong> Consecutive volatility-standardized top-down steps have a positive dot product—confirming smooth directional momentum or clean orbital rotation.
                    </li>
                    <li className="text-rose-300">
                      ● <strong>Δθ_t ≥ 90° (Hairpin Pivot) &amp; Hairpin Ratio ≥ 50% (Whipsaw Chop):</strong> Consecutive steps fold back at an obtuse angle (marked by Rose diamonds in 3D and dots on the 2D Geometry curve), flagging either an exhaustion V-reversal at outer rails or noisy mean-reverting chop.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 4: PILLAR #6 CLUSTER ANALYSIS & MARKOV MATRIX */}
        {show("clusters") && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f293d] pb-2">
              <Boxes className="w-5 h-5 text-pink-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                4. Pillar #6: Unsupervised Phase Regime Clusters (K=4), Markov Matrix & 3D Attractor Basins
              </h2>
            </div>

            {/* 4 Canonical Regimes Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[#111827] border border-sky-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    C0: Compression Coil
                  </span>
                  <span className="text-[11px] font-mono text-sky-400">#38bdf8</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Signature:</strong> Low radial distance <code className="font-mono">r_t</code>, low speed <code className="font-mono">v_t</code>, high turning intensity <code className="font-mono">κ_t</code>.
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong>Interpretation:</strong> Liquidity absorption &amp; spring winding around the 3D MA spine. Prepare for directional breakout when state flips to <code className="text-amber-300">C2</code>.
                </p>
              </div>

              <div className="bg-[#111827] border border-emerald-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    C1: Equilibrium Orbit
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400">#34d399</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Signature:</strong> Moderate displacement with high signed orbital area <code className="font-mono">|L_z,t|</code>.
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong>Interpretation:</strong> Healthy two-way rotational cycle. Ideal regime for fading <code className="text-purple-300">±2σ</code> Bollinger tube touches back toward the spine.
                </p>
              </div>

              <div className="bg-[#111827] border border-amber-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    C2: Directional Breakout
                  </span>
                  <span className="text-[11px] font-mono text-amber-400">#f59e0b</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Signature:</strong> High velocity <code className="font-mono">v_t</code>, expanding radius <code className="font-mono">r_t</code>, low curvature <code className="font-mono">κ_t</code>.
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong>Interpretation:</strong> Ballistic trend expansion escaping equilibrium. Ride momentum; do not fade until velocity stalls.
                </p>
              </div>

              <div className="bg-[#111827] border border-rose-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    C3: Tail / Shock Regime
                  </span>
                  <span className="text-[11px] font-mono text-rose-400">#f43f5e</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Signature:</strong> Extreme <code className="font-mono">&gt;2.2σ</code> excursion with simultaneous velocity &amp; curvature spikes.
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong>Interpretation:</strong> Exhaustion blow-off or macro news shock. High probability of violent snap-back once curvature hooks.
                </p>
              </div>
            </div>

            {/* Spatial 3D Basins & Markov Odds Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-pink-400 uppercase tracking-wider">
                  Spatial 3D Attractor Basins (cluster-attractors-3d)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Partitions the 3D price trajectory into <code className="font-mono">K = 2..5</code> consolidation basins using deterministic quantile-seeded K-Means and draws Cholesky covariance-tilted ellipsoid rings:
                </p>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>
                    <strong className="text-pink-300">Dwell Share (%):</strong> A basin with <code className="font-mono">&gt;45%</code> dwell share is the dominant 3D value area (Point of Control).
                  </li>
                  <li>
                    <strong className="text-emerald-300">Basin Distance &lt; 1.5σ (In Basin):</strong> Price is inside a high-liquidity consolidation node; expect two-way mean-reverting flow.
                  </li>
                  <li>
                    <strong className="text-rose-400">Basin Distance &gt; 2.0σ (LIQUIDITY VACUUM):</strong> Price has escaped all historical consolidation basins into thin order-book space—price moves rapidly until reaching the next basin.
                  </li>
                </ul>
              </div>

              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  Markov Next-State Transition Odds P(S_t+1 | C_k)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  In the <code className="font-mono text-amber-300">Metrics</code> sidebar tab, the <code className="font-mono">4×4</code> causal Markov transition matrix reports the empirical probability of transitioning from the active regime to each of the 4 regimes on the next bar:
                </p>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>
                    <strong className="text-white">High Self-Persistence (&gt;70%):</strong> Current regime is entrenched and stable.
                  </li>
                  <li>
                    <strong className="text-white">Rising Coil → Breakout Odds (&gt;25%):</strong> Indicates that compression coils on this timeframe frequently resolve into ballistic breakouts.
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 5: HIGH-CONVICTION COMBINED PLAYBOOK */}
        {show("playbook") && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f293d] pb-2">
              <Target className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                5. High-Conviction Combined Playbook (Operational Quick Checklist)
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Setup 1 */}
              <div className="bg-gradient-to-b from-[#111827] to-[#0d1424] border border-emerald-500/35 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white">
                      Setup 1: The &ldquo;Coiled Bullion Breakout&rdquo;
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Trend Entry
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Captures genuine institutional Gold breakouts emerging from a compressed 3D spring.
                </p>
                <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="font-bold text-cyan-300">
                    1. Pre-Conditions (Compression Build-Up):
                  </div>
                  <div className="text-slate-300">
                    • Regime = <code className="text-sky-300 font-mono">C0: Coil</code> for ≥ 5 bars &amp; <code className="text-cyan-300 font-mono">Coil Score &gt; 45/100</code>.
                  </div>
                  <div className="text-slate-300">
                    • <code className="text-pink-300 font-mono">Basin Distance &lt; 1.2σ</code> (compressed inside an established 3D Attractor Basin).
                  </div>
                  <div className="font-bold text-emerald-300 pt-1">
                    2. Execution Trigger:
                  </div>
                  <div className="text-slate-300">
                    • Regime flips <code className="text-amber-300 font-mono">C0 → C2: Breakout</code> &amp; <code className="text-pink-300 font-mono">Basin Distance &gt; 1.8σ (Vacuum)</code>.
                  </div>
                  <div className="text-slate-300">
                    • <code className="text-emerald-300 font-mono">Lévy Area Lz &gt; 0 (CCW: Cross-Gold Leads)</code> &amp; floor trajectory cuts <strong>orthogonally across</strong> Iso-XAUUSD contours.
                  </div>
                </div>
              </div>

              {/* Setup 2 */}
              <div className="bg-gradient-to-b from-[#111827] to-[#0d1424] border border-sky-500/35 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white">
                      Setup 2: The &ldquo;Fake Dollar-Induced Gold Spike&rdquo;
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    False-Breakout Filter
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Filters out deceptive 2D <code className="font-mono">XAUUSD</code> spikes caused solely by passive USD exchange-rate noise.
                </p>
                <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="font-bold text-sky-300">
                    Diagnostic Checklist:
                  </div>
                  <div className="text-slate-300">
                    • <strong>Floor Shadow:</strong> Slides <strong>parallel</strong> to the <code className="text-amber-300 font-mono">Iso-XAUUSD</code> floor contour rather than cutting across it.
                  </div>
                  <div className="text-slate-300">
                    • <strong>Spiral Chirality:</strong> <code className="text-sky-300 font-mono">Lévy Area Lz &lt; -0.5 (CW: FX Leads)</code>—confirming the move originated in FX, not bullion.
                  </div>
                  <div className="text-slate-300">
                    • <strong>Basin Containment:</strong> <code className="text-pink-300 font-mono">Basin Distance &lt; 1.5σ</code> (still trapped inside the consolidation basin).
                  </div>
                  <div className="text-amber-300 font-semibold pt-1">
                    → Action: Do not chase the XAUUSD move; fade back toward the 3D MA spine once FX stalls.
                  </div>
                </div>
              </div>

              {/* Setup 3 */}
              <div className="bg-gradient-to-b from-[#111827] to-[#0d1424] border border-rose-500/35 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white">
                      Setup 3: &ldquo;Exhaustion Blow-Off &amp; Curvature Hook&rdquo;
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Mean-Reversion
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Identifies the exact bar where an overextended parabolic move hooks back toward equilibrium.
                </p>
                <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="font-bold text-rose-300">
                    Trigger Checklist:
                  </div>
                  <div className="text-slate-300">
                    • Regime = <code className="text-rose-400 font-mono">C3: Tail / Shock</code> &amp; <code className="text-emerald-300 font-mono">Phase Z-Score &gt; +2.2σ</code> (outside the 3D Bollinger Tube).
                  </div>
                  <div className="text-slate-300">
                    • <code className="text-pink-300 font-mono">Basin Distance &gt; 2.3σ (LIQUIDITY VACUUM)</code>.
                  </div>
                  <div className="text-slate-300">
                    • <strong>Frenet-Serret Hook:</strong> <code className="text-amber-300 font-mono">Phase Velocity (v)</code> ticks down on the exact bar that <code className="text-purple-300 font-mono">3D Curvature (κ) &gt; 0.38</code> spikes.
                  </div>
                  <div className="text-emerald-300 font-semibold pt-1">
                    → Target: Snap-back to the Primary 3D MA Spine (0.0σ) or nearest Attractor Basin edge (1.0σ).
                  </div>
                </div>
              </div>

              {/* Setup 4 & 5 */}
              <div className="bg-gradient-to-b from-[#111827] to-[#0d1424] border border-purple-500/35 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white">
                      Setup 4 &amp; 5: Vacuum Transit &amp; Orbital Lead-Lag
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    Structural Flow
                  </span>
                </div>
                <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 space-y-2 text-xs">
                  <div>
                    <div className="font-bold text-pink-300">
                      Setup 4 — Liquidity Vacuum Transit (Basin-to-Basin):
                    </div>
                    <p className="text-slate-300 mt-0.5">
                      When price exits a high-dwell Attractor Basin (<code className="font-mono">&gt;2.0σ Vacuum</code>) in <code className="text-amber-300 font-mono">C2: Breakout</code> with <code className="font-mono">v_t &gt; 0.75σ/b</code> and low curvature (<code className="font-mono">κ &lt; 0.18</code>), order books are thin—ride momentum until entering the next 3D Basin ring.
                    </p>
                  </div>
                  <div className="pt-1.5 border-t border-white/[0.06]">
                    <div className="font-bold text-cyan-300">
                      Setup 5 — Orbital Lead-Lag Rotation (C1: Orbit):
                    </div>
                    <p className="text-slate-300 mt-0.5">
                      During <code className="text-emerald-300 font-mono">C1: Orbit</code> with strong negative <code className="text-sky-300 font-mono">Lz &lt; -1.0 (CW: FX Leads)</code>, watch the FX leg at the <code className="font-mono">±2σ</code> Bollinger rail—its inflection provides a 1–4 bar leading entry signal before Gold turns.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 5B: MANUAL SIGNAL VERIFICATION GUIDE & 6G10 TELEMETRY */}
        {(show("verification") || activeFilter === "playbook") && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f293d] pb-2">
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                5B. Manual Signal Verification Guide &amp; 6G10 Multi-Proxy Telemetry
              </h2>
            </div>

            {/* 1. What 6G10 Breadth Means */}
            <div className="bg-gradient-to-br from-[#0e1a24] to-[#111827] border border-teal-500/35 rounded-xl p-4 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-teal-300">
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
              <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 font-mono text-[11px] text-slate-200">
                Breadth_t = 0.75 · (1/6) Σ tanh(1.35·Δx̃_k,t + 0.35·x̃_k,t) + 0.25 · tanh(0.45·(G_t − G_slow,t)/σ_G,t)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-[#090d16] border border-emerald-500/25 rounded-lg p-2.5">
                  <div className="font-bold text-emerald-400">
                    &gt; +15% (BULL):
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Gold is rising intrinsically across most G10 currencies at once. Confirms <code className="text-emerald-300">▲ BUY</code> trend breakouts (S1, S4) and blocks <code className="text-rose-300">▼ SELL</code> breakouts.
                  </p>
                </div>
                <div className="bg-[#090d16] border border-rose-500/25 rounded-lg p-2.5">
                  <div className="font-bold text-rose-400">
                    &lt; -15% (BEAR):
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Synchronized global bullion selling across G10 currencies. Confirms <code className="text-rose-300">▼ SELL</code> breakouts; at extreme readings (<code className="font-mono">-75%..-90%</code>), wait for a 3D Curvature Hook (S3) off the <code className="text-emerald-300">SUP Bounce Zone</code> before buying.
                  </p>
                </div>
                <div className="bg-[#090d16] border border-slate-600/30 rounded-lg p-2.5">
                  <div className="font-bold text-slate-200">
                    -15% to +15% (NEUT):
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Cross-gold flows are mixed; 2D <code className="font-mono">XAUUSD</code> moves are mostly passive US Dollar FX noise rather than intrinsic bullion demand.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Where to Find Each Indicator Value in Tools -> Metrics */}
            <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-300">
                  Where to Find Each Indicator Value in Tools → Metrics (or Matrix › on Mobile)
                </span>
                <span className="text-[11px] text-slate-400">
                  Tip: Tap any row in &ldquo;Recent Signals&rdquo; to scrub to that exact bar
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                <div className="bg-[#090d16] border border-white/[0.05] rounded-lg p-2.5 space-y-1">
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
                <div className="bg-[#090d16] border border-white/[0.05] rounded-lg p-2.5 space-y-1">
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
                <div className="bg-[#090d16] border border-white/[0.05] rounded-lg p-2.5 space-y-1">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              {/* S1 Manual Check */}
              <div className="bg-[#111827] border border-emerald-500/30 rounded-xl p-4 space-y-2">
                <div className="text-sm font-bold text-emerald-300">
                  Manual Check — Setup 1: 3D Coil Release (S1)
                </div>
                <div className="text-slate-300 space-y-1.5">
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
              <div className="bg-[#111827] border border-sky-500/30 rounded-xl p-4 space-y-2">
                <div className="text-sm font-bold text-sky-300">
                  Manual Check — Setup 2: Fakeout Filter &amp; Fade (S2)
                </div>
                <div className="text-slate-300 space-y-1.5">
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
              <div className="bg-[#111827] border border-rose-500/30 rounded-xl p-4 space-y-2">
                <div className="text-sm font-bold text-rose-300">
                  Manual Check — Setup 3: Exhaustion Curvature Hook (S3)
                </div>
                <div className="text-slate-300 space-y-1.5">
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
              <div className="bg-[#111827] border border-purple-500/30 rounded-xl p-4 space-y-2">
                <div className="text-sm font-bold text-purple-300">
                  Manual Check — Setup 4 (Vacuum) &amp; Setup 5 (Orbit)
                </div>
                <div className="text-slate-300 space-y-1.5">
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

        {/* SECTION 6: FUTURE ROADMAP */}
        {show("roadmap") && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f293d] pb-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                6. Future Quantitative Research Roadmap (Phase 3 Specifications)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-1.5">
                <div className="text-xs font-bold text-amber-400">
                  #1. Orthogonal Driver Decomposition (Tangential vs. Normal Flow &amp; Rolling OLS β_t)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Projects log-returns onto the Iso-Gold Tangent <code className="font-mono">F_∥ = (r_X − r_Y)/√2</code> and Normal <code className="font-mono">F_⊥ = (r_X + r_Y)/√2</code> vectors alongside rolling OLS regression <code className="font-mono">Δln(XAUUSD) = α + β Δln(FX) + ε</code> to quantify exact FX-Explained Share (<code className="font-mono">R²</code>) vs. Idiosyncratic Gold Alpha (<code className="font-mono">1 − R²</code>).
                </p>
              </div>

              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-1.5">
                <div className="text-xs font-bold text-purple-400">
                  #3. Covariance-Aware Mahalanobis Distance (D_M) &amp; Rotated PCA Eigen-Tubes
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Upgrades Euclidean displacement with the full inverse covariance matrix <code className="font-mono">D_M(t) = √[(x − μ)ᵀ Σ⁻¹ (x − μ)]</code> and tilts the 3D Bollinger tube rings along the principal eigenvectors of <code className="font-mono">Σ_t</code> while tracking the Eigenvalue Anisotropy Ratio <code className="font-mono">λ₁ / (λ₁ + λ₂)</code>.
                </p>
              </div>

              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-1.5">
                <div className="text-xs font-bold text-sky-400">
                  #4. Unbiased Primary Correlation r(Δln XAUUSD, Δln FX) &amp; Lead-Lag Profile ρ(τ)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Eliminates the mechanical <code className="font-mono">−Var(Δln Y)</code> division bias in synthetic cross-return correlation and computes the multi-lag Cross-Correlation Function <code className="font-mono">ρ(τ)</code> across <code className="font-mono">τ ∈ [-10, +10]</code> bars.
                </p>
              </div>

              <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-4 space-y-1.5">
                <div className="text-xs font-bold text-emerald-400">
                  #5. Multi-Currency G10 Gold Dispersion (&ldquo;Global Gold vs. USD Factor&rdquo;)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Aggregates Cross-Gold returns across all 6 G10 currencies (<code className="font-mono">EUR, JPY, GBP, CHF, AUD, CAD</code>) to separate single-currency central-bank shocks from high-conviction global bullion breakouts.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1f293d] bg-[#090d16] px-4 py-4 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            Triad Phase Analyzer v2.0 — 3D Phase-Space &amp; Quantitative Market Workstation
          </span>
          <Link
            href="/"
            className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
          >
            <span>Return to Live 3D Workstation</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
