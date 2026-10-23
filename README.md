# Real-Time 3D Phase Space: XAUEUR vs. EURUSD vs. Time

An interactive, quantitative 3D financial visualization system analyzing triangular cross-rates between Spot Gold (USD), Gold (EUR), and EUR/USD exchange rates across multiple timeframes, with dynamic axis stretching, high-performance timelapse replay, and multivariate 3D Moving Average indicators.

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

## 2. 3D Moving Average Indicator

In a 3D phase-space coordinate system, a moving average is a **multivariate central spine trajectory (equilibrium attractor)**:

$$\vec{M}(t) = \big( \text{MA}_{\text{XAUEUR}}(t; p),\ \text{MA}_{\text{EURUSD}}(t; p),\ t \big)$$

### Features
* **Custom Period Input:** Set any period (e.g., 9, 20, 50, 100, 200).
* **Algorithm Choice:** Toggle between **SMA** (Simple Moving Average) and **EMA** (Exponential Moving Average).
* **Dual MA System:** Toggle an optional secondary Slow MA (e.g. 50-period) to visualize 3D golden/death crosses and multivariate regime shifts.
* **Phase Displacement Metric:** Quantifies instantaneous percentage distance from moving equilibrium:
  $$\text{Displacement} = \sqrt{\left(\frac{X - \text{MA}_X}{\text{MA}_X}\right)^2 + \left(\frac{Y - \text{MA}_Y}{\text{MA}_Y}\right)^2} \times 100\%$$
* **Floor Shadow Projection:** Plots the smoothed MA trajectory directly on the floor plane alongside raw data.

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

* **Timelapse Replay:** Scrub through history with custom speeds (`1x`, `2x`, `5x`, `10x`, `25x`, `60x`), frame-by-frame step controls, loop toggle, and growing/sliding window modes.
* **Axis Stretch:** Independent real-time sliders for Stretch X (€), Stretch Y ($), and Stretch Z (Time) to spread out overlapping spirals into open ribbons.
* **Shortcuts:**
  * `Space`: Play / Pause replay.
  * `M`: Toggle 3D Moving Average ON / OFF.
  * `Left / Right Arrow`: Step backward / forward 1 bar (hold `Shift` for 10 bars).
  * `L`: Toggle replay loop.
  * `] / [`: Stretch / compress Time axis (Z).
  * `+ / -`: Stretch / compress Price axes (X & Y).

---

## 5. Quickstart & Running

```bash
python3 server.py
```
Open your browser to:
```
http://localhost:8080
```
