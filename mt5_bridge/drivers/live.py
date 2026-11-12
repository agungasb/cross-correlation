import time
import math
from typing import List, Optional

try:
    from mt5_bridge.config import BridgeConfig
    from mt5_bridge.schema import AccountStatus, OrderResult, Position, Quote, TradeIntent
    from mt5_bridge.drivers.base import BaseMT5Driver
except ImportError:
    from config import BridgeConfig
    from schema import AccountStatus, OrderResult, Position, Quote, TradeIntent
    from drivers.base import BaseMT5Driver

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    mt5 = None

# Comprehensive MT5 Error Descriptions
MT5_RETCODES = {
    10004: "REQUOTE: Price moved beyond allowable slippage",
    10006: "REJECT: Broker rejected request",
    10007: "CANCEL: Request canceled by trader",
    10008: "PLACED: Order placed successfully",
    10009: "DONE: Request executed successfully",
    10010: "DONE_PARTIAL: Request executed partially",
    10011: "ERROR: Request processing error",
    10012: "TIMEOUT: Request canceled by timeout",
    10013: "INVALID: Invalid order request",
    10014: "INVALID_VOLUME: Invalid volume (out of bounds or bad step)",
    10015: "INVALID_PRICE: Invalid price digits or off-market",
    10016: "INVALID_STOPS: Invalid stops (too close to market / below stop-level)",
    10017: "TRADE_DISABLED: Trade is disabled for this account/symbol",
    10018: "MARKET_CLOSED: Market is currently closed",
    10019: "NO_MONEY: Not enough free margin to open order",
    10020: "PRICE_CHANGED: Prices changed during processing",
    10021: "PRICE_OFF: Off-quote prices",
    10022: "INVALID_EXPIRATION: Invalid expiration date",
    10023: "ORDER_CHANGED: Order state changed during processing",
    10024: "TOO_MANY_REQUESTS: Too frequent trade requests (throttled)",
    10027: "AUTO_TRADING_DISABLED: Automated trading is disabled in terminal settings",
    10028: "CLIENT_DISABLES_AT: Automated trading disabled by client terminal",
    10029: "LOCKED: Request locked for processing",
    10030: "FROZEN: Order or position is frozen",
    10031: "INVALID_FILL: Invalid order filling type",
}

