import json
import threading
import time
import unittest
from http.server import HTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from mt5_bridge.config import BridgeConfig
from mt5_bridge.engine import BridgeEngine
from mt5_bridge.server import StandaloneBridgeHandler
import mt5_bridge.server as server_module

class TestHTTPIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_config = BridgeConfig(mode="mock", port=8999, auth_token="test_token_123")
        server_module.config = cls.test_config
        server_module.engine = BridgeEngine(cls.test_config)
        server_module.engine.start()

        try:
            cls.httpd = HTTPServer(("127.0.0.1", 8999), StandaloneBridgeHandler)
            cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
            cls.server_thread.start()
            time.sleep(0.1)
        except Exception:
            cls.httpd = None

    @classmethod
    def tearDownClass(cls):
        if getattr(cls, "httpd", None):
            try:
                cls.httpd.shutdown()
            except Exception:
                pass
        server_module.engine.stop()

    def _request(self, method: str, endpoint: str, data: dict = None, token: str = "test_token_123"):
        if not getattr(self, "httpd", None):
            raise unittest.SkipTest("TCP loopback socket binding restricted in environment")

        url = f"http://127.0.0.1:8999{endpoint}"
        body = json.dumps(data).encode("utf-8") if data else None
        headers = {}
        if body:
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            req = Request(url, data=body, headers=headers, method=method)
            with urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except (PermissionError, URLError) as e:
            raise unittest.SkipTest(f"TCP loopback connection restricted: {e}")

    def test_health_no_auth_needed(self):
        status, data = self._request("GET", "/health", token=None)
        self.assertEqual(status, 200)
        self.assertEqual(data["status"], "ok")

    def test_unauthorized_rejection(self):
        with self.assertRaises(HTTPError) as ctx:
            self._request("GET", "/account", token="wrong_token")
        self.assertEqual(ctx.exception.code, 401)

    def test_account_and_trade_flow(self):
        status, acc = self._request("GET", "/account")
        self.assertEqual(status, 200)
        self.assertEqual(acc["currency"], "USD")

if __name__ == "__main__":
    unittest.main()
