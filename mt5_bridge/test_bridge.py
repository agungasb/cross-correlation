import unittest
import time
from mt5_bridge.config import BridgeConfig
from mt5_bridge.engine import BridgeEngine
from mt5_bridge.schema import TradeIntent, ModifyPositionRequest

class TestMT5BridgeEngine(unittest.TestCase):
    def setUp(self):
        self.config = BridgeConfig(mode="mock", magic_number=999111)
        self.engine = BridgeEngine(self.config)
        self.engine.start()

    def tearDown(self):
        self.engine.stop()

    def test_account_and_quote(self):
        status = self.engine.get_status()
        self.assertTrue(status.connected)
        self.assertGreater(status.balance, 0)

        quote = self.engine.get_quote("XAUUSD")
        self.assertEqual(quote.symbol, "XAUUSD")
        self.assertGreater(quote.ask, quote.bid)

    def test_order_placement_and_idempotency(self):
        intent = TradeIntent(
            idempotency_key="unique_signal_test_123",
            symbol="XAUUSD",
            action="BUY",
            volume=0.02,
            setup_id=1,
            stop_loss_points=50,
            take_profit_points=100,
            comment="TEST_COIL_BREAKOUT",
        )

        # 1. First execution
        res1 = self.engine.execute_intent(intent)
        self.assertTrue(res1.success)
        self.assertIsNotNone(res1.ticket)
        first_ticket = res1.ticket

        # Verify position is open
        positions = self.engine.get_positions("XAUUSD")
        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0].ticket, first_ticket)
        self.assertEqual(positions[0].volume, 0.02)

        # 2. Replay same intent (Network retry simulation)
        res2 = self.engine.execute_intent(intent)
        self.assertTrue(res2.success)
        self.assertEqual(res2.ticket, first_ticket)

        # Ensure no duplicate position was created!
        positions_after = self.engine.get_positions("XAUUSD")
        self.assertEqual(len(positions_after), 1)

    def test_relative_sl_tp_points_anchoring(self):
        quote = self.engine.get_quote("XAUUSD")
        intent = TradeIntent(
            idempotency_key="relative_points_test_01",
            symbol="XAUUSD",
            action="BUY",
            volume=0.01,
            sl_tp_mode="RELATIVE_POINTS",
            stop_loss_points=100.0,  # $1.00 at 0.01 point
            take_profit_points=200.0, # $2.00 at 0.01 point
        )
        res = self.engine.execute_intent(intent)
        self.assertTrue(res.success)

        pos = self.engine.get_positions("XAUUSD")[0]
        # Assert SL is anchored to actual broker execution price, NOT external price
        expected_sl = round(res.price - 1.00, 2)
        expected_tp = round(res.price + 2.00, 2)
        self.assertEqual(pos.sl, expected_sl)
        self.assertEqual(pos.tp, expected_tp)
        self.engine.close_position(pos.ticket)

    def test_basis_drift_circuit_breaker(self):
        # Quote is ~2650.55. Signal price is 2500.0 (divergence = 150.55 > $15 limit)
        intent = TradeIntent(
            idempotency_key="basis_reject_test_01",
            symbol="XAUUSD",
            action="BUY",
            volume=0.01,
            signal_price=2500.0,
            max_basis_points=1500,  # $15 limit
        )
        res = self.engine.execute_intent(intent)
        self.assertFalse(res.success)
        self.assertEqual(res.retcode, 10015)
        self.assertIn("BASIS_DRIFT_REJECT", res.retcode_description)

    def test_modify_and_close(self):
        intent = TradeIntent(
            idempotency_key="unique_signal_test_modify",
            symbol="XAUUSD",
            action="SELL",
            volume=0.01,
            setup_id=3,
        )
        res = self.engine.execute_intent(intent)
        ticket = res.ticket

        # Modify SL/TP
        mod_res = self.engine.modify_position(ticket, sl=2660.0, tp=2620.0)
        self.assertTrue(mod_res.success)

        # Verify modified values
        pos = self.engine.get_positions()[0]
        self.assertEqual(pos.sl, 2660.0)
        self.assertEqual(pos.tp, 2620.0)

        # Close position
        close_res = self.engine.close_position(ticket)
        self.assertTrue(close_res.success)
        self.assertEqual(len(self.engine.get_positions()), 0)

    def test_emergency_kill_switch(self):
        # Open 2 positions
        self.engine.execute_intent(
            TradeIntent(
                idempotency_key="kill_test_1",
                symbol="XAUUSD",
                action="BUY",
                volume=0.01,
            )
        )
        self.engine.execute_intent(
            TradeIntent(
                idempotency_key="kill_test_2",
                symbol="EURUSD",
                action="SELL",
                volume=0.05,
            )
        )
        self.assertEqual(len(self.engine.get_positions()), 2)

        # Trigger Kill-Switch
        close_results = self.engine.close_all_positions()
        self.assertEqual(len(close_results), 2)
        self.assertTrue(all(r.success for r in close_results))
        self.assertEqual(len(self.engine.get_positions()), 0)

    def test_watchdog_deadman_switch(self):
        # Create a dedicated engine with ultra-short 0.15s timeout
        short_config = BridgeConfig(
            mode="mock",
            magic_number=777000,
            watchdog_enabled=True,
            heartbeat_timeout_sec=0.15,
            watchdog_action="PROTECT_BREAKEVEN",
        )
        test_engine = BridgeEngine(short_config)
        test_engine.start()

        try:
            # 1. Open a position
            res = test_engine.execute_intent(
                TradeIntent(
                    idempotency_key="watchdog_test_pos",
                    symbol="XAUUSD",
                    action="BUY",
                    volume=0.01,
                    stop_loss_points=50,
                )
            )
            self.assertTrue(res.success)
            pos = test_engine.get_positions("XAUUSD")[0]
            open_price = pos.price_open

            # Simulate price moving into profit
            pos.profit = 120.0
            self.assertNotEqual(pos.sl, open_price)

            # 2. Wait 0.25s without sending heartbeats (breaching 0.15s threshold)
            time.sleep(0.35)

            # 3. Assert watchdog tripped and moved SL to break-even
            status = test_engine.get_watchdog_status()
            self.assertTrue(status.tripped)

            updated_pos = test_engine.get_positions("XAUUSD")[0]
            self.assertEqual(updated_pos.sl, open_price)

            # 4. Sending fresh heartbeat resets tripped state
            test_engine.record_heartbeat("webapp_recovery_01", "AUTONOMOUS")
            self.assertFalse(test_engine.get_watchdog_status().tripped)

        finally:
            test_engine.stop()

if __name__ == "__main__":
    unittest.main()
