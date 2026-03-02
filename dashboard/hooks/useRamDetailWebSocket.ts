"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RamDetailMetrics } from "@/types/metrics";

function getWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8765/ws/ram-detail";
  const host = window.location.hostname || "localhost";
  return `ws://${host}:8765/ws/ram-detail`;
}

/**
 * On-demand WebSocket hook for RAM deep-dive data.
 * Only connects when `enabled` is true (overlay is open).
 */
export function useRamDetailWebSocket(enabled: boolean) {
  const [data, setData] = useState<RamDetailMetrics | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RamDetailMetrics;
        setData(parsed);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      wsRef.current?.close();
      wsRef.current = null;
      setData(null);
    }

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, connect]);

  return { data };
}
