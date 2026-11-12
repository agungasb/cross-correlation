from abc import ABC, abstractmethod
from typing import List, Optional

try:
    from mt5_bridge.schema import AccountStatus, OrderResult, Position, Quote, TradeIntent
except ImportError:
    from schema import AccountStatus, OrderResult, Position, Quote, TradeIntent

class BaseMT5Driver(ABC):
    @abstractmethod
    def initialize(self) -> bool:
        """Initializes connection to the MT5 terminal / broker."""
        pass

    @abstractmethod
    def shutdown(self) -> None:
        """Closes the terminal connection cleanly."""
        pass

    @abstractmethod
    def get_account_status(self) -> AccountStatus:
        """Returns account equity, balance, and margin metrics."""
        pass

    @abstractmethod
    def get_quote(self, symbol: str) -> Quote:
        """Returns live bid, ask, and spread for the normalized symbol."""
        pass

    @abstractmethod
    def place_order(self, intent: TradeIntent) -> OrderResult:
        """Executes a market BUY or SELL order with SL/TP."""
        pass

    @abstractmethod
    def modify_position(self, ticket: int, sl: Optional[float], tp: Optional[float]) -> OrderResult:
        """Modifies Stop Loss or Take Profit of an active position."""
        pass

    @abstractmethod
    def close_position(self, ticket: int) -> OrderResult:
        """Closes an active position by ticket."""
        pass

    @abstractmethod
    def get_open_positions(self, symbol: Optional[str] = None) -> List[Position]:
        """Returns all currently open positions."""
        pass

    @abstractmethod
    def normalize_symbol(self, symbol: str) -> str:
        """Maps canonical symbol (e.g. XAUUSD) to broker-specific symbol."""
        pass
