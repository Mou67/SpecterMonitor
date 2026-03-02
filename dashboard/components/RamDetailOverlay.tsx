"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  HardDrive,
  Layers,
  ArrowLeft,
  MemoryStick,
  Gauge,
  Database,
} from "lucide-react";
import { useRamDetailWebSocket } from "@/hooks/useRamDetailWebSocket";
import AnimatedValue from "./AnimatedValue";
import ProgressRing from "./ProgressRing";

interface RamDetailOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

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

function UsageBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-mono">{value.toFixed(1)} GB</span>
      </div>
      <div className="progress-track h-2.5">
        <motion.div
          className="progress-fill h-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export default function RamDetailOverlay({
  isOpen,
  onClose,
}: RamDetailOverlayProps) {
  const { data } = useRamDetailWebSocket(isOpen);

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
                border: "1px solid rgba(255, 0, 229, 0.15)",
                boxShadow:
                  "0 0 60px rgba(255, 0, 229, 0.08), 0 25px 80px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-8 py-5"
                style={{
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                  background:
                    "linear-gradient(180deg, rgba(255, 0, 229, 0.04) 0%, transparent 100%)",
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
                      background: "rgba(255, 0, 229, 0.1)",
                      border: "1px solid rgba(255, 0, 229, 0.2)",
                    }}
                  >
                    <HardDrive className="w-5 h-5 text-neon-magenta" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      RAM Deep Dive
                    </h2>
                    <p className="text-xs text-gray-500">
                      {data
                        ? `${data.total_gb.toFixed(1)} GB ${data.memory_type || ""}`
                        : "Loading..."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {data && (
                    <AnimatedValue
                      value={data.usage_percent}
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
                    <HardDrive className="w-8 h-8 text-neon-magenta opacity-50" />
                  </motion.div>
                </div>
              )}

              {/* Data content */}
              {data && (
                <div className="p-8 space-y-8">
                  {/* Top row: Physical Details + Performance + Live Ring */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Physical Details */}
                    <div
                      className="glass-card p-5 space-y-3"
                      style={{ background: "rgba(15, 15, 30, 0.6)" }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <MemoryStick className="w-4 h-4 text-neon-magenta" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Physical Details
                        </span>
                      </div>
                      <InfoRow
                        label="Slots"
                        value={`${data.used_slots} of ${data.total_slots} used`}
                      />
                      {data.memory_type && (
                        <InfoRow label="Type" value={data.memory_type} />
                      )}
                      <InfoRow
                        label="Total"
                        value={`${data.total_gb.toFixed(1)} GB`}
                      />
                      {data.modules.length > 0 && data.modules[0].manufacturer && (
                        <InfoRow
                          label="Manufacturer"
                          value={data.modules[0].manufacturer!}
                        />
                      )}
                      {data.modules.length > 0 && data.modules[0].form_factor && (
                        <InfoRow
                          label="Form Factor"
                          value={data.modules[0].form_factor!}
                        />
                      )}
                    </div>

                    {/* Performance */}
                    <div
                      className="glass-card p-5 space-y-3"
                      style={{ background: "rgba(15, 15, 30, 0.6)" }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Gauge className="w-4 h-4 text-neon-magenta" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Performance
                        </span>
                      </div>
                      {data.speed_mhz && (
                        <InfoRow
                          label="Clock Speed"
                          value={`${data.speed_mhz} MHz`}
                        />
                      )}
                      {data.cas_latency && (
                        <InfoRow label="CAS Latency" value={data.cas_latency} />
                      )}
                      <InfoRow
                        label="Commit Limit"
                        value={`${data.commit_limit_gb.toFixed(1)} GB`}
                      />
                      <InfoRow
                        label="Committed"
                        value={`${data.committed_gb.toFixed(1)} GB`}
                      />
                    </div>

                    {/* Live overview ring */}
                    <div
                      className="glass-card p-5 flex flex-col items-center justify-center gap-4"
                      style={{ background: "rgba(15, 15, 30, 0.6)" }}
                    >
                      <ProgressRing
                        value={data.usage_percent}
                        size={130}
                        strokeWidth={9}
                        color="#ff00e5"
                        glowColor="rgba(255, 0, 229, 0.35)"
                      />

                      <div className="w-full space-y-1 mt-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400">Used</span>
                          <span className="font-mono text-white">
                            {data.used_gb.toFixed(1)} GB
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400">Available</span>
                          <span className="font-mono text-white">
                            {data.available_gb.toFixed(1)} GB
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Usage breakdown bars */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Database className="w-4 h-4 text-neon-magenta" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        Usage Breakdown
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <UsageBar
                        label="In Use"
                        value={data.used_gb}
                        max={data.total_gb}
                        color="linear-gradient(90deg, #ff00e5, #b300a0)"
                      />
                      <UsageBar
                        label="Cached"
                        value={data.cached_gb}
                        max={data.total_gb}
                        color="linear-gradient(90deg, #00f0ff, #00b8d4)"
                      />
                      <UsageBar
                        label="Committed"
                        value={data.committed_gb}
                        max={data.commit_limit_gb}
                        color="linear-gradient(90deg, #ff6a00, #cc5500)"
                      />
                      <UsageBar
                        label="Available"
                        value={data.available_gb}
                        max={data.total_gb}
                        color="linear-gradient(90deg, #39ff14, #2bc40e)"
                      />
                    </div>
                  </div>

                  {/* Physical Slot Visualization */}
                  {data.modules.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Layers className="w-4 h-4 text-neon-magenta" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Slot Allocation
                        </span>
                        <span className="text-[10px] text-gray-600 ml-2">
                          {data.used_slots} / {data.total_slots} Slots
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Populated slots */}
                        {data.modules.map((mod, i) => (
                          <motion.div
                            key={`${mod.slot}-${i}`}
                            className="rounded-xl p-4"
                            style={{
                              background: "rgba(255, 0, 229, 0.05)",
                              border: "1px solid rgba(255, 0, 229, 0.15)",
                            }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[10px] text-gray-500 font-mono uppercase">
                                {mod.slot}
                              </span>
                              <span className="text-xs text-neon-magenta font-mono font-bold">
                                {mod.capacity_gb} GB
                              </span>
                            </div>

                            {/* Capacity bar */}
                            <div className="progress-track h-3 mb-2">
                              <motion.div
                                className="progress-fill h-full"
                                style={{
                                  background:
                                    "linear-gradient(90deg, #ff00e5, #b300a0)",
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{
                                  duration: 0.8,
                                  delay: i * 0.1,
                                  ease: [0.22, 1, 0.36, 1],
                                }}
                              />
                            </div>

                            <div className="space-y-0.5 text-[10px]">
                              {mod.speed_mhz && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Clock</span>
                                  <span className="text-gray-300 font-mono">
                                    {mod.speed_mhz} MHz
                                  </span>
                                </div>
                              )}
                              {mod.manufacturer && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Manufacturer</span>
                                  <span className="text-gray-300 font-mono truncate ml-2">
                                    {mod.manufacturer}
                                  </span>
                                </div>
                              )}
                              {mod.part_number && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Model</span>
                                  <span className="text-gray-300 font-mono truncate ml-2">
                                    {mod.part_number}
                                  </span>
                                </div>
                              )}
                              {mod.memory_type && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Type</span>
                                  <span className="text-gray-300 font-mono">
                                    {mod.memory_type}
                                  </span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}

                        {/* Empty slots */}
                        {Array.from({
                          length: Math.max(
                            0,
                            data.total_slots - data.used_slots
                          ),
                        }).map((_, i) => (
                          <motion.div
                            key={`empty-${i}`}
                            className="rounded-xl p-4 flex flex-col items-center justify-center"
                            style={{
                              background: "rgba(255, 255, 255, 0.02)",
                              border: "1px dashed rgba(255, 255, 255, 0.08)",
                              minHeight: 100,
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            transition={{
                              delay: (data.used_slots + i) * 0.05,
                            }}
                          >
                            <span className="text-[10px] text-gray-600 font-mono">
                              Empty
                            </span>
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
