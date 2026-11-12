try:
    from mt5_bridge.config import BridgeConfig
    from mt5_bridge.drivers.base import BaseMT5Driver
    from mt5_bridge.drivers.live import LiveMT5Driver
    from mt5_bridge.drivers.mock import MockMT5Driver
except ImportError:
    from config import BridgeConfig
    from drivers.base import BaseMT5Driver
    from drivers.live import LiveMT5Driver
    from drivers.mock import MockMT5Driver

def create_driver(config: BridgeConfig) -> BaseMT5Driver:
    if config.mode == "live":
        return LiveMT5Driver(config)
    return MockMT5Driver(config)
