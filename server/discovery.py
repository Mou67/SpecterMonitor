"""
UDP beacon-based auto-discovery for LAN server/agent communication.
Server broadcasts its presence; agents listen and connect automatically.
"""
import json
import socket
import threading
import time

BEACON_PORT = 47761
BEACON_MAGIC = "NTM_BEACON"


def _get_lan_ip() -> str:
    """Get the machine's LAN IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def start_beacon_server(server_port: int = 8765, interval: float = 2.0) -> str:
    """
    Start a UDP beacon that broadcasts server presence on the LAN.
    Returns the local LAN IP address.
    """
    local_ip = _get_lan_ip()
    hostname = socket.gethostname()

    beacon_data = json.dumps({
        "magic": BEACON_MAGIC,
        "hostname": hostname,
        "ip": local_ip,
        "port": server_port,
        "ws_url": f"ws://{local_ip}:{server_port}/ws/agent",
    }).encode("utf-8")

    def _broadcast_loop():
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        while True:
            try:
                sock.sendto(beacon_data, ("<broadcast>", BEACON_PORT))
            except Exception:
                pass
            time.sleep(interval)

    t = threading.Thread(target=_broadcast_loop, daemon=True)
    t.start()
    return local_ip


def discover_server(timeout: float = 5.0) -> dict | None:
    """
    Listen for a server beacon on the LAN.
    Returns dict with keys: ws_url, hostname, ip  — or None on timeout.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.settimeout(timeout)
    try:
        sock.bind(("", BEACON_PORT))
        data, _addr = sock.recvfrom(4096)
        info = json.loads(data.decode("utf-8"))
        if info.get("magic") == BEACON_MAGIC:
            return {
                "ws_url": info["ws_url"],
                "hostname": info["hostname"],
                "ip": info["ip"],
            }
        return None
    except (socket.timeout, OSError):
        return None
    finally:
        sock.close()
