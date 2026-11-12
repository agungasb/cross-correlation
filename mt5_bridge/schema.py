from dataclasses import dataclass, asdict
from typing import Optional, List, Literal, Any, Dict

TradeAction = Literal["BUY", "SELL", "CLOSE", "MODIFY"]

@dataclass
class TradeIntent:
    idempotency_key: str
    symbol: str
    action: Literal["BUY", "SELL"]
    volume: float
    setup_id: Optional[int] = None
    signal_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    take_profit_price: Optional[float] = None
    stop_loss_points: Optional[float] = None
    take_profit_points: Optional[float] = None
    max_basis_points: Optional[float] = None
    sl_tp_mode: Optional[Literal["RELATIVE_POINTS", "ABSOLUTE_PRICE"]] = "RELATIVE_POINTS"
    slippage_points: Optional[int] = None
    comment: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TradeIntent":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

@dataclass
class ClosePositionRequest:
    ticket: Optional[int] = None
    symbol: Optional[str] = None
    close_all: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ClosePositionRequest":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

@dataclass
class ModifyPositionRequest:
    ticket: int
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ModifyPositionRequest":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

@dataclass
class OrderResult:
    success: bool
    symbol: str
    volume: float
    price: float
    retcode: int
    retcode_description: str
    comment: str
    timestamp_ms: int
    ticket: Optional[int] = None
    deal_id: Optional[int] = None
    order_id: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class Position:
    ticket: int
    symbol: str
    direction: Literal["BUY", "SELL"]
    volume: float
    price_open: float
    price_current: float
    sl: float
    tp: float
    profit: float
    swap: float
    magic: int
    comment: str
    time_setup_ms: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class AccountStatus:
    connected: bool
    login: int
    server: str
    currency: str
    balance: float
    equity: float
    margin: float
    margin_free: float
    margin_level: float
    leverage: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class Quote:
    symbol: str
    bid: float
    ask: float
    spread_points: float
    digits: int
    point: float
    timestamp_ms: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class HeartbeatRequest:
    client_id: str
    timestamp_ms: int
    active_mode: str = "OFF"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HeartbeatRequest":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

@dataclass
class WatchdogStatus:
    enabled: bool
    timeout_sec: float
    action: str
    last_heartbeat_ms: int
    seconds_since_heartbeat: float
    tripped: bool
    protected_positions_count: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
