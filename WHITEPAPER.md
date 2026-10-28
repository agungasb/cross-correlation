# Technical Whitepaper: 3D Phase-Space Manifold, Differential Geometry & Unsupervised Regime Clustering for Spot Gold (`XAUUSD`)

**Platform:** Triad Phase Analyzer v2.0  
**Live Deployment:** [https://triad-phase-analyzer-2026.web.app](https://triad-phase-analyzer-2026.web.app)  
**Core Engine Files:** `src/lib/quant/math.ts` · `src/lib/quant/plugins.ts` · `src/components/PhaseSpace3DCanvas.tsx` · `src/components/SynchronizedSubPane2D.tsx`

---

## Abstract

Conventional 2D candlestick charts project `XAUUSD` (Spot Gold in US Dollars) onto a single price-time plane. Because `XAUUSD` is a quotient of two stochastic processes—intrinsic global bullion valuation and the foreign exchange value of the US Dollar—a 2D chart cannot distinguish whether a $+\$20$ move in Gold is a passive currency translation (Dollar weakness) or genuine institutional accumulation of bullion across all major currencies.

This whitepaper documents the mathematical architecture, indicator stack, differential geometry invariants, unsupervised clustering algorithms, and operational trading playbook of the **3D Phase-Space & Quantitative Market Analyzer**. By embedding `XAUUSD` alongside a G10 FX proxy ($Y_t$) and its cross-currency Gold pair ($X_t$) into a 3D space-time manifold $\mathcal{M} = (X_t, Y_t, t)$, the workstation decomposes price action into orthogonal structural components, measures spiral chirality (lead-lag rotation), identifies 3D liquidity attractor basins, and classifies market states via a strictly causal $O(N)$ unsupervised regime engine.

---

## 1. Mathematical Foundations & Cross-Rate Manifold Geometry

### 1.1 The Triangular Cross-Rate Manifold
Let $G_t = \text{XAUUSD}_t$ denote the price of one troy ounce of Gold in USD at discrete bar timestamp $t$. Given a G10 reference currency $C \in \{\text{EUR}, \text{JPY}, \text{GBP}, \text{CHF}, \text{AUD}, \text{CAD}\}$ (`TRIAD_CONFIGS` in `src/types/market.ts`), the system constructs a 3D coordinate vector $\vec{P}_t = (X_t, Y_t, Z_t)$ under two standard FX quotation conventions:

1. **Direct Currency-USD Convention (`CCY_USD`: `EURUSD`, `GBPUSD`, `AUDUSD`):**
   $$Y_t = \frac{\text{USD}}{\text{CCY}}, \qquad X_t = \text{XAUCCY}_t = \frac{G_t}{Y_t} \implies G_t = X_t \cdot Y_t$$
2. **USD-Base Convention (`USD_CCY`: `USDJPY`, `USDCHF`, `USDCAD`):**
   $$Y_t = \frac{\text{CCY}}{\text{USD}}, \qquad X_t = \text{XAUCCY}_t = G_t \cdot Y_t \implies G_t = \frac{X_t}{Y_t}$$

### 1.2 The Iso-XAUUSD Foliation: Separating FX Flow from Intrinsic Gold Flow
For any fixed USD Gold price $G_0$, the locus of points $(X, Y)$ satisfying $G(X, Y) = G_0$ forms a smooth curve on the $Z=0$ phase plane:
* Under `CCY_USD`, the **Iso-XAUUSD contour** is the rectangular hyperbola $Y = G_0 / X$.
* Under `USD_CCY`, the **Iso-XAUUSD contour** is the ray $Y = X / G_0$.

This foliation partitions every infinitesimal price movement $d\vec{r} = (dX, dY)$ into two physically distinct components:
* **Tangential Motion (Sliding *Along* an Iso-XAUUSD Contour):** $dG_t = 0$. Cross-Gold $X_t$ and FX $Y_t$ move in offsetting proportions purely due to USD exchange-rate fluctuations; Gold's USD price is stationary.
* **Normal Motion (Cutting *Orthogonally Across* Iso-XAUUSD Contours):** $dG_t \neq 0$ and $dX_t \neq 0$ in the same intrinsic direction. Gold is being revalued simultaneously across both currencies.

---

## 2. Complete Quantitative Indicator Reference & Interpretation Guide

Every indicator in `src/lib/quant/math.ts` and `src/lib/quant/plugins.ts` is strictly **causal (zero lookahead bias)**: the output at index $t$ depends exclusively on bars $[0 \dots t]$.

---

### 2.1 Primary & Secondary 3D Moving Average Spines (`vector-ma` & `slow-ma`)

* **What It Achieves:** Establishes the central time-varying equilibrium attractor trajectory (the "spine") of the 3D price ribbon across both price dimensions simultaneously.
* **The Core Question Answered:**
  > *"Where is the joint multivariate center of gravity for Cross-Gold and FX over period $P$, and is the fast equilibrium spine crossing the slow structural spine in 3D space?"*
* **Mathematical Formulation (`computeVectorMA`):**
  $$\vec{M}(t; P) = \Big(\text{MA}_X(t; P),\ \text{MA}_Y(t; P),\ Z_t\Big)$$
  supporting both Simple Moving Average ($\text{SMA}_P(u_t) = \frac{1}{P}\sum_{k=0}^{P-1} u_{t-k}$) and Exponential Moving Average ($\text{EMA}_P(u_t) = \alpha u_t + (1-\alpha)\text{EMA}_P(u_{t-1})$ with $\alpha = \frac{2}{P+1}$).
* **How to Interpret the States:**
  * **Trajectory Orbiting Tightly Around `vector-ma` (Emerald Spine):** Market is in dynamic equilibrium; price excursions revert toward the spine.
  * **3D Spine Slope Steepening Vertically (Along Z):** Market is consolidating inside a narrow $(X, Y)$ box while time elapses.
  * **Fast Spine (`vector-ma`, e.g., $P=20$) Crossing Slow Spine (`slow-ma`, e.g., $P=50$):** A **3D Multivariate Golden/Death Cross**. When both $X$ and $Y$ components cross simultaneously, a macro regime shift is underway.

---

### 2.2 Phase Displacement (%) & Causal Z-Score (`displacement` 2D Sub-Pane)

* **What It Achieves:** Compresses the 3D distance between the instantaneous price head $(X_t, Y_t)$ and the 3D MA spine $(\text{MA}_{X,t}, \text{MA}_{Y,t})$ into a normalized scalar oscillator with statistical $\sigma$-bands.
* **The Core Question Answered:**
  > *"How far is the market currently stretched from its 3D moving equilibrium in percentage terms, and is that stretch statistically extreme relative to recent volatility?"*
* **Mathematical Formulation (`computeVectorMA`):**
  $$D_{\%}(t) = \sqrt{\left(\frac{X_t - \text{MA}_{X,t}}{\text{MA}_{X,t}}\right)^2 + \left(\frac{Y_t - \text{MA}_{Y,t}}{\text{MA}_{Y,t}}\right)^2} \times 100\%$$
  $$Z_{\text{disp}}(t) = \frac{D_{\%}(t) - \mu_{D,t}(P)}{\sigma_{D,t}(P)}$$
* **How to Interpret the States:**
  * **$Z_{\text{disp}} < -0.8\sigma$ (Below Sky-Blue Line):** **Equilibrium Hug / Compression.** Price is abnormally close to the 3D MA spine. Energy is building for the next expansion cycle.
  * **$-0.8\sigma \le Z_{\text{disp}} \le +1.5\sigma$:** **Normal Orbital Range.** Standard intraday oscillation around equilibrium.
  * **$Z_{\text{disp}} \ge +2.0\sigma$ (Above Red Dashed Line):** **Statistical Overextension.** The 3D trajectory is stretched to the outer $2.5\%$ tail of its rolling distribution. Unless accompanied by a fresh `C2: Breakout` out of a compression coil, mean-reversion probability back toward the spine is elevated.

---

### 2.3 3D Volatility Bollinger Tube (`bollinger-3d`)

* **What It Achieves:** Wraps the 3D Moving Average spine in a dynamic dispersion tunnel with $\pm k\sigma$ rails and elliptical cross-section rings.
* **The Core Question Answered:**
  > *"Is the 3D dispersion tunnel expanding or contracting, and along which axis (`Cross-Gold` vs. `FX`) is volatility widening?"*
* **Mathematical Formulation (`computeVectorBollinger3D`):**
  At each slice step $t$ and ring angle $\theta \in [0, 2\pi]$:
  $$R_X(t, \theta) = \text{MA}_{X,t} + k\sigma_{X,t}\cos\theta, \qquad R_Y(t, \theta) = \text{MA}_{Y,t} + k\sigma_{Y,t}\sin\theta$$
* **How to Interpret the States:**
  * **Narrow Circular Rings (Tube Pinch / Bottleneck):** Both $\sigma_{X,t}$ and $\sigma_{Y,t}$ have contracted—classic 3D Bollinger Squeeze.
  * **Horizontally Flattened Ellipses ($\sigma_X \gg \sigma_Y$):** Cross-Gold volatility is dominating while FX is quiet (intrinsic bullion volatility regime).
  * **Vertically Elongated Ellipses ($\sigma_Y \gg \sigma_X$):** FX volatility is dominating while Cross-Gold is buffered.
  * **Trajectory Piercing Outside the $2\sigma$ Ring:** Confirms a volatility breakout when paired with high Phase Velocity $v_t$, or an exhaustion spike when paired with high 3D Curvature $\kappa_t$.

---

### 2.4 Iso-XAUUSD Floor Contours & Drop Line (`iso-contours` & `floor-shadow`)

* **What It Achieves:** Projects hyperbolic constant-USD-Gold reference curves and the 2D phase shadow onto the $Z=0$ floor plane.
* **The Core Question Answered:**
  > *"Is the current trajectory sliding passively along a constant-USD-Gold contour (pure FX translation), or cutting across contours (genuine USD Gold repricing)?"*
* **How to Interpret the States:**
  * **Floor Shadow Parallel to the Amber/White Iso-Contours:** Even if `XAUEUR` and `EURUSD` are moving rapidly, they are canceling each other out—`XAUUSD` is stagnant.
  * **Floor Shadow Orthogonal (Perpendicular) to the Iso-Contours:** Maximum directional efficiency for `XAUUSD`; both legs are reinforcing the USD Gold move.

---

### 2.5 Pillar #2: 3D Differential Geometry & Spiral Chirality (`phase-geometry-3d` & `geometry` Sub-Pane)

* **What It Achieves:** Computes camera-invariant physical invariants of the 3D trajectory—**Phase Velocity ($v_t$)**, **3D Space-Time Curvature ($\kappa_t$)**, **Signed Lévy Stochastic Area ($L_{z,t}$)**, and **Compression Coil Score ($C_{\text{coil}, t}$)**—in volatility-standardized coordinates.
* **The Core Questions Answered:**
  1. *"How fast is price traversing phase space ($v_t$), and how sharply is the trajectory bending ($\kappa_t$)?"*
  2. *"Is the trajectory winding into a tight pre-breakout spring ($C_{\text{coil}, t}$)?"*
  3. *"Which leg (`Cross-Gold` vs. `FX`) is leading the rotational cycle ($L_{z,t}$)?"*

#### Mathematical Formulation (`computePhaseGeometry3D`)
First, $(X_t, Y_t)$ is mapped into causal, dimensionless Z-score coordinates $(\tilde{x}_t, \tilde{y}_t)$ relative to the rolling spine:
$$\tilde{x}_t = \frac{X_t - \mu_{X,t}}{\sigma_{X,t}}, \qquad \tilde{y}_t = \frac{Y_t - \mu_{Y,t}}{\sigma_{Y,t}}, \qquad r_t = \sqrt{\tilde{x}_t^2 + \tilde{y}_t^2}$$

Using causal 3-bar EMA-smoothed first differences $(\dot{\tilde{x}}_t, \dot{\tilde{y}}_t)$ and second differences $(\ddot{\tilde{x}}_t, \ddot{\tilde{y}}_t)$ along the 3D space-time curve $\vec{\gamma}(t) = (\tilde{x}_t, \tilde{y}_t, t)$ where $\dot{z}_t = 1, \ddot{z}_t = 0$:

1. **Phase Velocity (Kinetic Speed in $\sigma/\text{bar}$):**
   $$v_t = \sqrt{\dot{\tilde{x}}_t^2 + \dot{\tilde{y}}_t^2}$$
2. **Regularized 3D Frenet-Serret Curvature ($\kappa_t$):**
   $$\kappa_t = \frac{\|\vec{\gamma}'(t) \times \vec{\gamma}''(t)\|}{\|\vec{\gamma}'(t)\|^3} = \frac{\sqrt{\ddot{\tilde{x}}_t^2 + \ddot{\tilde{y}}_t^2 + (\dot{\tilde{x}}_t\ddot{\tilde{y}}_t - \dot{\tilde{y}}_t\ddot{\tilde{x}}_t)^2}}{\left(\dot{\tilde{x}}_t^2 + \dot{\tilde{y}}_t^2 + 1\right)^{3/2}}$$
3. **Signed Lévy Stochastic Area / Orbital Angular Momentum ($L_{z,t}$):**
   $$L_{z,t} = \frac{1}{2} \sum_{k=t-W+1}^{t} \left(\tilde{x}_{k-1}\Delta\tilde{y}_k - \tilde{y}_{k-1}\Delta\tilde{x}_k\right)$$
4. **Compression Coil Score ($C_{\text{coil}, t} \in [0, 100]$):**
   $$C_{\text{coil}, t} = 100 \cdot \exp(-0.35\,\bar{r}_t) \cdot \exp(-0.45\,\bar{v}_t) \cdot \tanh\!\left(\frac{2.4\,\bar{\kappa}_t}{\bar{v}_t + 0.12}\right)$$

#### How to Interpret the States

| Metric | State / Threshold | Physical & Market Interpretation |
| :--- | :--- | :--- |
| **Signed Lévy Area ($L_{z,t}$)** | **$L_{z,t} > +0.5$** *(Emerald Bars / Spindle)* | **Counter-Clockwise (CCW) Spiral — Cross-Gold Leads FX.** For a harmonic orbit $\tilde{x}=\cos\omega t,\ \tilde{y}=\sin\omega t=\cos(\omega t - \pi/2)$, $\tilde{x}$ peaks $\pi/2$ ahead of $\tilde{y}$. Bullion flows are initiating the move; FX is following. |
| **Signed Lévy Area ($L_{z,t}$)** | **$L_{z,t} < -0.5$** *(Sky-Blue Bars / Spindle)* | **Clockwise (CW) Spiral — FX Leads Cross-Gold.** The currency leg (`EURUSD`, `USDJPY`) is initiating the move and Gold is reacting with a lag. |
| **Signed Lévy Area ($L_{z,t}$)** | **$|L_{z,t}| \approx 0$** | **Collinear / Non-Rotational Trajectory.** Both legs are moving in a straight 1D line without sweeping orbital area. |
| **Compression Coil Score** | **`45 – 100`** *(Cyan 3D Halos Appear)* | **Active 3D Spring Winding.** Trajectory is tightly bound near the MA spine ($r_t$ small, $v_t$ low) but turning rapidly ($\kappa_t / v_t$ high). Precedes major directional breakouts. |
| **Velocity ($v_t$) & Curvature ($\kappa_t$)** | **$v_t > 0.8\sigma/\text{b}$ & $\kappa_t < 0.15$** | **Ballistic Momentum.** Fast, straight-line trend expansion with minimal resistance. |
| **Velocity ($v_t$) & Curvature ($\kappa_t$)** | **High $v_t$ + Sudden $\kappa_t > 0.40$ Spike** | **Phase-Space Inflection / V-Reversal.** A fast move just bent sharply—indicating institutional absorption or stop-run exhaustion. |

---

### 2.6 Pillar #6A: Spatial 3D Cluster Attractor Basins (`cluster-attractors-3d`)

* **What It Achieves:** Partitions the visible 3D trajectory into $K \in \{2 \dots 5\}$ price-acceptance consolidation basins using deterministic quantile-seeded K-Means and renders bivariate Gaussian covariance rings around each basin center.
* **The Core Question Answered:**
  > *"Where are the joint 3D equilibrium 'gravity wells' where price has spent the most dwell time, and is the current bar inside an established basin or traveling through a low-density liquidity vacuum?"*
* **Mathematical Formulation (`computeSpatialAttractorBasins`):**
  For each cluster basin $c \in \{1 \dots K\}$ with centroid $(\mu_{X,c}, \mu_{Y,c}, \mu_{Z,c})$, marginal standard deviations $(\sigma_{X,c}, \sigma_{Y,c})$, and intra-basin correlation $\rho_c$, the Cholesky covariance contour at radius $r_\sigma$ is parameterized by:
  $$X_c(\theta) = \mu_{X,c} + r_\sigma \sigma_{X,c} \cos\theta, \qquad Y_c(\theta) = \mu_{Y,c} + r_\sigma \sigma_{Y,c}\!\left(\rho_c \cos\theta + \sqrt{1 - \rho_c^2}\sin\theta\right)$$
  And the active bar's normalized distance to its basin center is:
  $$D_{\text{basin}}(t) = \sqrt{\left(\frac{X_t - \mu_{X,c}}{\sigma_{X,c}}\right)^2 + \left(\frac{Y_t - \mu_{Y,c}}{\sigma_{Y,c}}\right)^2}$$
* **How to Interpret the States:**
  * **High Dwell Share Basin ($\text{Dwell} > 45\%$):** The dominant macro value area (Point of Control in 3D space). Acts as a strong magnet during range-bound sessions.
  * **$D_{\text{basin}} \le 1.5\sigma$ (`In Basin / Equilibrium`):** Price is inside a well-traded liquidity node; expect two-way order flow and mean reversion toward the basin centroid.
  * **$D_{\text{basin}} > 2.0\sigma$ (`LIQUIDITY VACUUM`):** Price has escaped the current attractor basin into unclustered space. Order book density is thin, and price typically accelerates rapidly toward the next basin or snaps violently back inside $1.5\sigma$.

---

### 2.7 Pillar #6B: Unsupervised 4-State Regime Clustering & Markov Matrix (`clusters` Sub-Pane)

* **What It Achieves:** Automatically synthesizes the 4D dynamical state vector $\vec{f}_t = [r_t,\ v_t,\ \kappa_t,\ |L_{z,t}|]$ into four canonical market regimes in $O(N)$ causal time and computes the empirical $4 \times 4$ Markov transition probability matrix $P_{ij}$.
* **The Core Question Answered:**
  > *"Which discrete dynamical regime is the market operating in right now, and what are the exact historical odds of transitioning to each regime on the next bar?"*
* **Mathematical Formulation (`computePhaseClusters` & `computeMarkovTransitionMatrix`):**
  Each feature is causally standardized over rolling window $P$ into $\vec{z}_t = (z_{r,t}, z_{v,t}, z_{\kappa,t}, z_{L,t})$ and matched against four adaptive centroids $\vec{C}_0, \vec{C}_1, \vec{C}_2, \vec{C}_3$ anchored to canonical regime prototypes $\vec{P}_k$ via Online Regularized Lloyd updates:
  $$\vec{C}_{k^*} \leftarrow (1 - \eta)\vec{C}_{k^*} + \eta\big((1 - \lambda)\vec{z}_t + \lambda \vec{P}_{k^*}\big)$$
  Transition probabilities are tallied causally with Laplace smoothing ($\alpha = 0.25$):
  $$P_{ij}(t) = \mathbb{P}(S_{s} = j \mid S_{s-1} = i) = \frac{0.25 + \sum_{s=1}^{t} \mathbb{I}(S_{s-1}=i \wedge S_s=j)}{1.0 + \sum_{s=1}^{t} \mathbb{I}(S_{s-1}=i)}$$

* **How to Interpret the 4 Regime States:**
  1. **`C0: Compression Coil` (`#38bdf8` Sky Blue):** Low radius $r_t$, low velocity $v_t$, high turning rate $\kappa_t$. The market is coiling tightly around the spine. *Action: Prepare for expansion; monitor $P(\text{C0} \to \text{C2})$.*
  2. **`C1: Equilibrium Orbit` (`#34d399` Emerald):** Moderate radius and velocity with strong rotational area $|L_{z,t}|$. Healthy mean-reverting spiral. *Action: Fade outer Bollinger ring touches toward the 3D MA center.*
  3. **`C2: Directional Breakout` (`#f59e0b` Amber):** High velocity $v_t$, expanding radius $r_t$, low curvature $\kappa_t$. Ballistic trend trajectory. *Action: Follow momentum; do not fade until regime shifts to `C3` or `C1`.*
  4. **`C3: Tail / Shock Regime` (`#f43f5e` Rose):** Extreme $>2\sigma$ excursion with simultaneous velocity and curvature spikes. *Action: Tightly trail stops or fade exhaustion once curvature hooks back toward the spine.*

---

### 2.8 Rolling Correlation (`correlation`) & Cross-Rate Basis (`basis`)

* **What They Achieve:**
  * `correlation` compares **Stationary Log-Return Correlation** $r(\Delta \ln X_t, \Delta \ln Y_t)$ against **Phase Level Correlation** $r(X_t, Y_t)$.
  * `basis` tracks $(\text{FX}_{\text{mkt}} - \text{FX}_{\text{implied}}) \times \text{pipMultiplier}$.
* **Critical Statistical Interpretation Notes:**
  * **Mechanical Division Bias in $r(\Delta \ln X, \Delta \ln Y)$:** Because $X = \text{XAUUSD}/Y$ for `CCY_USD` pairs, $\text{Cov}(\Delta \ln X, \Delta \ln Y) = \text{Cov}(\Delta \ln \text{XAUUSD}, \Delta \ln Y) - \text{Var}(\Delta \ln Y)$. Consequently, negative return correlation is expected during normal FX activity. When **both** $r(\Delta \ln X, \Delta \ln Y) > 0$ **and** $r(X, Y) > 0$ (for `CCY_USD`), Gold is surging so strongly in USD terms that it overwhelms the FX denominator—a powerful **Intrinsic Bullion Regime** signal.

---

## 3. High-Conviction Combined Playbook (Operational Quick Checklist)

Use the following five multi-indicator combinations to filter noise and isolate institutional-grade setups:

### Setup 1: The "Coiled Bullion Breakout" (High-Conviction Trend Entry)
* **Market Thesis:** A tightly wound 3D compression coil inside an established equilibrium basin suddenly unwinds into a genuine Gold-led breakout cutting across Iso-XAUUSD contours.
* **Pre-Conditions (Setup Build-Up):**
  * **Regime Cluster:** `C0: Compression Coil` (Sky Blue ribbon in `Clusters` tab) for $\ge 5$ bars.
  * **Compression Coil Score:** `> 45 / 100` (Cyan 3D coil rings visible on the spine).
  * **Basin Distance:** `< 1.2σ (In Basin / Equilibrium)` inside a high-dwell 3D Attractor Basin.
* **Execution Trigger:**
  1. **Regime Flip:** Active cluster transitions `C0: Coil → C2: Directional Breakout` (Amber).
  2. **Vacuum Escape:** `Basin Distance` crosses above `1.8σ–2.0σ` (exiting the consolidation basin).
  3. **Chirality Confirmation:** `Signed Lévy Area (Lz) > 0` (`CCW: Cross-Gold Leads`), confirming that bullion—not passive FX drift—is driving the expansion.
  4. **3D Geometry:** Floor shadow cuts **orthogonally across** the `Iso-XAUUSD` floor contours.
* **Invalidation / Exit:** Exit or trail stops when regime flips to `C3: Shock` with a `3D Curvature (κ) > 0.40` spike, or if `Basin Distance` falls back below `1.2σ`.

---

### Setup 2: The "Fake Dollar-Induced Gold Spike" (Breakout Filter / Fade)
* **Market Thesis:** `XAUUSD` prints a sudden green or red candle on a 2D chart, luring breakout traders, but 3D phase-space decomposition reveals it is $100\%$ passive USD FX translation with zero intrinsic bullion participation.
* **Diagnostic Signature:**
  1. **3D Floor Trajectory:** The active trajectory slides **parallel** to the `Iso-XAUUSD` hyperbolic contour rather than cutting across it.
  2. **Chirality Handedness:** `Signed Lévy Area (Lz) < -0.5` (`CW: FX Leads`), showing the move originated in `EURUSD`/`USDJPY` rather than Gold.
  3. **Basin Containment:** `Basin Distance` remains `< 1.5σ` (trapped inside the existing 3D attractor basin).
* **Action:** **Do not chase the `XAUUSD` breakout.** Once the FX impulse stalls at intraday resistance, `XAUUSD` typically mean-reverts back to the 3D MA spine.

---

### Setup 3: The "Exhaustion Blow-Off & Curvature Hook" (Mean-Reversion Entry)
* **Market Thesis:** After an extended directional run, price overshoots into a statistical tail regime (`C3: Shock`) inside a liquidity vacuum and violently bends back toward equilibrium.
* **Trigger Checklist:**
  1. **Regime Cluster:** `C3: Tail / Shock Regime` (Rose badge).
  2. **Phase Z-Score:** `> +2.2σ` (above the red dashed threshold in the `Z-Score` sub-pane and outside the `3D Bollinger Tube`).
  3. **Liquidity Vacuum:** `Basin Distance > 2.3σ`.
  4. **Frenet-Serret Hook Trigger:** `Phase Velocity (v)` peaks and begins ticking down on the exact bar that **`3D Curvature (κ)` spikes above `0.38`** (signaling that the 3D trajectory has bent into a sharp U-turn).
* **Target:** Mean reversion back toward the `Primary 3D MA Spine` (`Phase Z-Score → 0.0σ`) or the nearest 3D Attractor Basin edge (`1.0σ`).

---

### Setup 4: The "Liquidity Vacuum Transit" (Basin-to-Basin Acceleration)
* **Market Thesis:** When price breaks out of a dominant 3D Attractor Basin (`B1`) and enters the unclustered space between `B1` and `B2`, order book resistance drops sharply, allowing rapid traversal to the next basin center.
* **Trigger Checklist:**
  1. Toggle **`3D Cluster Attractor Basins`** ON (`K = 3`). Identify two separated basins where `B1` has `> 40%` dwell share.
  2. Price exits `B1` (`Basin Distance > 2.0σ LIQUIDITY VACUUM`) in `C2: Breakout` regime with `Phase Velocity > 0.75 σ/bar` and low curvature (`κ < 0.18`).
* **Target:** Ride the fast transit zone until the active head enters the $1.2\sigma$ ellipsoid ring of the destination basin (`B2`).

---

### Setup 5: Lead-Lag Orbital Rotation Trade (Chirality Handedness Signal)
* **Market Thesis:** In `C1: Equilibrium Orbit`, the market traces repeatable 3D elliptical loops around the MA spine. Knowing the loop handedness ($L_z$) reveals which leg turns first at the top and bottom of the orbit.
* **Trigger Checklist:**
  1. **Regime Cluster:** `C1: Equilibrium Orbit` (Emerald) with high Markov self-persistence (`P(→ Orbit) > 65%`).
  2. **Strong Negative Lévy Area (`Lz < -1.0`, CW Orbit — FX Leads):** Watch the FX leg (`EURUSD` or `USDJPY`) for a local turn at the $\pm 2\sigma$ Bollinger rail. Because FX leads Gold in a CW orbit, an FX inflection point gives a **1–4 bar leading entry signal** for the subsequent Cross-Gold / `XAUUSD` turn.
  3. **Strong Positive Lévy Area (`Lz > +1.0`, CCW Orbit — Cross-Gold Leads):** Cross-Gold turns first; use `XAUEUR`/`XAUJPY` inflection at the Bollinger rail as the leading signal.

---

## 4. System Architecture & Performance Engineering

* **100% Static Client-Side Execution (Zero Server CPU):** Built with Next.js (`output: "export"` in `next.config.mjs`), deployed as static assets on Firebase Hosting CDN. All quantitative engines run in the browser using pre-allocated `Float64Array` and `Uint8Array` typed buffers.
* **Single-Pass $O(N)$ Causal Algorithms:**
  * `computeVectorMA`, `computePhaseGeometry3D`, and `computePhaseClusters` execute in a single forward pass over $N$ bars using sliding-window running sums (`sum`, `sumSq`).
  * **Zero Replay Scrubbing Overhead:** Because all series are strictly causal, `SynchronizedSubPane2D.tsx` and `InspectorSidebar.tsx` memoize the full arrays on `[dataSeries, maPeriod, maType]` and slice `.subarray(startIdx, effectiveEnd)` in $O(1)$ time during 60 FPS timelapse replay.

---

## 5. Future Quantitative Research Roadmap

The following four analytical modules are specified for subsequent platform releases:

1. **Pillar #1 — Orthogonal Driver Decomposition (Intrinsic Gold Impulse vs. Pure FX Flow):**
   Decompose log-return vectors into tangential FX-only slides $F_{\parallel, t} = (r_X - r_Y)/\sqrt{2}$ and normal intrinsic Gold impulses $F_{\perp, t} = (r_X + r_Y)/\sqrt{2}$, paired with rolling causal OLS beta attribution ($\Delta \ln \text{XAUUSD}_t = \alpha_t + \beta_t \Delta \ln \text{FX}_t + \epsilon_t$) to plot real-time **Gold Alpha ($\epsilon_t$) vs. FX Beta Share ($R^2$)**.
2. **Pillar #3 — Covariance-Aware Mahalanobis Distance ($D_M$) & Rotated PCA Eigen-Tubes:**
   Upgrade isotropic Euclidean displacement with the full rolling $2 \times 2$ covariance matrix $\Sigma_t^{-1}$:
   $$D_M(t) = \sqrt{(\vec{x}_t - \vec{\mu}_t)^T \Sigma_t^{-1} (\vec{x}_t - \vec{\mu}_t)}$$
   and rotate 3D Bollinger tube rings along the principal eigenvectors of $\Sigma_t$ while tracking the **Eigenvalue Anisotropy Ratio** $\eta_t = \lambda_1 / (\lambda_1 + \lambda_2)$.
3. **Pillar #4 — Unbiased Primary Correlation $r(\Delta \ln \text{XAUUSD}, \Delta \ln \text{FX})$ & Lead-Lag Profile $\rho(\tau)$:**
   Eliminate synthetic division bias by correlating the un-coupled primary legs directly across lags $\tau \in [-10, +10]$ bars to identify the exact lead-lag horizon $\tau^* = \arg\max_\tau |\rho_t(\tau)|$.
4. **Pillar #5 — Multi-Currency G10 Gold Dispersion ("Global Gold vs. USD Factor"):**
   Aggregate Gold log-returns across all 6 G10 currencies (`EUR`, `JPY`, `GBP`, `CHF`, `AUD`, `CAD`) to compute the **Global Gold Factor** $\bar{r}_{\text{XAU}, t}$ against **Cross-Currency Dispersion** $\sigma_{\text{disp}, t}$.
