# Production MT5 Gateway: 1-Week Live Demo Burn-In Protocol

Before allocating real capital to the automated pipeline, you must complete a **1-week (5 consecutive trading days) burn-in trial** on an active MetaTrader 5 demo account under real OTC market conditions.

---

## 1. Primary Objectives & Acceptance Criteria

| Metric | Target / Acceptance Threshold | Failure Mode / Remediation |
| :--- | :--- | :--- |
| **Network & Execution Latency** | $< 15\text{ms}$ (VPS $\leftrightarrow$ MT5 Broker) | If $> 50\text{ms}$, move VPS to broker's datacenter (Equinix LD4 London / NY4 New York). |
| **Slippage Distribution** | Average slippage $\le 5\text{ points}$ on Gold | If slippage $> 25\text{ points}$, tighten `slippage_points` limit in workstation. |
| **Requote Rate (Error 10004)** | $< 1.0\%$ of dispatched orders | If frequent, broker execution mode is Instant rather than Market. Verify `ORDER_FILLING_IOC`. |
| **Basis Drift ($\Delta$/oz)** | $|P_{\text{broker}} - P_{\text{webapp}}| \le \$3.00$ | Ensure `sl_tp_mode: RELATIVE_POINTS` is active so stop distance is never distorted. |
| **Dead-Man Switch Response** | Triggers in $\le 65\text{s}$ upon disconnection | Test intentionally closing laptop to verify open trades move to break-even. |
| **Zero Orphaned Positions** | $0$ untracked or desynchronized trades | All open tickets in MT5 must match records in workstation. |

---

## 2. 5-Day Burn-In Schedule

### Day 1: Connectivity, Latency & Order Type Validation
* **Actions:**
  1. Deploy bridge on VPS using `deploy_windows.ps1`.
  2. Verify MT5 Terminal connection ping (bottom-right status in MT5: target $< 5\text{ms}$).
  3. Execute 3 manual test trades using the workstation in **`MANUAL`** mode.
* **Checks:**
  - Verify filling mode negotiated cleanly (no `10030` errors).
  - Verify Stop Loss and Take Profit levels match intended points.
  - Test individual position close button in workstation UI.

### Day 2: Session Overlap & High-Volatility Spread Test
* **Focus:** London / New York overlap session (13:00 – 17:00 UTC).
* **Actions:**
  - Switch workstation to **`AUTONOMOUS`** mode with `minConfidence: 65%`.
  - Monitor spread behavior during high-volatility breakouts.
* **Checks:**
  - Confirm orders execute without requotes.
  - Verify spread circuit breaker blocks orders if spread spikes $> 50\text{ points}$.

### Day 3: Dead-Man Switch Simulation (Deliberate Disconnect)
* **Actions:**
  1. Open a test position on `XAUUSD`.
  2. Intentionally terminate the web application or disconnect the laptop Wi-Fi for 90 seconds.
* **Verification:**
  - Inspect `mt5_bridge/gateway_stdout.log` on the VPS.
  - Verify the watchdog logs: `[DEAD-MAN SWITCH TRIPPED]`.
  - Verify the position's Stop Loss was moved to break-even ($P_{\text{open}}$).
  - Reconnect webapp; verify watchdog state resets to `tripped: false`.

### Day 4: Rollover & Overnight Swap Observation
* **Focus:** Daily market rollover (21:00 – 23:00 UTC).
* **Actions:**
  - Hold a minimum 0.01 lot position across the daily market rollover.
* **Checks:**
  - Record broker spread expansion during rollover (often widens $3\times$ to $5\times$).
  - Measure financing/swap charge debited to demo account.

### Day 5: Kill-Switch & Full Reconciliation Audit
* **Actions:**
  1. Open concurrent positions across `XAUUSD` and an FX pair (e.g. `EURUSD`).
  2. Press the red **KILL-SWITCH (Close All)** button in the workstation modal.
* **Verification:**
  - Confirm both positions close simultaneously within 1 second.
  - Verify account balance and historical trade statement match exactly between MT5 and webapp logs.

---

## 3. Go-Live Readiness Sign-Off Checklist

Before switching `.env` credentials to a real money account:
- [ ] 5 consecutive trading days completed with zero unhandled crashes.
- [ ] NSSM Windows Service restarts automatically upon VPS reboot.
- [ ] Dead-Man Switch confirmed functional under deliberate disconnect.
- [ ] Broker slippage and execution latency documented within target limits.
- [ ] Max daily loss limit and emergency kill-switch verified.
