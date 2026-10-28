# Real-Time 3D Phase Space & Quantitative Market Analyzer: XAUEUR vs. EURUSD vs. Time

An interactive, quantitative 3D & 2D financial market analyzer platform built with **Next.js (App Router + TypeScript)**, **WebGL (Plotly 3D + High-DPI 2D Canvas)**, and **Firebase (App Hosting, Auth & Cloud Firestore)**. It analyzes triangular cross-rates between Spot Gold (USD), Gold (EUR), and EUR/USD exchange rates across multiple timeframes, with a **pluggable indicator engine**, synchronized 2D quantitative sub-panes, dynamic axis stretching, and 60 FPS timelapse replay.

## Core Research Objective & Phase-Space Philosophy

> **Note on Purpose:** This platform is **not** designed to hunt for triangular arbitrage execution opportunities. Its primary objective is **geometric and structural pattern discovery for `XAUUSD` (Spot Gold)**.

By projecting `XAUUSD` movement through a cross-correlated currency proxy (e.g., `EURUSD`, `USDJPY`, `GBPUSD`, `USDCHF`, `AUDUSD`, `USDCAD`) and its synthetic cross-gold pair (`XAUEUR`, `XAUJPY`, etc.) into a 3D coordinate manifold $(X = \text{Cross Gold},\ Y = \text{FX Proxy},\ Z = \text{Time})$, the platform reveals the **3D shape and morphology of `XAUUSD` price movement**:
* **Decomposing Drivers:** Distinguishing whether an `XAUUSD` move is a passive reflection of broad USD currency flow (movement sliding along a constant `Iso-XAUUSD` hyperbolic contour) or genuine intrinsic Gold accumulation/distribution (movement cutting orthogonally across `Iso-XAUUSD` contours).
* **3D Pattern & Regime Recognition:** Identifying recurring 3D phase-space structures—such as compression coils, orbital spirals around the 3D Moving Average spine, and volatility tube breakouts—that precede major directional expansions in `XAUUSD` but remain invisible on a standard 2D `XAUUSD` candlestick chart.
* **Synthetic Cross-Gold Derivation (`XAUUSD` + `EURUSD` $\rightarrow$ `XAUEUR`):** Because public feeds like Yahoo Finance do not provide reliable intraday tickers for direct cross-gold pairs (`XAUEUR`), the engine fetches `XAUUSD` (or `GC=F`) alongside the FX proxy (`EURUSD`, `USDJPY`, etc.) and derives the cross-gold coordinate synthetically ($\text{XAUEUR} = \text{XAUUSD} / \text{EURUSD}$). Since global OTC cross-gold liquidity is itself synthetically priced from primary `XAUUSD` and G10 FX books, this orthogonal factor decomposition accurately preserves the 3D phase-space geometry required for pattern discovery.

---

## 1. Supported Timeframes

The dashboard supports multi-timeframe analysis, capturing both high-frequency microstructural noise and long-term macroeconomic regime shifts:

| Timeframe | Source Range | Interval | Typical Overlapping Bars | Analytical Focus |
| :--- | :--- | :--- | :--- | :--- |
| **1m** | 1 Day | 1 Minute | ~1,000 bars | Intraday microstructure, execution latency, noise |
| **5m** | 5 Days | 5 Minutes | ~1,000 bars | Multi-session dynamics, London/NY session overlaps |
| **15m** | 1 Month | 15 Minutes | ~2,000 bars | Swing momentum, weekly support/resistance orbits |
| **1h** | 3 Months | 1 Hour | ~1,500 bars | Medium-term trend loops, quarterly rebalancing |
| **1D** | 1 Year | Daily (Aligned) | ~225 days | Macroeconomic regime shifts, currency devaluations |

---

## 2. Pluggable 3D Indicator Engine & Synchronized 2D Sub-Pane

In a 3D phase-space coordinate system, a moving average is a **multivariate central spine trajectory (equilibrium attractor)**:

$$\vec{M}(t) = \big( \text{MA}_{\text{XAUEUR}}(t; p),\ \text{MA}_{\text{EURUSD}}(t; p),\ t \big)$$

