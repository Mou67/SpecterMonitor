"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MultiHostPayload, HostSnapshot, KillResult } from "@/types/metrics";

const RECONNECT_DELAY = 3000;

function getWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8765/ws";
  // Connect to the same host the page was loaded from, on backend port 8765
  const host = window.location.hostname || "localhost";
  return `ws://${host}:8765/ws`;
}

export function useMonitorWebSocket() {
  const [hosts, setHosts] = useState<Record<string, HostSnapshot>>({});
  const [connected, setConnected] = useState(false);
  const [killResult, setKillResult] = useState<KillResult | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "kill_result") {
          setKillResult(data as KillResult);
          setTimeout(() => setKillResult(null), 4000);
          return;
        }
        const payload = data as MultiHostPayload;
        if (payload.hosts) {
          setHosts(payload.hosts);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const sendKill = useCallback((hostname: string, pid: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: "kill",
        hostname,
        pid,
      }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { hosts, connected, sendKill, killResult };
}
