"""
Remote monitoring agent with auto-discovery.
Finds the central server automatically via UDP beacon.
Just run:  python agent.py

Optional override:  python agent.py --server ws://192.168.1.50:8765/ws/agent
"""
import asyncio
import json
import argparse
import logging
import time
import platform
import socket
import psutil

try:
    import GPUtil
    GPU_AVAILABLE = True
except (ImportError, Exception):
    GPU_AVAILABLE = False

try:
    import websockets
except ImportError:
    print("websockets not installed. Please run: pip install websockets")
    raise SystemExit(1)

from discovery import discover_server

logger = logging.getLogger(__name__)


def collect_agent_data() -> dict:
    """Collect system data without icon extraction for bandwidth efficiency."""
    freq = psutil.cpu_freq()
    per_core = psutil.cpu_percent(interval=0, percpu=True)
    mem = psutil.virtual_memory()
    net = psutil.net_io_counters()

    cpu_temp = None
    try:
        if hasattr(psutil, 'sensors_temperatures'):
            temps = getattr(psutil, 'sensors_temperatures')()
            if temps:
                for name in ("coretemp", "cpu_thermal", "k10temp", "zenpower"):
                    if name in temps and temps[name]:
                        cpu_temp = temps[name][0].current
                        break
                if cpu_temp is None:
                    first_key = next(iter(temps))
                    if temps[first_key]:
                        cpu_temp = temps[first_key][0].current
    except Exception:
        logger.debug("Failed to read CPU temperature", exc_info=True)

    gpus = []
    if GPU_AVAILABLE:
        try:
            for g in GPUtil.getGPUs():
                gpus.append({
                    "name": g.name,
                    "load_percent": round(g.load * 100, 1),
                    "memory_used_mb": round(g.memoryUsed, 1),
                    "memory_total_mb": round(g.memoryTotal, 1),
                    "memory_percent": round(g.memoryUsed / g.memoryTotal * 100, 1) if g.memoryTotal > 0 else 0,
                    "temperature": g.temperature,
                })
        except Exception:
            logger.debug("Failed to read GPU metrics", exc_info=True)

    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "total_gb": round(usage.total / (1024**3), 2),
                "used_gb": round(usage.used / (1024**3), 2),
                "free_gb": round(usage.free / (1024**3), 2),
                "usage_percent": usage.percent,
            })
        except (PermissionError, OSError):
            continue

    processes = []
    for p in psutil.process_iter(
        ["pid", "name", "status", "cpu_percent", "memory_info",
         "memory_percent", "io_counters", "username", "exe"]
    ):
        try:
            info = p.info
            io_c = info.get("io_counters")
            mem_info = info.get("memory_info")
            processes.append({
                "pid": info["pid"],
                "name": info["name"] or "Unknown",
                "status": info.get("status", "unknown"),
                "cpu_percent": round(info.get("cpu_percent", 0) or 0, 1),
                "memory_mb": round((mem_info.rss / (1024 * 1024)) if mem_info else 0, 1),
                "memory_percent": round(info.get("memory_percent", 0) or 0, 1),
                "disk_read_bytes": io_c.read_bytes if io_c else 0,
                "disk_write_bytes": io_c.write_bytes if io_c else 0,
                "username": info.get("username"),
                "exe_path": info.get("exe") or "",
                "icon_base64": None,
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    return {
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "uptime_seconds": time.time() - psutil.boot_time(),
        "cpu": {
            "usage_percent": psutil.cpu_percent(interval=0),
            "frequency_mhz": freq.current if freq else 0,
            "cores_physical": psutil.cpu_count(logical=False) or 1,
            "cores_logical": psutil.cpu_count(logical=True) or 1,
            "per_core_usage": per_core,
            "temperature": cpu_temp,
        },
        "gpu": gpus,
        "ram": {
            "total_gb": round(mem.total / (1024**3), 2),
            "used_gb": round(mem.used / (1024**3), 2),
            "available_gb": round(mem.available / (1024**3), 2),
            "usage_percent": mem.percent,
        },
        "disks": disks,
        "network": {
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv,
            "bytes_sent_rate": 0,
            "bytes_recv_rate": 0,
        },
        "processes": processes,
        "timestamp": time.time(),
    }


def do_kill(pid: int) -> tuple[bool, str]:
    try:
        proc = psutil.Process(pid)
        name = proc.name()
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except psutil.TimeoutExpired:
            proc.kill()
        return True, f"Process '{name}' (PID {pid}) terminated"
    except psutil.NoSuchProcess:
        return False, f"PID {pid} not found"
    except psutil.AccessDenied:
        return False, f"Access denied for PID {pid}"
    except Exception as e:
        return False, str(e)


def find_server(manual_url: str | None) -> str:
    """Find the server URL - either from manual arg or auto-discovery."""
    if manual_url:
        print(f"  Server (manual): {manual_url}")
        return manual_url

    print("  Searching for server on network (UDP beacon)...")
    while True:
        server_info = discover_server(timeout=5.0)
        if server_info:
            ws_url = server_info["ws_url"]
            server_host = server_info.get("hostname", "?")
            server_ip = server_info["ip"]
            print(f"  Server found!")
            print(f"    Host: {server_host} ({server_ip})")
            print(f"    URL:  {ws_url}")
            return ws_url
        else:
            print("  No server found. Retrying...")


async def run_agent(server_url: str, interval: float = 2.0):
    psutil.cpu_percent(interval=0)
    await asyncio.sleep(0.5)

    while True:
        try:
            print(f"\n  Connecting to {server_url} ...")
            async with websockets.connect(server_url) as ws:
                print("  Connected!\n")
                while True:
                    data = collect_agent_data()
                    await ws.send(json.dumps(data))

                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=0.1)
                        cmd = json.loads(msg)
                        if cmd.get("action") == "kill":
                            ok, result = do_kill(cmd["pid"])
                            await ws.send(json.dumps({
                                "success": ok,
                                "message": result,
                            }))
                    except asyncio.TimeoutError:
                        pass

                    await asyncio.sleep(interval)
        except Exception as e:
            print(f"  Connection lost: {e}. Retrying in 5s...")
            await asyncio.sleep(5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="SpecterMonitor Agent - connects automatically to the server",
    )
    parser.add_argument(
        "--server",
        default=None,
        help="Manual server URL (optional, otherwise auto-discovery)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=2.0,
        help="Update interval in seconds (default: 2.0)",
    )
    args = parser.parse_args()

    print()
    print("=" * 52)
    print("  SpecterMonitor - Remote Agent")
    print("=" * 52)
    print()
    print(f"  Hostname:   {socket.gethostname()}")
    print(f"  Interval:   {args.interval}s")
    print()

    ws_url = find_server(args.server)

    print()
    print("=" * 52)
    print()

    asyncio.run(run_agent(ws_url, args.interval))