### Built-In Indicator Plugins (`src/lib/quant/plugins.ts`)
* **Primary 3D Moving Average Spine (`vector-ma`):** Configurable period (`2..500`, quick presets `9, 20, 50, 100, 200`), **SMA** or **EMA**, plus floor shadow projection.
* **Secondary Slow 3D Moving Average (`slow-ma`):** Secondary slower 3D spine (e.g., 50-period) to visualize 3D golden/death crosses and multivariate regime shifts.
* **3D Volatility Bollinger Tube (`bollinger-3d`):** Plots 3D phase-space standard deviation dispersion rails ($\pm k\sigma_X, \pm k\sigma_Y$) and elliptical cross-section rings around the equilibrium spine.
* **3D Compression Coils & Chirality (`phase-geometry-3d`):** Highlights high-curvature 3D compression coil nodes along the trajectory and renders a live Chirality Spindle colored by Signed Lévy Area ($L_{z,t}$).
* **3D Cluster Attractor Basins (`cluster-attractors-3d`):** Partitions the 3D trajectory into $K$ equilibrium consolidation basins using deterministic quantile-seeded K-Means, plotting covariance-tilted ellipsoid rings, centroids, and dwell share `%`.
* **Iso-XAUUSD Floor Contours (`iso-contours`):** Hyperbolic constant-Gold curves ($\text{EURUSD} = \text{XAUUSD} / \text{XAUEUR}$) on the $Z=0$ floor plane.
* **Floor Shadow & Drop Line (`floor-shadow`):** Orthogonal 2D phase projection on $Z=0$ and active bar drop line.

### Quantitative Metrics & Synchronized 2D Sub-Panes (`src/lib/quant/math.ts`)
* **Phase Displacement & Causal Z-Score:** Quantifies instantaneous percentage distance from moving equilibrium and its rolling causal Z-Score ($\pm 2\sigma$ bands):
  $$\text{Displacement} = \sqrt{\left(\frac{X - \text{MA}_X}{\text{MA}_X}\right)^2 + \left(\frac{Y - \text{MA}_Y}{\text{MA}_Y}\right)^2} \times 100\%$$
* **3D Differential Geometry & Spiral Chirality (`computePhaseGeometry3D`):**
  * **Phase Velocity ($v_t$) & Regularized 3D Space-Time Curvature ($\kappa_t$):** Computed in causally standardized coordinates $(\tilde{x}_t, \tilde{y}_t)$ along the space-time curve $\vec{\gamma}(t) = (\tilde{x}_t, \tilde{y}_t, t)$ with $\dot{z}_t = 1$:
    $$\kappa_t = \frac{\sqrt{\ddot{\tilde{x}}_t^2 + \ddot{\tilde{y}}_t^2 + (\dot{\tilde{x}}_t\ddot{\tilde{y}}_t - \dot{\tilde{y}}_t\ddot{\tilde{x}}_t)^2}}{\left(\dot{\tilde{x}}_t^2 + \dot{\tilde{y}}_t^2 + 1\right)^{3/2}}$$
  * **Signed Lévy Stochastic Area ($L_{z,t} = \frac{1}{2}\sum (\tilde{x}_{k-1}\Delta\tilde{y}_k - \tilde{y}_{k-1}\Delta\tilde{x}_k)$):** Measures spiral handedness around the 3D MA spine ($L_{z,t} > 0$ Counter-Clockwise = Cross-Gold leads FX; $L_{z,t} < 0$ Clockwise = FX leads Cross-Gold).
  * **Compression Coil Score ($0\text{–}100$):** Detects low-velocity, high-turning-intensity spring winding prior to directional expansion.
