# Real-Time 3D Phase Space & Quantitative Market Analyzer: XAUEUR vs. EURUSD vs. Time

An interactive, quantitative 3D & 2D financial market analyzer platform built with **Next.js (App Router + TypeScript)**, **WebGL (Plotly 3D + High-DPI 2D Canvas)**, and **Firebase (App Hosting, Auth & Cloud Firestore)**. It analyzes triangular cross-rates between Spot Gold (USD), Gold (EUR), and EUR/USD exchange rates across multiple timeframes, with a **pluggable indicator engine**, synchronized 2D quantitative sub-panes, dynamic axis stretching, and 60 FPS timelapse replay.

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
* **Iso-XAUUSD Floor Contours (`iso-contours`):** Hyperbolic constant-Gold curves ($\text{EURUSD} = \text{XAUUSD} / \text{XAUEUR}$) on the $Z=0$ floor plane.
* **Floor Shadow & Drop Line (`floor-shadow`):** Orthogonal 2D phase projection on $Z=0$ and active bar drop line.

### Quantitative Metrics & Synchronized 2D Sub-Panes (`src/lib/quant/math.ts`)
* **Phase Displacement & Causal Z-Score:** Quantifies instantaneous percentage distance from moving equilibrium and its rolling causal Z-Score ($\pm 2\sigma$ bands):
  $$\text{Displacement} = \sqrt{\left(\frac{X - \text{MA}_X}{\text{MA}_X}\right)^2 + \left(\frac{Y - \text{MA}_Y}{\text{MA}_Y}\right)^2} \times 100\%$$
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
