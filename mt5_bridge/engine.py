import time
import logging
import os
import sys
from typing import Dict, List, Optional

try:
    from mt5_bridge.config import BridgeConfig
    from mt5_bridge.drivers import create_driver, BaseMT5Driver
    from mt5_bridge.schema import AccountStatus, OrderResult, Position, Quote, TradeIntent, WatchdogStatus
    from mt5_bridge.watchdog import WatchdogService
except ImportError:
    from config import BridgeConfig
    from drivers import create_driver, BaseMT5Driver
    from schema import AccountStatus, OrderResult, Position, Quote, TradeIntent, WatchdogStatus
    from watchdog import WatchdogService

logger = logging.getLogger("mt5_bridge.engine")

class IdempotencyRecord:
    def __init__(self, result: OrderResult, timestamp: float):
        self.result = result
        self.timestamp = timestamp

class BridgeEngine:
    def __init__(self, config: BridgeConfig):
        self.config = config
        self.driver: BaseMT5Driver = create_driver(config)
        self.watchdog = WatchdogService(config, self)
        self._idempotency_cache: Dict[str, IdempotencyRecord] = {}
        self._cache_ttl_sec = 3600  # 1 hour TTL
        self._last_trade_time: float = 0.0

    def start(self) -> bool:
        logger.info(f"Starting MT5 Bridge Engine in mode: {self.config.mode}")
        ok = self.driver.initialize()
        if ok:
            self.watchdog.start()
        return ok

    def stop(self) -> None:
        logger.info("Stopping MT5 Bridge Engine...")
        self.watchdog.stop()
        self.driver.shutdown()

    def record_heartbeat(self, client_id: str, active_mode: str = "OFF"):
        self.watchdog.record_heartbeat(client_id, active_mode)

    def get_watchdog_status(self) -> WatchdogStatus:
        return self.watchdog.get_status()

    def _purge_old_idempotency_keys(self) -> None:
        now = time.time()
        expired = [k for k, v in self._idempotency_cache.items() if now - v.timestamp > self._cache_ttl_sec]
        for k in expired:
            del self._idempotency_cache[k]

    def get_status(self) -> AccountStatus:
        return self.driver.get_account_status()

    def get_quote(self, symbol: str) -> Quote:
        return self.driver.get_quote(symbol)

    def get_positions(self, symbol: Optional[str] = None) -> List[Position]:
        return self.driver.get_open_positions(symbol)

    def execute_intent(self, intent: TradeIntent) -> OrderResult:
        self._purge_old_idempotency_keys()

        # 1. Idempotency Check: prevent duplicate execution on network retry
        if intent.idempotency_key in self._idempotency_cache:
            record = self._idempotency_cache[intent.idempotency_key]
            logger.warning(
                f"[IDEMPOTENCY] Replay of key '{intent.idempotency_key}' detected. "
                f"Returning cached order result (ticket: {record.result.ticket})."
            )
            return record.result

        # 2. Execute via Driver
        logger.info(f"Executing trade intent: {intent.action} {intent.volume} lots of {intent.symbol}")
        result = self.driver.place_order(intent)

        # 3. Cache successful or definitive executions
        if result.success:
            self._idempotency_cache[intent.idempotency_key] = IdempotencyRecord(result, time.time())
            self._last_trade_time = time.time()

        return result

    def modify_position(self, ticket: int, sl: Optional[float], tp: Optional[float]) -> OrderResult:
        return self.driver.modify_position(ticket, sl, tp)

    def close_position(self, ticket: int) -> OrderResult:
        return self.driver.close_position(ticket)

    def close_all_positions(self, symbol: Optional[str] = None) -> List[OrderResult]:
        """Emergency Kill-Switch: closes all active positions."""
        positions = self.driver.get_open_positions(symbol)
        results: List[OrderResult] = []
        for p in positions:
            try:
                res = self.driver.close_position(p.ticket)
                results.append(res)
            except Exception as e:
                logger.error(f"Failed to close position {p.ticket}: {e}")
                results.append(
                    OrderResult(
                        success=False,
                        ticket=p.ticket,
                        symbol=p.symbol,
                        volume=p.volume,
                        price=p.price_current,
                        retcode=99999,
                        retcode_description=f"Exception: {str(e)}",
                        comment="KILL_SWITCH_FAIL",
                        timestamp_ms=int(time.time() * 1000),
                    )
                )
        return results
