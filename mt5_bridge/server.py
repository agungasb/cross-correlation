import json
import logging
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Optional, List, Any

# Ensure import paths resolve whether run from repo root or inside mt5_bridge folder
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

try:
    from mt5_bridge.config import load_config
    from mt5_bridge.engine import BridgeEngine
    from mt5_bridge.schema import (
        AccountStatus,
        ClosePositionRequest,
        HeartbeatRequest,
        ModifyPositionRequest,
        OrderResult,
        Position,
        Quote,
        TradeIntent,
        WatchdogStatus,
    )
except ImportError:
    from config import load_config
    from engine import BridgeEngine
    from schema import (
        AccountStatus,
        ClosePositionRequest,
        HeartbeatRequest,
        ModifyPositionRequest,
        OrderResult,
        Position,
        Quote,
        TradeIntent,
        WatchdogStatus,
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("mt5_bridge.server")

config = load_config()
engine = BridgeEngine(config)

class StandaloneBridgeHandler(BaseHTTPRequestHandler):
    """
    Standard-library HTTP server handler requiring ZERO external pip dependencies.
    Provides identical endpoints to FastAPI for seamless local development and deployment.
    """

    def _send_json(self, status_code: int, data: Any):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def _verify_auth(self) -> bool:
        if not config.auth_token:
            return True
        auth_header = self.headers.get("Authorization", "")
        expected = f"Bearer {config.auth_token}"
        if auth_header != expected:
            self._send_json(401, {"error": "Unauthorized", "detail": "Invalid or missing Bearer token"})
            return False
        return True

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = parse_qs(parsed.query)

        if path == "/health":
            try:
                acc = engine.get_status()
                watchdog = engine.get_watchdog_status()
                self._send_json(200, {
                    "status": "ok",
                    "mode": config.mode,
                    "connected": acc.connected,
                    "account_login": acc.login,
                    "server": acc.server,
                    "watchdog": watchdog.to_dict(),
                })
            except Exception as e:
                self._send_json(200, {"status": "degraded", "mode": config.mode, "error": str(e)})
            return

        if not self._verify_auth():
            return

        if path == "/account":
            try:
                acc = engine.get_status()
                self._send_json(200, acc.to_dict())
            except Exception as e:
                self._send_json(500, {"error": str(e)})

        elif path == "/watchdog":
            try:
                wd = engine.get_watchdog_status()
                self._send_json(200, wd.to_dict())
            except Exception as e:
                self._send_json(500, {"error": str(e)})

        elif path.startswith("/quote/"):
            symbol = path.split("/quote/")[1]
            try:
                quote = engine.get_quote(symbol)
                self._send_json(200, quote.to_dict())
            except Exception as e:
                self._send_json(404, {"error": str(e)})

        elif path == "/positions":
            symbol = query.get("symbol", [None])[0]
            try:
                positions = engine.get_positions(symbol)
                self._send_json(200, [p.to_dict() for p in positions])
            except Exception as e:
                self._send_json(500, {"error": str(e)})

        else:
            self._send_json(404, {"error": "Not Found", "path": path})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if not self._verify_auth():
            return

        length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception as e:
            self._send_json(400, {"error": f"Invalid JSON payload: {e}"})
            return

        if path == "/heartbeat":
            try:
                client_id = payload.get("client_id", "webapp_client")
                active_mode = payload.get("active_mode", "OFF")
                engine.record_heartbeat(client_id, active_mode)
                self._send_json(200, {
                    "status": "ok",
                    "client_id": client_id,
                    "active_mode": active_mode,
                    "timestamp_ms": int(time.time() * 1000),
                })
            except Exception as e:
                self._send_json(500, {"error": str(e)})

        elif path == "/trade":
            try:
                intent = TradeIntent.from_dict(payload)
                res = engine.execute_intent(intent)
                self._send_json(200, res.to_dict())
            except Exception as e:
                self._send_json(500, {"error": str(e)})

        elif path == "/modify":
            try:
                req = ModifyPositionRequest.from_dict(payload)
                res = engine.modify_position(req.ticket, req.stop_loss, req.take_profit)
                self._send_json(200, res.to_dict())
            except Exception as e:
                self._send_json(400, {"error": str(e)})

        elif path == "/close":
            try:
                req = ClosePositionRequest.from_dict(payload)
                if req.close_all:
                    logger.critical("EMERGENCY KILL-SWITCH: Closing all positions!")
                    results = engine.close_all_positions()
                    self._send_json(200, [r.to_dict() for r in results])
                elif req.ticket is not None:
                    res = engine.close_position(req.ticket)
                    self._send_json(200, [res.to_dict()])
                elif req.symbol is not None:
                    results = engine.close_all_positions(req.symbol)
                    self._send_json(200, [r.to_dict() for r in results])
                else:
                    self._send_json(400, {"error": "Must provide ticket, symbol, or close_all=True"})
            except Exception as e:
                self._send_json(400, {"error": str(e)})

        else:
            self._send_json(404, {"error": "Not Found", "path": path})

def run_server():
    engine.start()
    server_address = (config.host, config.port)
    httpd = HTTPServer(server_address, StandaloneBridgeHandler)
    logger.info(f"MT5 Execution Bridge HTTP Server listening on http://{config.host}:{config.port}")
    logger.info(f"Mode: {config.mode.upper()} | Magic: {config.magic_number}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Stopping HTTP server...")
    finally:
        httpd.server_close()
        engine.stop()

if __name__ == "__main__":
    run_server()
