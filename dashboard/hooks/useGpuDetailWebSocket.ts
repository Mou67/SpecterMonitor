"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GpuDetailMetrics } from "@/types/metrics";

function getWsUrl(gpuIndex: number): string {
  if (typeof window === "undefined")
    return `ws://localhost:8765/ws/gpu-detail?gpu_index=${gpuIndex}`;
  const host = window.location.hostname || "localhost";
  return `ws://${host}:8765/ws/gpu-detail?gpu_index=${gpuIndex}`;
}

/**
 * On-demand WebSocket hook for GPU deep-dive data.
 * Only connects when `enabled` is true (overlay is open).
 * Keeps rolling histories for load% and temperature for mini-charts.
 */
export function useGpuDetailWebSocket(enabled: boolean, gpuIndex: number = 0) {
  const [data, setData] = useState<GpuDetailMetrics | null>(null);
  const [loadHistory, setLoadHistory] = useState<number[]>([]);
  const [tempHistory, setTempHistory] = useState<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl(gpuIndex));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as GpuDetailMetrics;
        setData(parsed);

        setLoadHistory((prev) => {
          const next = [...prev, parsed.load_percent];
          if (next.length > 30) next.shift();
          return next;
        });

        if (parsed.temperature != null) {
          setTempHistory((prev) => {
            const next = [...prev, parsed.temperature as number];
            if (next.length > 30) next.shift();
            return next;
          });
        }
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
  }, [gpuIndex]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      wsRef.current?.close();
      wsRef.current = null;
      setData(null);
      setLoadHistory([]);
      setTempHistory([]);
    }

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, connect]);

  return { data, loadHistory, tempHistory };
}
