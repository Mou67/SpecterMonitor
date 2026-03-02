"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CpuDetailMetrics } from "@/types/metrics";

function getWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8765/ws/cpu-detail";
  const host = window.location.hostname || "localhost";
  return `ws://${host}:8765/ws/cpu-detail`;
}

/**
 * On-demand WebSocket hook for CPU deep-dive data.
 * Only connects when `enabled` is true (overlay is open).
 * Keeps a rolling history of per-core frequency snapshots for mini-charts.
 */
export function useCpuDetailWebSocket(enabled: boolean) {
  const [data, setData] = useState<CpuDetailMetrics | null>(null);
  const [coreHistory, setCoreHistory] = useState<Record<number, number[]>>({});
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as CpuDetailMetrics;
        setData(parsed);

        // Append per-core frequencies to rolling history (max 30 points)
        setCoreHistory((prev) => {
          const next = { ...prev };
          for (const core of parsed.per_core_detail) {
            const arr = next[core.core_id] || [];
            arr.push(core.frequency_mhz);
            if (arr.length > 30) arr.shift();
            next[core.core_id] = arr;
          }
          return next;
        });
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
      // Disconnect when overlay closes
      wsRef.current?.close();
      wsRef.current = null;
      setData(null);
      setCoreHistory({});
    }

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, connect]);

  return { data, coreHistory };
}
