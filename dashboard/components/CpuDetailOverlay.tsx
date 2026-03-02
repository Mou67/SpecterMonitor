"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Cpu,
  Thermometer,
  Zap,
  Layers,
  Microchip,
  ArrowLeft,
} from "lucide-react";
import { CpuDetailMetrics } from "@/types/metrics";
import { useCpuDetailWebSocket } from "@/hooks/useCpuDetailWebSocket";
import AnimatedValue from "./AnimatedValue";
import ProgressRing from "./ProgressRing";

interface CpuDetailOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---- Mini sparkline for per-core frequency history ----
function FreqSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const h = 32;
  const w = 80;
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
        <linearGradient id="freq-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="#00f0ff"
        strokeWidth={1.5}
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 3px rgba(0,240,255,0.5))" }}
      />
    </svg>
  );
}

// ---- Cache progress bar ----
function CacheBar({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-gray-500 w-8 shrink-0 font-mono">
        {label}
      </span>
      <div className="flex-1 progress-track h-2.5">
        <motion.div
          className="progress-fill h-full"
          style={{
            background: "linear-gradient(90deg, #00f0ff, #00b8d4)",
          }}
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-[11px] text-gray-300 font-mono w-24 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

// ---- Feature badge ----
function FeatureBadge({ name }: { name: string }) {
  const isAvx = name.startsWith("avx");
  const isSse = name.startsWith("sse");
  const isVirt = name === "vmx" || name === "svm" || name === "vt-x";

  let color = "rgba(0, 240, 255, 0.15)";
  let borderColor = "rgba(0, 240, 255, 0.3)";
  let textColor = "#00f0ff";
  if (isAvx) {
    color = "rgba(57, 255, 20, 0.12)";
    borderColor = "rgba(57, 255, 20, 0.3)";
    textColor = "#39ff14";
  } else if (isVirt) {
    color = "rgba(255, 0, 229, 0.12)";
    borderColor = "rgba(255, 0, 229, 0.3)";
    textColor = "#ff00e5";
  } else if (isSse) {
    color = "rgba(255, 106, 0, 0.12)";
    borderColor = "rgba(255, 106, 0, 0.3)";
    textColor = "#ff6a00";
  }

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase"
      style={{
        background: color,
        border: `1px solid ${borderColor}`,
        color: textColor,
      }}
    >
      {name}
    </motion.span>
  );
}

// ---- Per-core detail row ----
function CoreDetailRow({
  coreId,
  usage,
  freqMhz,
  history,
  maxFreq,
}: {
  coreId: number;
  usage: number;
  freqMhz: number;
  history: number[];
  maxFreq: number;
}) {
  const freqPercent = maxFreq > 0 ? (freqMhz / maxFreq) * 100 : 0;

  return (
    <motion.div
      className="flex items-center gap-3 py-1.5 px-3 rounded-lg"
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.04)",
      }}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: coreId * 0.02 }}
    >
      {/* Core ID */}
      <span className="text-[10px] text-gray-500 font-mono w-12 shrink-0">
        Core {coreId}
      </span>

      {/* Usage bar */}
      <div className="w-16 shrink-0">
        <div className="progress-track h-1.5">
          <motion.div
            className="h-full rounded-full"
            animate={{
              width: `${usage}%`,
              backgroundColor:
                usage > 90
                  ? "#ff073a"
                  : usage > 60
                  ? "#ff6a00"
                  : "#00f0ff",
            }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
      <span className="text-[10px] text-gray-400 font-mono w-10 text-right shrink-0">
        {usage.toFixed(0)}%
      </span>

      {/* Frequency */}
      <div className="flex-1 min-w-0">
        <div className="progress-track h-1.5">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #00b8d4, #00f0ff)",
            }}
            animate={{ width: `${Math.min(freqPercent, 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
      <span className="text-[10px] text-white font-mono w-16 text-right shrink-0">
        {freqMhz.toFixed(0)} MHz
      </span>

      {/* Sparkline */}
      <FreqSparkline data={history} />
    </motion.div>
  );
}

// ---- Main overlay component ----
export default function CpuDetailOverlay({
  isOpen,
  onClose,
}: CpuDetailOverlayProps) {
  const { data, coreHistory } = useCpuDetailWebSocket(isOpen);

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
            transition={{
              type: "spring",
              damping: 28,
              stiffness: 300,
            }}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(10, 10, 20, 0.95)",
                backdropFilter: "blur(30px)",
                border: "1px solid rgba(0, 240, 255, 0.15)",
                boxShadow:
                  "0 0 60px rgba(0, 240, 255, 0.08), 0 25px 80px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-8 py-5"
                style={{
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                  background:
                    "linear-gradient(180deg, rgba(0, 240, 255, 0.04) 0%, transparent 100%)",
                }}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{
                      background: "rgba(0, 240, 255, 0.1)",
                      border: "1px solid rgba(0, 240, 255, 0.2)",
                    }}
                  >
                    <Cpu className="w-5 h-5 text-neon-cyan" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      CPU Deep Dive
                    </h2>
                    <p className="text-xs text-gray-500">
                      {data?.model_name || "Loading..."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {data && (
                    <AnimatedValue
                      value={data.overall_usage}
                      suffix="%"
                      className="text-2xl font-bold text-white font-mono"
                    />
                  )}
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Loading state */}
              {!data && (
                <div className="flex items-center justify-center py-24">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <Cpu className="w-8 h-8 text-neon-cyan opacity-50" />
                  </motion.div>
                </div>
              )}

              {/* Data content */}
              {data && (
                <div className="p-8 space-y-8">
                  {/* Top row: Identification + Specs + Live */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Identification */}
                    <div
                      className="glass-card p-5 space-y-3"
                      style={{
                        background: "rgba(15, 15, 30, 0.6)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Microchip className="w-4 h-4 text-neon-cyan" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Identification
                        </span>
                      </div>
                      <InfoRow label="Model" value={data.model_name} />
                      <InfoRow label="Architecture" value={data.architecture} />
                      <InfoRow label="Vendor" value={data.vendor} />
                      {data.codename && (
                        <InfoRow label="Codename" value={data.codename} />
                      )}
                      {data.stepping && (
                        <InfoRow label="Stepping" value={data.stepping} />
                      )}
                      {data.revision && (
                        <InfoRow label="Revision" value={data.revision} />
                      )}
                    </div>

                    {/* Specifications */}
                    <div
                      className="glass-card p-5 space-y-3"
                      style={{
                        background: "rgba(15, 15, 30, 0.6)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="w-4 h-4 text-neon-cyan" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Specifications
                        </span>
                      </div>
                      <InfoRow
                        label="Cores"
                        value={`${data.cores_physical} physical / ${data.cores_logical} logical`}
                      />
                      <InfoRow
                        label="Base Clock"
                        value={`${data.base_frequency_mhz.toFixed(0)} MHz`}
                      />
                      {data.max_frequency_mhz && (
                        <InfoRow
                          label="Max Clock"
                          value={`${data.max_frequency_mhz.toFixed(0)} MHz`}
                        />
                      )}
                      {data.tdp_watts && (
                        <InfoRow
                          label="TDP"
                          value={`${data.tdp_watts} W`}
                        />
                      )}

                      <div className="pt-2 space-y-2">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Cache
                        </span>
                        <CacheBar label="L1" value={data.l1_cache} />
                        <CacheBar label="L2" value={data.l2_cache} />
                        <CacheBar label="L3" value={data.l3_cache} />
                        {!data.l1_cache &&
                          !data.l2_cache &&
                          !data.l3_cache && (
                            <span className="text-[11px] text-gray-600">
                              Not available
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Live overview */}
                    <div
                      className="glass-card p-5 flex flex-col items-center justify-center gap-4"
                      style={{
                        background: "rgba(15, 15, 30, 0.6)",
                      }}
                    >
                      <ProgressRing
                        value={data.overall_usage}
                        size={130}
                        strokeWidth={9}
                        color="#00f0ff"
                        glowColor="rgba(0, 240, 255, 0.35)"
                      />

                      <div className="w-full space-y-2 mt-2">
                        {data.temperature != null && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400 flex items-center gap-1">
                              <Thermometer className="w-3 h-3" />
                              Temperature
                            </span>
                            <motion.span
                              className="font-mono font-medium"
                              animate={{
                                color:
                                  data.temperature > 85
                                    ? "#ff073a"
                                    : data.temperature > 70
                                    ? "#ff6a00"
                                    : "#e0e0e0",
                              }}
                            >
                              {data.temperature.toFixed(1)}°C
                            </motion.span>
                          </div>
                        )}
                        {data.voltage != null && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400 flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Voltage
                            </span>
                            <span className="font-mono text-white">
                              {data.voltage.toFixed(3)} V
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Per-Core Detail */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Cpu className="w-4 h-4 text-neon-cyan" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        Per-Core Live Data
                      </span>
                      <span className="text-[10px] text-gray-600 ml-2">
                        {data.per_core_detail.length} Threads
                      </span>

                      {/* Legend */}
                      <div className="ml-auto flex items-center gap-4 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <span
                            className="w-2 h-1 rounded-full inline-block"
                            style={{ background: "#00f0ff" }}
                          />
                          Usage
                        </span>
                        <span className="flex items-center gap-1">
                          <span
                            className="w-2 h-1 rounded-full inline-block"
                            style={{
                              background:
                                "linear-gradient(90deg, #00b8d4, #00f0ff)",
                            }}
                          />
                          Frequency
                        </span>
                        <span className="flex items-center gap-1">
                          <svg width={12} height={8}>
                            <polyline
                              points="0,6 4,2 8,5 12,1"
                              fill="none"
                              stroke="#00f0ff"
                              strokeWidth={1}
                            />
                          </svg>
                          History
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {data.per_core_detail.map((core) => (
                        <CoreDetailRow
                          key={core.core_id}
                          coreId={core.core_id}
                          usage={core.usage_percent}
                          freqMhz={core.frequency_mhz}
                          history={coreHistory[core.core_id] || []}
                          maxFreq={data.max_frequency_mhz || data.base_frequency_mhz || 5000}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Features / Instruction Sets */}
                  {data.features.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-neon-cyan" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Instruction Sets & Features
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {data.features.map((feat, i) => (
                          <motion.div
                            key={feat}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                          >
                            <FeatureBadge name={feat} />
                          </motion.div>
                        ))}
                      </div>
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

// Small helper for info rows
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start text-xs">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-white font-mono text-right ml-3 break-all">
        {value}
      </span>
    </div>
  );
}
