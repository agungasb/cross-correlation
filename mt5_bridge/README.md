# MT5 Execution Bridge & Gateway Core

High-performance, fault-tolerant execution gateway connecting the **Phase-Space Market Analyzer** web application to a live **MetaTrader 5 (MT5)** broker account.

---

## 1. Architecture & Design Principles

* **Dual-Mode Execution (Live vs. Mock):**
  * `live`: Uses the official Windows C++ `MetaTrader5` library with direct IPC to the MT5 terminal.
  * `mock`: Deterministic in-memory simulation driver for macOS/Linux local development and CI testing with zero external dependencies.
* **Deterministic Idempotency Protection:**
  * Network retries and disconnections cannot duplicate orders. Every incoming `TradeIntent` requires a unique `idempotency_key` (e.g. `s1_xauusd_1731412800000_buy`). Replaying the same key returns the existing order result.
* **Broker Quirks & Dynamic Normalization:**
  * **Filling Modes:** Dynamically interrogates broker symbol capabilities (`SYMBOL_FILLING_FOK`, `SYMBOL_FILLING_IOC`, or `ORDER_FILLING_RETURN`) to prevent rejection error `10030`.
  * **Digits & Stops Levels:** Rounds all prices and Stop Loss / Take Profit distances to exact broker digits, enforcing `trade_stops_level` to eliminate error `10016`.
  * **Spread Protection:** Pre-execution check rejects orders if instantaneous spread exceeds `max_spread_points`.
  * **Emergency Kill-Switch:** Single call to `/close` with `close_all: true` flattens all open positions.

---

## 2. Directory Structure

```
mt5_bridge/
├── config.py              # Environment configuration & symbol normalization
├── schema.py              # Strongly-typed dataclasses for intents, quotes & positions
├── engine.py              # Execution engine, idempotency cache & circuit breakers
├── server.py              # Lightweight HTTP server (zero-dependency standard library)
├── requirements.txt       # Dependencies for production Windows VPS
├── .env.example           # Configuration template
├── drivers/
│   ├── base.py            # Abstract Base Driver interface
│   ├── live.py            # Production Windows MT5 driver (handles requotes, filling modes, digits)
│   └── mock.py            # In-memory mock driver for macOS development & testing
└── test_bridge.py         # Automated unit test suite (order execution, idempotency, kill-switch)
```

---

## 3. Quickstart & Local Development (macOS / Linux)

The bridge runs immediately using Python 3 standard library with **zero pip installs**:

```bash
# Run unit test suite (validates order flow, idempotency & kill-switch)
python3 -m unittest mt5_bridge/test_bridge.py

# Launch the HTTP server (defaults to Mock mode on non-Windows)
python3 -m mt5_bridge.server
```

Server starts at: `http://localhost:8000`

---

## 4. Production Deployment on Windows VPS (Live MT5)

### Step 1: Install MetaTrader 5 Terminal
1. Install MetaTrader 5 on your Windows VPS (e.g. from IC Markets, Pepperstone, etc.).
2. Log in to your trading account (ensure **"Save password"** is checked).
3. Open **Tools -> Options -> Expert Advisors**:
   * Enable: **"Allow algorithmic trading"**.

### Step 2: Configure Environment
1. In `mt5_bridge/`, copy `.env.example` to `.env`:
```ini
MT5_MODE=live
MT5_LOGIN=12345678
MT5_PASSWORD=your_demo_password
MT5_SERVER=ICMarketsSC-Demo
MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe

MT5_MAGIC_NUMBER=883921
MT5_DEFAULT_SLIPPAGE_POINTS=30
MT5_MAX_SPREAD_POINTS=50
MT5_BRIDGE_AUTH_TOKEN=your_strong_secret_token_here
MT5_SYMBOL_MAP={"XAUUSD": "XAUUSD"}
```

### Step 3: Install Dependencies & Run
```powershell
pip install -r mt5_bridge/requirements.txt
python -m mt5_bridge.server
```

---

## 5. REST API Specification

### Authentication
All protected endpoints require the HTTP header:
`Authorization: Bearer <MT5_BRIDGE_AUTH_TOKEN>`

### Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server status, connection health, and MT5 login state (public) |
| `GET` | `/account` | Current account balance, equity, and free margin |
| `GET` | `/quote/{symbol}` | Instantaneous bid, ask, and spread for a symbol (e.g. `XAUUSD`) |
| `GET` | `/positions` | List open positions (filter by `?symbol=XAUUSD`) |
| `POST` | `/trade` | Dispatch a `TradeIntent` with idempotency protection |
| `POST` | `/modify` | Update Stop-Loss or Take-Profit of an active position |
| `POST` | `/close` | Close by ticket, close by symbol, or trigger Kill-Switch |

#### Example: Dispatch Trade Intent (`POST /trade`)
```json
{
  "idempotency_key": "s1_xauusd_1731412800000_buy",
  "symbol": "XAUUSD",
  "action": "BUY",
  "volume": 0.05,
  "setup_id": 1,
  "stop_loss_points": 45.0,
  "take_profit_points": 90.0,
  "slippage_points": 30,
  "comment": "S1:CoilBreakout"
}
```

#### Example: Emergency Kill-Switch (`POST /close`)
```json
{
  "close_all": true
}
```