class LiveMT5Driver(BaseMT5Driver):
    def __init__(self, config: BridgeConfig):
        self.config = config
        self._connected = False

    def _ensure_mt5(self):
        if not MT5_AVAILABLE:
            raise RuntimeError(
                "MetaTrader5 Python module is not installed or not supported on this OS. "
                "The Live driver requires Windows and the 'MetaTrader5' pip package."
            )

    def normalize_symbol(self, symbol: str) -> str:
        clean = symbol.strip().upper()
        return self.config.symbol_map.get(clean, clean)

    def initialize(self) -> bool:
        self._ensure_mt5()
        kwargs = {}
        if self.config.path:
            kwargs["path"] = self.config.path
        if self.config.login and self.config.password and self.config.server:
            kwargs["login"] = self.config.login
            kwargs["password"] = self.config.password
            kwargs["server"] = self.config.server

        if not mt5.initialize(**kwargs):
            err = mt5.last_error()
            self._connected = False
            raise ConnectionError(f"MT5 Initialization failed: {err}")

        account = mt5.account_info()
        if account is None:
            err = mt5.last_error()
            self._connected = False
            raise ConnectionError(f"MT5 terminal initialized but could not fetch account: {err}")

        self._connected = True
        return True

    def shutdown(self) -> None:
        if MT5_AVAILABLE and self._connected:
            mt5.shutdown()
            self._connected = False

    def get_account_status(self) -> AccountStatus:
        self._ensure_mt5()
        account = mt5.account_info()
        if account is None:
            raise RuntimeError(f"Failed to fetch account info: {mt5.last_error()}")

        return AccountStatus(
            connected=True,
            login=account.login,
            server=account.server,
            currency=account.currency,
            balance=float(account.balance),
            equity=float(account.equity),
            margin=float(account.margin),
            margin_free=float(account.margin_free),
            margin_level=float(account.margin_level) if account.margin_level else 0.0,
            leverage=int(account.leverage),
        )

    def _get_symbol_info(self, symbol: str):
        self._ensure_mt5()
        broker_symbol = self.normalize_symbol(symbol)
        info = mt5.symbol_info(broker_symbol)
        if info is None:
            raise ValueError(f"Symbol '{broker_symbol}' not found on broker terminal.")

        if not info.visible:
            if not mt5.symbol_select(broker_symbol, True):
                raise ValueError(f"Failed to enable symbol '{broker_symbol}' in Market Watch.")

        return broker_symbol, info

    def get_quote(self, symbol: str) -> Quote:
        broker_symbol, info = self._get_symbol_info(symbol)
        tick = mt5.symbol_info_tick(broker_symbol)
        if tick is None:
            raise RuntimeError(f"Failed to fetch tick for '{broker_symbol}': {mt5.last_error()}")

        spread_points = (tick.ask - tick.bid) / info.point if info.point > 0 else 0.0
        return Quote(
            symbol=broker_symbol,
            bid=float(tick.bid),
            ask=float(tick.ask),
            spread_points=round(spread_points, 1),
            digits=int(info.digits),
            point=float(info.point),
            timestamp_ms=int(tick.time_msc) if hasattr(tick, "time_msc") else int(tick.time * 1000),
        )

    def _select_filling_mode(self, info) -> int:
        modes = info.filling_mode
        if modes & 1:
            return mt5.ORDER_FILLING_FOK
        elif modes & 2:
            return mt5.ORDER_FILLING_IOC
        else:
            return mt5.ORDER_FILLING_RETURN

    def _normalize_volume(self, volume: float, info) -> float:
        step = info.volume_step
        min_v = info.volume_min
        max_v = info.volume_max
        if step > 0:
            vol = round(round(volume / step) * step, 8)
        else:
            vol = volume
        return max(min_v, min(max_v, vol))

    def place_order(self, intent: TradeIntent) -> OrderResult:
        self._ensure_mt5()
        broker_symbol, info = self._get_symbol_info(intent.symbol)

        tick = mt5.symbol_info_tick(broker_symbol)
        if tick is None:
            raise RuntimeError(f"Cannot place order: No live tick for '{broker_symbol}'")

        point = info.point
        spread_pts = (tick.ask - tick.bid) / point if point > 0 else 0
        if self.config.max_spread_points > 0 and spread_pts > self.config.max_spread_points:
            return OrderResult(
                success=False,
                symbol=broker_symbol,
                volume=intent.volume,
                price=0.0,
                retcode=10016,
                retcode_description=f"Spread {spread_pts:.1f} pts exceeds limit of {self.config.max_spread_points} pts",
                comment=f"SPREAD_REJECT",
                timestamp_ms=int(time.time() * 1000),
            )

        order_type = mt5.ORDER_TYPE_BUY if intent.action == "BUY" else mt5.ORDER_TYPE_SELL
        base_price = tick.ask if intent.action == "BUY" else tick.bid
        digits = info.digits
        price = round(base_price, digits)

        # Basis Drift Circuit Breaker: reject if broker price diverges excessively from strategy price
        max_basis = intent.max_basis_points or self.config.max_basis_points
        if max_basis > 0 and intent.signal_price is not None and intent.signal_price > 0:
            basis_pts = abs(price - intent.signal_price) / point if point > 0 else 0
            if basis_pts > max_basis:
                return OrderResult(
                    success=False,
                    symbol=broker_symbol,
                    volume=intent.volume,
                    price=price,
                    retcode=10015,
                    retcode_description=(
                        f"BASIS_DRIFT_REJECT: Broker price ({price}) diverges from signal price "
                        f"({intent.signal_price}) by {basis_pts:.0f} pts (> {max_basis:.0f} limit)"
                    ),
                    comment="BASIS_REJECT",
                    timestamp_ms=int(time.time() * 1000),
                )

        # Dynamic Stop Loss & Take Profit: Anchor to instantaneous broker fill price
        use_relative = (intent.sl_tp_mode == "RELATIVE_POINTS") or (
            intent.stop_loss_points is not None and intent.stop_loss_price is None
        )

        sl = 0.0
        if use_relative and intent.stop_loss_points is not None and intent.stop_loss_points > 0:
            delta = intent.stop_loss_points * point
            if digits == 3 and round(point, 4) == 0.001:
                delta = intent.stop_loss_points * 0.01
            sl = round(price - delta if intent.action == "BUY" else price + delta, digits)
        elif intent.stop_loss_price is not None:
            sl = round(intent.stop_loss_price, digits)

        tp = 0.0
        if use_relative and intent.take_profit_points is not None and intent.take_profit_points > 0:
            delta = intent.take_profit_points * point
            if digits == 3 and round(point, 4) == 0.001:
                delta = intent.take_profit_points * 0.01
            tp = round(price + delta if intent.action == "BUY" else price - delta, digits)
        elif intent.take_profit_price is not None:
            tp = round(intent.take_profit_price, digits)

        min_stop_distance = info.trade_stops_level * point
        if min_stop_distance > 0:
            if sl > 0 and abs(price - sl) < min_stop_distance:
                sl = round(price - min_stop_distance if intent.action == "BUY" else price + min_stop_distance, digits)
            if tp > 0 and abs(price - tp) < min_stop_distance:
                tp = round(price + min_stop_distance if intent.action == "BUY" else price - min_stop_distance, digits)

        volume = self._normalize_volume(intent.volume, info)
        filling = self._select_filling_mode(info)
        slippage = intent.slippage_points or self.config.default_slippage_points

        comment = intent.comment or f"S{intent.setup_id or 0}:{intent.idempotency_key[:8]}"

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": broker_symbol,
            "volume": volume,
            "type": order_type,
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": slippage,
            "magic": self.config.magic_number,
            "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }

        result = mt5.order_send(request)
        now_ms = int(time.time() * 1000)

        if result is None:
            err_code, err_desc = mt5.last_error()
            return OrderResult(
                success=False,
                symbol=broker_symbol,
                volume=volume,
                price=price,
                retcode=err_code,
                retcode_description=f"Send failed: {err_desc}",
                comment=comment,
                timestamp_ms=now_ms,
            )

        is_done = result.retcode in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED)
        desc = MT5_RETCODES.get(result.retcode, result.comment or f"RetCode {result.retcode}")

        return OrderResult(
            success=is_done,
            ticket=result.order if result.order > 0 else (result.deal or None),
            deal_id=result.deal or None,
            order_id=result.order or None,
            symbol=broker_symbol,
            volume=result.volume or volume,
            price=result.price or price,
            retcode=result.retcode,
            retcode_description=desc,
            comment=result.comment or comment,
            timestamp_ms=now_ms,
        )

    def modify_position(self, ticket: int, sl: Optional[float], tp: Optional[float]) -> OrderResult:
        self._ensure_mt5()
        pos = mt5.positions_get(ticket=ticket)
        if not pos or len(pos) == 0:
            raise ValueError(f"Position ticket {ticket} not found.")

        p = pos[0]
        broker_symbol, info = self._get_symbol_info(p.symbol)
        digits = info.digits

        new_sl = round(sl, digits) if sl is not None else p.sl
        new_tp = round(tp, digits) if tp is not None else p.tp

        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "position": ticket,
            "symbol": p.symbol,
            "sl": new_sl,
            "tp": new_tp,
        }

        result = mt5.order_send(request)
        now_ms = int(time.time() * 1000)
        if result is None:
            err_code, err_desc = mt5.last_error()
            return OrderResult(
                success=False,
                ticket=ticket,
                symbol=p.symbol,
                volume=p.volume,
                price=p.price_open,
                retcode=err_code,
                retcode_description=f"Modify failed: {err_desc}",
                comment="MODIFY_FAIL",
                timestamp_ms=now_ms,
            )

        is_done = result.retcode in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED)
        desc = MT5_RETCODES.get(result.retcode, result.comment or f"RetCode {result.retcode}")

        return OrderResult(
            success=is_done,
            ticket=ticket,
            symbol=p.symbol,
            volume=p.volume,
            price=p.price_current,
            retcode=result.retcode,
            retcode_description=desc,
            comment=result.comment or "MODIFY",
            timestamp_ms=now_ms,
        )

    def close_position(self, ticket: int) -> OrderResult:
        self._ensure_mt5()
        pos = mt5.positions_get(ticket=ticket)
        if not pos or len(pos) == 0:
            raise ValueError(f"Position ticket {ticket} not found.")

        p = pos[0]
        broker_symbol, info = self._get_symbol_info(p.symbol)
        tick = mt5.symbol_info_tick(broker_symbol)
        if tick is None:
            raise RuntimeError(f"Cannot close position: No live tick for '{broker_symbol}'")

        is_buy = p.type == mt5.ORDER_TYPE_BUY
        order_type = mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY
        price = round(tick.bid if is_buy else tick.ask, info.digits)
        filling = self._select_filling_mode(info)

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": ticket,
            "symbol": broker_symbol,
            "volume": p.volume,
            "type": order_type,
            "price": price,
            "deviation": self.config.default_slippage_points,
            "magic": self.config.magic_number,
            "comment": f"CLOSE:{ticket}",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }

        result = mt5.order_send(request)
        now_ms = int(time.time() * 1000)
        if result is None:
            err_code, err_desc = mt5.last_error()
            return OrderResult(
                success=False,
                ticket=ticket,
                symbol=broker_symbol,
                volume=p.volume,
                price=price,
                retcode=err_code,
                retcode_description=f"Close failed: {err_desc}",
                comment="CLOSE_FAIL",
                timestamp_ms=now_ms,
            )

        is_done = result.retcode in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED)
        desc = MT5_RETCODES.get(result.retcode, result.comment or f"RetCode {result.retcode}")

        return OrderResult(
            success=is_done,
            ticket=ticket,
            deal_id=result.deal or None,
            order_id=result.order or None,
            symbol=broker_symbol,
            volume=p.volume,
            price=price,
            retcode=result.retcode,
            retcode_description=desc,
            comment="CLOSED",
            timestamp_ms=now_ms,
        )

    def get_open_positions(self, symbol: Optional[str] = None) -> List[Position]:
        self._ensure_mt5()
        if symbol:
            broker_symbol = self.normalize_symbol(symbol)
            raw = mt5.positions_get(symbol=broker_symbol)
        else:
            raw = mt5.positions_get()

        if raw is None:
            return []

        positions: List[Position] = []
        for p in raw:
            direction = "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL"
            positions.append(
                Position(
                    ticket=int(p.ticket),
                    symbol=str(p.symbol),
                    direction=direction,
                    volume=float(p.volume),
                    price_open=float(p.price_open),
                    price_current=float(p.price_current),
                    sl=float(p.sl),
                    tp=float(p.tp),
                    profit=float(p.profit),
                    swap=float(p.swap),
                    magic=int(p.magic),
                    comment=str(p.comment),
                    time_setup_ms=int(p.time_msc) if hasattr(p, "time_msc") else int(p.time * 1000),
                )
            )
        return positions
