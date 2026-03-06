"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MemoryStick,
  Thermometer,
  Zap,
  Layers,
  ArrowLeft,
  Wind,
  Cpu,
} from "lucide-react";
import { useGpuDetailWebSocket } from "@/hooks/useGpuDetailWebSocket";
import AnimatedValue from "./AnimatedValue";
import ProgressRing from "./ProgressRing";

interface GpuDetailOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  gpuCount: number;
}

// ---- Mini sparkline ----
function Sparkline({
  data,
  color,
  gradientId,
}: {
  data: number[];
  color: string;
  gradientId: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const h = 36;
  const w = 100;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min + 1)) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}80)` }}
      />
    </svg>
  );
}

// ---- Info row ----
function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between items-start text-xs">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-white font-mono text-right ml-3 break-all">
        {value || "—"}
      </span>
    </div>
  );
}

// ---- Live metric row ----
function LiveRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-400 flex items-center gap-1">
        {icon}
        {label}
      </span>
      <motion.span
        className="font-mono font-medium"
        animate={{ color: color || "#e0e0e0" }}
        transition={{ duration: 0.5 }}
      >
        {value || "—"}
      </motion.span>
    </div>
  );
}

// ---- Main overlay ----
export default function GpuDetailOverlay({
  isOpen,
  onClose,
  gpuCount,
}: GpuDetailOverlayProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data, loadHistory, tempHistory } = useGpuDetailWebSocket(
    isOpen,
    selectedIndex
  );

  const tempColor =
    data?.temperature != null
      ? data.temperature > 85
        ? "#ff073a"
        : data.temperature > 75
        ? "#ff6a00"
        : "#e0e0e0"
      : "#e0e0e0";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Content panel */}
          <motion.div
            className="relative z-10 w-full max-w-6xl mx-4 my-6"
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(10, 10, 20, 0.95)",
                backdropFilter: "blur(30px)",
                border: "1px solid rgba(57, 255, 20, 0.15)",
                boxShadow:
                  "0 0 60px rgba(57, 255, 20, 0.06), 0 25px 80px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-8 py-5"
                style={{
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                  background:
                    "linear-gradient(180deg, rgba(57, 255, 20, 0.04) 0%, transparent 100%)",
                }}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{
                      background: "rgba(57, 255, 20, 0.1)",
                      border: "1px solid rgba(57, 255, 20, 0.2)",
                    }}
                  >
                    <MemoryStick className="w-5 h-5 text-neon-green" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      GPU Deep Dive
                    </h2>
                    <p className="text-xs text-gray-500">
                      {data?.name || "Loading..."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {data && (
                    <AnimatedValue
                      value={data.load_percent}
                      suffix="%"
                      className="text-2xl font-bold text-white font-mono"
                    />
                  )}
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* GPU selector tabs (only when multiple GPUs) */}
              {gpuCount > 1 && (
                <div
                  className="flex gap-2 px-8 pt-4"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  {Array.from({ length: gpuCount }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedIndex(i)}
                      className={`px-4 py-1.5 mb-3 rounded-lg text-xs font-medium transition-all ${
                        selectedIndex === i
                          ? "text-neon-green"
                          : "text-gray-500 hover:text-white"
                      }`}
                      style={
                        selectedIndex === i
                          ? {
                              background: "rgba(57, 255, 20, 0.08)",
                              border: "1px solid rgba(57, 255, 20, 0.25)",
                            }
                          : {
                              background: "transparent",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }
                      }
                    >
                      GPU {i}
                    </button>
                  ))}
                </div>
              )}

              {/* Loading state */}
              {!data && (
                <div className="flex items-center justify-center py-24">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <MemoryStick className="w-8 h-8 text-neon-green opacity-50" />
                  </motion.div>
                </div>
              )}

              {/* Data content */}
              {data && (
                <div className="p-8 space-y-8">
                  {/* Top row: Identification | Specifications | Live Overview */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Identification */}
                    <div
                      className="glass-card p-5 space-y-3"
                      style={{ background: "rgba(15, 15, 30, 0.6)" }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <MemoryStick className="w-4 h-4 text-neon-green" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Identification
                        </span>
                      </div>
                      <InfoRow label="Model" value={data.name} />
                      {data.uuid && (
                        <InfoRow
                          label="UUID"
                          value={
                            data.uuid.length > 20
                              ? data.uuid.slice(0, 20) + "…"
                              : data.uuid
                          }
                        />
                      )}
                      <InfoRow label="Driver" value={data.driver_version} />
                    </div>

                    {/* Specifications */}
                    <div
                      className="glass-card p-5 space-y-3"
                      style={{ background: "rgba(15, 15, 30, 0.6)" }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="w-4 h-4 text-neon-green" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Specifications
                        </span>
                      </div>
                      <InfoRow
                        label="VRAM"
                        value={`${data.memory_total_mb.toFixed(0)} MB`}
                      />
                      <InfoRow
                        label="PCIe"
                        value={
                          data.pcie_gen != null && data.pcie_width != null
                            ? `Gen ${data.pcie_gen} ×${data.pcie_width}`
                            : null
                        }
                      />
                      <InfoRow
                        label="GPU Clock"
                        value={
                          data.gpu_clock_mhz != null
                            ? `${data.gpu_clock_mhz} MHz`
                            : null
                        }
                      />
                      <InfoRow
                        label="MEM Clock"
                        value={
                          data.memory_clock_mhz != null
                            ? `${data.memory_clock_mhz} MHz`
                            : null
                        }
                      />
                    </div>

                    {/* Live Overview */}
                    <div
                      className="glass-card p-5 flex flex-col items-center justify-center gap-4"
                      style={{ background: "rgba(15, 15, 30, 0.6)" }}
                    >
                      <ProgressRing
                        value={data.load_percent}
                        size={130}
                        strokeWidth={9}
                        color="#39ff14"
                        glowColor="rgba(57, 255, 20, 0.35)"
                      />

                      <div className="w-full space-y-2 mt-2">
                        {data.temperature != null && (
                          <LiveRow
                            icon={<Thermometer className="w-3 h-3" />}
                            label="Temperature"
                            value={`${data.temperature.toFixed(1)}°C`}
                            color={tempColor}
                          />
                        )}
                        {data.power_draw_watts != null && (
                          <LiveRow
                            icon={<Zap className="w-3 h-3" />}
                            label="Power"
                            value={
                              data.power_limit_watts != null
                                ? `${data.power_draw_watts.toFixed(1)} / ${data.power_limit_watts.toFixed(0)} W`
                                : `${data.power_draw_watts.toFixed(1)} W`
                            }
                          />
                        )}
                        {data.fan_speed_percent != null && (
                          <LiveRow
                            icon={<Wind className="w-3 h-3" />}
                            label="Fan"
                            value={`${data.fan_speed_percent.toFixed(0)}%`}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* VRAM bar */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Cpu className="w-4 h-4 text-neon-green" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        VRAM Usage
                      </span>
                      <span className="text-[10px] text-gray-600 ml-auto font-mono">
                        {data.memory_used_mb.toFixed(0)} / {data.memory_total_mb.toFixed(0)} MB
                      </span>
                    </div>
                    <div className="progress-track h-3 rounded-full">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background:
                            data.memory_percent > 90
                              ? "linear-gradient(90deg, #ff073a, #ff6a00)"
                              : "linear-gradient(90deg, #39ff14, #00b36b)",
                        }}
                        animate={{ width: `${data.memory_percent}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-600 mt-1 font-mono">
                      <span>0 MB</span>
                      <span>{data.memory_percent.toFixed(1)}% used</span>
                      <span>{data.memory_total_mb.toFixed(0)} MB</span>
                    </div>
                  </div>

                  {/* History charts */}
                  {(loadHistory.length > 1 || tempHistory.length > 1) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {loadHistory.length > 1 && (
                        <div
                          className="glass-card p-4"
                          style={{ background: "rgba(15, 15, 30, 0.6)" }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">
                              GPU Load History
                            </span>
                            <span className="text-[10px] text-neon-green font-mono">
                              {data.load_percent.toFixed(1)}%
                            </span>
                          </div>
                          <Sparkline
                            data={loadHistory}
                            color="#39ff14"
                            gradientId="gpu-load-grad"
                          />
                        </div>
                      )}
                      {tempHistory.length > 1 && (
                        <div
                          className="glass-card p-4"
                          style={{ background: "rgba(15, 15, 30, 0.6)" }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">
                              Temperature History
                            </span>
                            <motion.span
                              className="text-[10px] font-mono"
                              animate={{ color: tempColor }}
                            >
                              {data.temperature != null
                                ? `${data.temperature.toFixed(1)}°C`
                                : "—"}
                            </motion.span>
                          </div>
                          <Sparkline
                            data={tempHistory}
                            color="#ff6a00"
                            gradientId="gpu-temp-grad"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
