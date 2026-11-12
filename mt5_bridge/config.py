import json
import os
import sys
from dataclasses import dataclass, field, asdict
from typing import Dict, Optional

@dataclass
class BridgeConfig:
    # Mode: "live" or "mock" (auto-detected if non-Windows)
    mode: str = "live"
    login: int = 0
    password: str = ""
    server: str = ""
    path: Optional[str] = None

    magic_number: int = 883921
    default_slippage_points: int = 30
    max_spread_points: int = 50
    max_basis_points: int = 1500

    # Milestone 4: Dead-Man Switch Watchdog
    watchdog_enabled: bool = True
    heartbeat_timeout_sec: float = 60.0
    watchdog_action: str = "PROTECT_BREAKEVEN"  # "PROTECT_BREAKEVEN" | "CLOSE_ALL" | "LOG_ONLY"
    telegram_webhook_url: Optional[str] = None

    host: str = "0.0.0.0"
    port: int = 8000
    auth_token: str = "dev_secret_token"
    symbol_map: Dict[str, str] = field(default_factory=lambda: {"XAUUSD": "XAUUSD", "EURUSD": "EURUSD"})

    def to_dict(self) -> dict:
        return asdict(self)

def load_config() -> BridgeConfig:
    # Auto-fallback to mock if not on Windows and mode is not explicitly forced
    detected_mode = os.getenv("MT5_MODE")
    if not detected_mode:
        detected_mode = "live" if sys.platform == "win32" else "mock"

    symbol_map_str = os.getenv("MT5_SYMBOL_MAP", '{"XAUUSD": "XAUUSD", "EURUSD": "EURUSD"}')
    try:
        symbol_map = json.loads(symbol_map_str)
    except Exception:
        symbol_map = {"XAUUSD": "XAUUSD", "EURUSD": "EURUSD"}

    return BridgeConfig(
        mode=detected_mode.lower(),
        login=int(os.getenv("MT5_LOGIN", "0")),
        password=os.getenv("MT5_PASSWORD", ""),
        server=os.getenv("MT5_SERVER", ""),
        path=os.getenv("MT5_PATH") or None,
        magic_number=int(os.getenv("MT5_MAGIC_NUMBER", "883921")),
        default_slippage_points=int(os.getenv("MT5_DEFAULT_SLIPPAGE_POINTS", "30")),
        max_spread_points=int(os.getenv("MT5_MAX_SPREAD_POINTS", "50")),
        max_basis_points=int(os.getenv("MT5_MAX_BASIS_POINTS", "1500")),
        watchdog_enabled=os.getenv("MT5_WATCHDOG_ENABLED", "true").lower() in ("true", "1", "yes"),
        heartbeat_timeout_sec=float(os.getenv("MT5_HEARTBEAT_TIMEOUT_SEC", "60.0")),
        watchdog_action=os.getenv("MT5_WATCHDOG_ACTION", "PROTECT_BREAKEVEN").upper(),
        telegram_webhook_url=os.getenv("MT5_TELEGRAM_WEBHOOK_URL") or None,
        host=os.getenv("MT5_BRIDGE_HOST", "0.0.0.0"),
        port=int(os.getenv("MT5_BRIDGE_PORT", "8000")),
        auth_token=os.getenv("MT5_BRIDGE_AUTH_TOKEN", "dev_secret_token"),
        symbol_map=symbol_map,
    )