* **Unsupervised Phase-Space Cluster Analysis & Markov Transitions (`computePhaseClusters` & `computeSpatialAttractorBasins`):**
  * **Mode A (Spatial 3D Attractor Basins):** Deterministic quantile-seeded K-Means ($K=2..5$) identifying 3D equilibrium consolidation basins, Cholesky covariance tilt, dwell share `%`, and Liquidity Vacuum excursions ($> 2.0\sigma$).
  * **Mode B (Causal 4-State Regime Clustering):** Single-pass $O(N)$ Online Prototype-Anchored K-Means classifying every bar into `[0] Compression Coil`, `[1] Equilibrium Orbit`, `[2] Directional Breakout`, or `[3] Tail / Shock Regime`, paired with a causal $4 \times 4$ **Markov Transition Matrix** $P_{ij} = \mathbb{P}(S_{t+1} = j \mid S_t = i)$.
* **Stationary Log-Return Correlation vs. Level Correlation:** Computes both $r(\Delta \ln X_t, \Delta \ln Y_t)$ (stationary first differences) and $r(X_t, Y_t)$ (phase level correlation).
* **Triad Arbitrage Basis (Pips):** Tracks $(\text{EURUSD}_{\text{mkt}} - \text{EURUSD}_{\text{implied}}) \times 10000$.

---

## 3. Mathematical Cross-Rate Formulation

### The Question:
> *"XAUEUR devide by XAUUSD is EURUSD right?"*

### The Answer:
**No, it is the exact inverse: USDEUR (\( \frac{1}{\text{EURUSD}} \)).**

$$\frac{\text{XAUEUR}}{\text{XAUUSD}} = \frac{\frac{\text{EUR}}{\text{XAU}}}{\frac{\text{USD}}{\text{XAU}}} = \frac{\text{EUR}}{\text{USD}} = \mathbf{\text{USDEUR}} = \frac{\mathbf{1}}{\mathbf{\text{EURUSD}}}$$

$$\frac{\text{XAUUSD}}{\text{XAUEUR}} = \frac{\frac{\text{USD}}{\text{XAU}}}{\frac{\text{EUR}}{\text{XAU}}} = \frac{\text{USD}}{\text{EUR}} = \mathbf{\text{EURUSD}}$$

---

## 4. Timelapse Replay & Axis Stretching

* **Timelapse Replay:** Scrub through history with custom speeds (`1x`, `2x`, `5x`, `10x`, `25x`, `60x`), frame-by-frame step controls, loop toggle, and `Accumulate` / `Sliding Window` modes, or click/drag directly on the synchronized 2D sub-pane to scrub 3D time.
* **Axis Stretch:** Independent real-time sliders for Stretch X (€), Stretch Y ($), and Stretch Z (Time) to spread out overlapping spirals into open ribbons.
* **Shortcuts:**
  * `Space`: Play / Pause replay.
  * `M`: Toggle 3D Moving Average ON / OFF.
  * `Left / Right Arrow`: Step backward / forward 1 bar (hold `Shift` for 10 bars).
  * `L`: Toggle replay loop.
  * `] / [`: Stretch / compress Time axis (Z).
  * `+ / -`: Stretch / compress Price axes (X & Y).

---

## 5. Quickstart, Testing & Firebase Deployment

### Local Development (Next.js)
```bash
npm install
npm run dev
```
Open your browser to:
```
http://localhost:8080
```

### Run Quantitative Unit Tests
```bash
npm test
```

### Firebase Configuration & Deployment
1. Copy `.env.example` to `.env.local` and fill in your `NEXT_PUBLIC_FIREBASE_*` keys (or paste your Firebase JSON config directly into the **Workspaces / Cloud Sync** modal in the UI).
2. Deploy to Firebase Hosting / App Hosting:
```bash
firebase deploy
```
*(Legacy Python server is archived in `legacy/server.py` and `legacy/index.html`.)*

---

## 6. Future Quantitative Research Roadmap

The following quantitative analytical modules are specified for upcoming phases of the platform:

### 6.1 Orthogonal Driver Decomposition (Intrinsic Gold Impulse vs. Pure FX Flow)
* **Research Question:** *"Is `XAUUSD` moving because institutions are accumulating/distributing physical bullion, or is Gold passively repricing due to broad USD currency flow?"*
* **Mathematical Formulation:**
  * Project log-return vectors $(r_X, r_Y) = (\Delta \ln X_t, \Delta \ln Y_t)$ onto the **Iso-XAUUSD Tangent** $\hat{u}_{\parallel}$ (pure FX translation where $\Delta \ln \text{XAUUSD} = 0$) and **Iso-XAUUSD Normal** $\hat{u}_{\perp}$ (intrinsic Gold revaluation across both USD and cross currency simultaneously):
    $$F_{\parallel, t} = \frac{r_X - r_Y}{\sqrt{2}}, \qquad F_{\perp, t} = \frac{r_X + r_Y}{\sqrt{2}}$$
  * Pair with a rolling causal OLS regression $\Delta \ln \text{XAUUSD}_t = \alpha_t + \beta_t \Delta \ln \text{FX}_t + \epsilon_t$ to decompose Gold variance into **FX-Explained Share ($R^2$)** vs. **Idiosyncratic Gold Alpha ($\epsilon_t$, share $1 - R^2$)**.

### 6.2 Covariance-Aware Mahalanobis Distance ($D_M$) & Rotated PCA Eigen-Tubes
* **Research Question:** *"Given unequal leg volatilities ($\sigma_X \neq \sigma_Y$) and strong cross-correlation ($\rho_{XY}$), is the current 3D deviation a true statistical extreme or normal movement along the correlated channel?"*
* **Mathematical Formulation:**
  * Replace isotropic Euclidean displacement with the rolling $2 \times 2$ covariance-weighted **Mahalanobis Distance**:
    $$D_M(t) = \sqrt{(\vec{x}_t - \vec{\mu}_t)^T \Sigma_t^{-1} (\vec{x}_t - \vec{\mu}_t)}$$
  * Rotate the 3D Bollinger rings along the eigenvectors of $\Sigma_t$ and track the **PCA Eigenvalue Anisotropy Ratio** $\eta_t = \frac{\lambda_1}{\lambda_1 + \lambda_2} \in [0.5, 1.0]$ to measure 1D directional compression ($\eta_t \to 1$) vs. 2D orbital dispersion ($\eta_t \to 0.5$).

### 6.3 Unbiased Primary Correlation $r(\Delta \ln \text{XAUUSD}, \Delta \ln \text{FX})$ & Lead-Lag Profile $\rho(\tau)$
* **Research Question:** *"What is the true coupling between Spot Gold and the FX pair without synthetic division bias, and does FX lead or lag Gold by $1\text{–}10$ bars?"*
* **Mathematical Formulation:**
  * Because $X = \text{XAUUSD}/Y$ introduces a mechanical $-\text{Var}(\Delta \ln Y)$ bias into $\text{Cov}(\Delta \ln X, \Delta \ln Y)$, compute stationary correlation directly on the un-coupled primary legs $r(\Delta \ln \text{XAUUSD}_t, \Delta \ln \text{FX}_t)$.
  * Compute the rolling **Cross-Correlation Function (CCF)** across lags $\tau \in [-10, +10]$:
    $$\rho_t(\tau) = \text{Corr}\big(\Delta \ln \text{XAUUSD}_s,\ \Delta \ln \text{FX}_{s - \tau}\big)$$
    identifying the peak lead-lag horizon $\tau^* = \arg\max_{\tau} |\rho_t(\tau)|$.

### 6.4 Multi-Currency G10 Gold Dispersion ("Global Gold vs. USD Factor")
* **Research Question:** *"Is Gold breaking out globally across all G10 currencies (`EUR`, `JPY`, `GBP`, `CHF`, `AUD`, `CAD`), or is the move a single-currency distortion?"*
* **Mathematical Formulation:**
  * Compute the **Global Gold Factor** $\bar{r}_{\text{XAU}, t} = \frac{1}{N} \sum_{i=1}^N r_{\text{XAU}, i, t}$ across all G10 cross-gold pairs alongside **Cross-Currency Dispersion** $\sigma_{\text{disp}, t} = \sqrt{\frac{1}{N} \sum_{i=1}^N (r_{\text{XAU}, i, t} - \bar{r}_{\text{XAU}, t})^2}$ and the **Breadth / Consensus Ratio** $|\bar{r}_{\text{XAU}, t}| / (\sigma_{\text{disp}, t} + \epsilon)$.

