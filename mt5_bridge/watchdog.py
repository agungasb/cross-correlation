import logging
import threading
import time
from typing import Optional, List

try:
    from mt5_bridge.config import BridgeConfig
    from mt5_bridge.schema import Position, WatchdogStatus
except ImportError:
    from config import BridgeConfig
    from schema import Position, WatchdogStatus

logger = logging.getLogger("mt5_bridge.watchdog")

class WatchdogService:
    """
    Milestone 4: Dead-Man Switch Daemon.
    Monitors periodic heartbeats from the web application. If heartbeats stop
    while trades are active, the watchdog automatically executes protective risk rules.
    """

    def __init__(self, config: BridgeConfig, engine):
        self.config = config
        self.engine = engine
        self._last_heartbeat = time.time()
        self._last_client_id = "initial"
        self._last_active_mode = "OFF"
        self._tripped = False
        self._protected_count = 0
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        if not self.config.watchdog_enabled:
            logger.info("Dead-Man Watchdog is disabled in configuration.")
            return

        self._running = True
        self._last_heartbeat = time.time()
        self._tripped = False
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True, name="MT5WatchdogThread")
        self._thread.start()
        logger.info(
            f"Dead-Man Watchdog started. Timeout: {self.config.heartbeat_timeout_sec}s | "
            f"Action: {self.config.watchdog_action}"
        )

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        logger.info("Dead-Man Watchdog stopped.")

    def record_heartbeat(self, client_id: str, active_mode: str = "OFF"):
        self._last_heartbeat = time.time()
        self._last_client_id = client_id
        self._last_active_mode = active_mode
        if self._tripped:
            logger.info(f"Watchdog recovered: Fresh heartbeat received from '{client_id}'. Resetting tripped state.")
            self._tripped = False

    def get_status(self) -> WatchdogStatus:
        now = time.time()
        elapsed = now - self._last_heartbeat
        return WatchdogStatus(
            enabled=self.config.watchdog_enabled,
            timeout_sec=self.config.heartbeat_timeout_sec,
            action=self.config.watchdog_action,
            last_heartbeat_ms=int(self._last_heartbeat * 1000),
            seconds_since_heartbeat=round(elapsed, 1),
            tripped=self._tripped,
            protected_positions_count=self._protected_count,
        )

    def _monitor_loop(self):
        check_interval = min(0.5, max(0.05, self.config.heartbeat_timeout_sec / 2))
        while self._running:
            time.sleep(check_interval)
            if not self._running:
                break

            elapsed = time.time() - self._last_heartbeat

            if elapsed > self.config.heartbeat_timeout_sec and not self._tripped:
                # Trigger fail-safe only if trading was active
                self._execute_failsafe(elapsed)

    def _execute_failsafe(self, elapsed: float):
        logger.critical(
            f"[DEAD-MAN SWITCH TRIPPED] No heartbeat received for {elapsed:.1f}s "
            f"(threshold: {self.config.heartbeat_timeout_sec}s). Executing action: {self.config.watchdog_action}!"
        )
        self._tripped = True

        try:
            positions: List[Position] = self.engine.get_positions()
            if not positions:
                logger.info("Watchdog: No open positions to protect.")
                return

            if self.config.watchdog_action == "CLOSE_ALL":
                logger.warning(f"Watchdog: Emergency flattening {len(positions)} active positions...")
                results = self.engine.close_all_positions()
                self._protected_count += len([r for r in results if r.success])

            elif self.config.watchdog_action == "PROTECT_BREAKEVEN":
                logger.warning(f"Watchdog: Protecting {len(positions)} positions by moving SL to break-even...")
                protected = 0
                for p in positions:
                    try:
                        # If position is in profit, lock in break-even
                        if p.profit > 0 and p.price_open > 0:
                            self.engine.modify_position(p.ticket, sl=p.price_open, tp=p.tp)
                            protected += 1
                            logger.info(f"Watchdog: Position {p.ticket} SL moved to break-even (${p.price_open}).")
                        elif p.sl == 0:
                            # Position has no stop loss! Protect with emergency 1.5% SL
                            emergency_delta = p.price_open * 0.015
                            emergency_sl = p.price_open - emergency_delta if p.direction == "BUY" else p.price_open + emergency_delta
                            self.engine.modify_position(p.ticket, sl=round(emergency_sl, 2), tp=p.tp)
                            protected += 1
                            logger.warning(f"Watchdog: Position {p.ticket} had no SL! Set emergency SL at ${emergency_sl:.2f}.")
                    except Exception as e:
                        logger.error(f"Watchdog failed to modify position {p.ticket}: {e}")
                self._protected_count += protected

            else:
                logger.info(f"Watchdog action is {self.config.watchdog_action}. Monitored {len(positions)} positions.")

        except Exception as e:
            logger.critical(f"Watchdog execution exception: {e}", exc_info=True)
