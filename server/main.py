"""
FastAPI server for SpecterMonitor.
Supports multi-PC monitoring via WebSocket, process management, and remote kill.
"""
import asyncio
import json
import logging
import os
import time
import socket
from typing import Callable, Awaitable

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from monitor import collect_snapshot, kill_process, get_cpu_detail_metrics, get_ram_detail_metrics, get_gpu_detail_metrics
from models import KillRequest, KillResponse

logger = logging.getLogger(__name__)

SERVER_PORT = int(os.environ.get("SERVER_PORT", 8765))

app = FastAPI(title="SpecterMonitor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_HISTORY = 60
host_histories: dict[str, list[dict]] = {}

remote_hosts: dict[str, dict] = {}

LOCAL_HOSTNAME = socket.gethostname()


def make_history_point(data: dict) -> dict:
    return {
        "timestamp": data["timestamp"],
        "cpu_percent": data["cpu"]["usage_percent"],
        "ram_percent": data["ram"]["usage_percent"],
        "gpu_load": data["gpu"][0]["load_percent"] if data["gpu"] else 0,
        "gpu_temp": data["gpu"][0]["temperature"] if data["gpu"] else None,
        "cpu_temp": data["cpu"]["temperature"],
        "net_sent_rate": data["network"]["bytes_sent_rate"],
        "net_recv_rate": data["network"]["bytes_recv_rate"],
    }


def update_history(hostname: str, data: dict) -> list[dict]:
    if hostname not in host_histories:
        host_histories[hostname] = []
    history = host_histories[hostname]
    history.append(make_history_point(data))
    if len(history) > MAX_HISTORY:
        history.pop(0)
    return history


@app.get("/api/snapshot")
async def get_snapshot():
    snap = collect_snapshot()
    return snap.model_dump()


@app.post("/api/kill", response_model=KillResponse)
async def kill_proc(req: KillRequest):
    if req.hostname == LOCAL_HOSTNAME:
        ok, msg = kill_process(req.pid)
        return KillResponse(success=ok, message=msg)
    if req.hostname in _agent_kill_callbacks:
        ok, msg = await _agent_kill_callbacks[req.hostname](req.pid)
        return KillResponse(success=ok, message=msg)
    return KillResponse(success=False, message=f"Host '{req.hostname}' not connected")


@app.websocket("/ws")
async def ws_dashboard(websocket: WebSocket):
    """Stream all host data to dashboard frontend."""
    await websocket.accept()
    try:
        while True:
            snap = collect_snapshot()
            local_data = snap.model_dump()
            local_history = update_history(LOCAL_HOSTNAME, local_data)
            local_data["history"] = local_history

            all_hosts = {LOCAL_HOSTNAME: local_data}
            for hostname, agent_data in remote_hosts.items():
                agent_data["history"] = host_histories.get(hostname, [])
                all_hosts[hostname] = agent_data

            payload = {
                "hosts": all_hosts,
                "timestamp": time.time(),
            }

            await websocket.send_text(json.dumps(payload))

            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                cmd = json.loads(msg)
                if cmd.get("action") == "kill":
                    hostname = cmd["hostname"]
                    pid = cmd["pid"]
                    if hostname == LOCAL_HOSTNAME:
                        ok, result_msg = kill_process(pid)
                    elif hostname in _agent_kill_callbacks:
                        ok, result_msg = await _agent_kill_callbacks[hostname](pid)
                    else:
                        ok, result_msg = False, "Host not connected"
                    await websocket.send_text(json.dumps({
                        "type": "kill_result",
                        "success": ok,
                        "message": result_msg,
                    }))
            except (asyncio.TimeoutError, Exception):
                pass

            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("Dashboard WebSocket error", exc_info=True)


@app.websocket("/ws/cpu-detail")
async def ws_cpu_detail(websocket: WebSocket):
    """Stream deep-dive CPU metrics only while the detail overlay is open."""
    await websocket.accept()
    try:
        while True:
            detail = get_cpu_detail_metrics()
            await websocket.send_text(json.dumps(detail.model_dump()))
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("CPU detail WebSocket error", exc_info=True)


@app.websocket("/ws/ram-detail")
async def ws_ram_detail(websocket: WebSocket):
    """Stream deep-dive RAM metrics only while the detail overlay is open."""
    await websocket.accept()
    try:
        while True:
            detail = get_ram_detail_metrics()
            await websocket.send_text(json.dumps(detail.model_dump()))
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("RAM detail WebSocket error", exc_info=True)


@app.websocket("/ws/gpu-detail")
async def ws_gpu_detail(websocket: WebSocket, gpu_index: int = 0):
    """Stream deep-dive GPU metrics only while the GPU detail overlay is open."""
    await websocket.accept()
    try:
        while True:
            detail = get_gpu_detail_metrics(gpu_index)
            await websocket.send_text(json.dumps(detail.model_dump()))
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("GPU detail WebSocket error", exc_info=True)


_agent_kill_callbacks: dict[str, Callable[[int], Awaitable[tuple[bool, str]]]] = {}


@app.websocket("/ws/agent")
async def ws_agent(websocket: WebSocket):
    """Receive data from remote monitoring agents."""
    await websocket.accept()
    hostname = None
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            if "hostname" in data:
                hostname = data["hostname"]
                remote_hosts[hostname] = data
                update_history(hostname, data)

                async def kill_on_agent(pid: int, ws=websocket) -> tuple[bool, str]:
                    await ws.send_text(json.dumps({"action": "kill", "pid": pid}))
                    try:
                        resp = await asyncio.wait_for(ws.receive_text(), timeout=5)
                        result = json.loads(resp)
                        return result.get("success", False), result.get("message", "")
                    except Exception:
                        return False, "Agent did not respond"

                _agent_kill_callbacks[hostname] = kill_on_agent

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("Agent WebSocket error", exc_info=True)
    finally:
        if hostname:
            remote_hosts.pop(hostname, None)
            _agent_kill_callbacks.pop(hostname, None)


if __name__ == "__main__":
    import uvicorn
    from discovery import start_beacon_server

    local_ip = start_beacon_server(server_port=SERVER_PORT)

    collect_snapshot()

    print()
    print("=" * 52)
    print("  SpecterMonitor - Server")
    print("=" * 52)
    print()
    print(f"  LAN IP:     {local_ip}")
    print(f"  API:        http://{local_ip}:{SERVER_PORT}")
    print(f"  WebSocket:  ws://{local_ip}:{SERVER_PORT}/ws")
    print(f"  Beacon:     UDP broadcast on port 47761")
    print()
    print(f"  Dashboard:  http://{local_ip}:3000")
    print()
    print("  Remote PCs connect automatically:")
    print("    python agent.py")
    print()
    print("=" * 52)
    print()

    uvicorn.run(app, host="0.0.0.0", port=SERVER_PORT)
