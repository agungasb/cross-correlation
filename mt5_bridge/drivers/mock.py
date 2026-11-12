import time
from typing import Dict, List, Optional

try:
    from mt5_bridge.config import BridgeConfig
    from mt5_bridge.schema import AccountStatus, OrderResult, Position, Quote, TradeIntent
    from mt5_bridge.drivers.base import BaseMT5Driver
except ImportError:
    from config import BridgeConfig
    from schema import AccountStatus, OrderResult, Position, Quote, TradeIntent
    from drivers.base import BaseMT5Driver

class MockMT5Driver(BaseMT5Driver):
    """
    In-memory simulation driver for local development on macOS/Linux.
    Maintains virtual positions, accounts, and tick synthesis.
    """
    def __init__(self, config: BridgeConfig):
        self.config = config
        self._connected = True
        self._next_ticket = 100001
        self._positions: Dict[int, Position] = {}
        self._quotes: Dict[str, Quote] = {
            "XAUUSD": Quote(
                symbol="XAUUSD",
                bid=2650.25,
                ask=2650.55,
                spread_points=30.0,
                digits=2,
                point=0.01,
                timestamp_ms=int(time.time() * 1000),
            ),
            "EURUSD": Quote(
                symbol="EURUSD",
                bid=1.08500,
                ask=1.08512,
                spread_points=12.0,
                digits=5,
                point=0.00001,
                timestamp_ms=int(time.time() * 1000),
            ),
        }
        self._balance = 50000.0
        self._leverage = 500

    def normalize_symbol(self, symbol: str) -> str:
        clean = symbol.strip().upper()
        return self.config.symbol_map.get(clean, clean)

    def initialize(self) -> bool:
        self._connected = True
        return True

    def shutdown(self) -> None:
        self._connected = False

    def get_account_status(self) -> AccountStatus:
        margin_used = sum(p.volume * 1000.0 for p in self._positions.values())
        unrealized_pnl = sum(p.profit for p in self._positions.values())
        equity = self._balance + unrealized_pnl
        margin_free = equity - margin_used
        margin_level = (equity / margin_used * 100) if margin_used > 0 else 0.0

        return AccountStatus(
            connected=self._connected,
            login=self.config.login or 999999,
            server="MOCK-SIMULATOR",
            currency="USD",
            balance=self._balance,
            equity=equity,
            margin=margin_used,
            margin_free=margin_free,
            margin_level=margin_level,
            leverage=self._leverage,
        )

    def get_quote(self, symbol: str) -> Quote:
        norm = self.normalize_symbol(symbol)
        quote = self._quotes.get(norm)
        if not quote:
            quote = Quote(
                symbol=norm,
                bid=100.00,
                ask=100.05,
                spread_points=5.0,
                digits=2,
                point=0.01,
                timestamp_ms=int(time.time() * 1000),
            )
            self._quotes[norm] = quote
        return quote

    def place_order(self, intent: TradeIntent) -> OrderResult:
        norm = self.normalize_symbol(intent.symbol)
        quote = self.get_quote(norm)
        price = quote.ask if intent.action == "BUY" else quote.bid
        now_ms = int(time.time() * 1000)

        # Basis Drift Circuit Breaker
        max_basis = intent.max_basis_points or self.config.max_basis_points
        if max_basis > 0 and intent.signal_price is not None and intent.signal_price > 0:
            basis_pts = abs(price - intent.signal_price) / quote.point if quote.point > 0 else 0
            if basis_pts > max_basis:
                return OrderResult(
                    success=False,
                    symbol=norm,
                    volume=intent.volume,
                    price=price,
                    retcode=10015,
                    retcode_description=(
                        f"BASIS_DRIFT_REJECT: Broker price ({price}) diverges from signal price "
                        f"({intent.signal_price}) by {basis_pts:.0f} pts (> {max_basis:.0f} limit)"
                    ),
                    comment="BASIS_REJECT",
                    timestamp_ms=now_ms,
                )

        use_relative = (intent.sl_tp_mode == "RELATIVE_POINTS") or (
            intent.stop_loss_points is not None and intent.stop_loss_price is None
        )

        sl = 0.0
        if use_relative and intent.stop_loss_points is not None and intent.stop_loss_points > 0:
            delta = intent.stop_loss_points * quote.point
            sl = price - delta if intent.action == "BUY" else price + delta
        elif intent.stop_loss_price is not None:
            sl = intent.stop_loss_price

        tp = 0.0
        if use_relative and intent.take_profit_points is not None and intent.take_profit_points > 0:
            delta = intent.take_profit_points * quote.point
            tp = price + delta if intent.action == "BUY" else price - delta
        elif intent.take_profit_price is not None:
            tp = intent.take_profit_price

        ticket = self._next_ticket
        self._next_ticket += 1

        comment = intent.comment or f"S{intent.setup_id or 0}:{intent.idempotency_key[:8]}"

        pos = Position(
            ticket=ticket,
            symbol=norm,
            direction=intent.action,
            volume=intent.volume,
            price_open=round(price, quote.digits),
            price_current=round(price, quote.digits),
            sl=round(sl, quote.digits),
            tp=round(tp, quote.digits),
            profit=0.0,
            swap=0.0,
            magic=self.config.magic_number,
            comment=comment,
            time_setup_ms=now_ms,
        )
        self._positions[ticket] = pos

        return OrderResult(
            success=True,
            ticket=ticket,
            deal_id=ticket + 500000,
            order_id=ticket,
            symbol=norm,
            volume=intent.volume,
            price=round(price, quote.digits),
            retcode=10009,
            retcode_description="DONE: Order filled in Mock Engine",
            comment=comment,
            timestamp_ms=now_ms,
        )

    def modify_position(self, ticket: int, sl: Optional[float], tp: Optional[float]) -> OrderResult:
        pos = self._positions.get(ticket)
        if not pos:
            raise ValueError(f"Position ticket {ticket} not found in Mock Engine.")

        quote = self.get_quote(pos.symbol)
        if sl is not None:
            pos.sl = round(sl, quote.digits)
        if tp is not None:
            pos.tp = round(tp, quote.digits)

        return OrderResult(
            success=True,
            ticket=ticket,
            symbol=pos.symbol,
            volume=pos.volume,
            price=pos.price_current,
            retcode=10009,
            retcode_description="DONE: Position modified",
            comment="MODIFY",
            timestamp_ms=int(time.time() * 1000),
        )

    def close_position(self, ticket: int) -> OrderResult:
        pos = self._positions.pop(ticket, None)
        if not pos:
            raise ValueError(f"Position ticket {ticket} not found in Mock Engine.")

        quote = self.get_quote(pos.symbol)
        close_price = quote.bid if pos.direction == "BUY" else quote.ask
        now_ms = int(time.time() * 1000)

        pnl = (close_price - pos.price_open) * pos.volume * 100.0 if pos.direction == "BUY" else (pos.price_open - close_price) * pos.volume * 100.0
        self._balance += pnl

        return OrderResult(
            success=True,
            ticket=ticket,
            deal_id=ticket + 600000,
            symbol=pos.symbol,
            volume=pos.volume,
            price=round(close_price, quote.digits),
            retcode=10009,
            retcode_description="DONE: Position closed in Mock Engine",
            comment="CLOSED",
            timestamp_ms=now_ms,
        )

    def get_open_positions(self, symbol: Optional[str] = None) -> List[Position]:
        if symbol:
            norm = self.normalize_symbol(symbol)
            return [p for p in self._positions.values() if p.symbol == norm]
        return list(self._positions.values())
