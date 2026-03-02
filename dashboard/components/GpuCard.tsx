"use client";

import { motion } from "framer-motion";
import { MemoryStick, Thermometer } from "lucide-react";
import { GpuMetrics } from "@/types/metrics";
import AnimatedValue from "./AnimatedValue";
import ProgressRing from "./ProgressRing";

interface GpuCardProps {
  gpu: GpuMetrics;
}

export default function GpuCard({ gpu }: GpuCardProps) {
  const isCriticalTemp = gpu.temperature != null && gpu.temperature > 85;

  return (
    <div
      className={`glass-card p-6 h-full transition-shadow duration-500 ${
        isCriticalTemp ? "animate-glow-red" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: "rgba(57, 255, 20, 0.1)" }}
          >
            <MemoryStick className="w-5 h-5 text-neon-green" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">GPU</h3>
            <p className="text-xs text-gray-500 truncate max-w-[120px]">{gpu.name}</p>
          </div>
        </div>
        <AnimatedValue
          value={gpu.load_percent}
          suffix="%"
          className="text-2xl font-bold text-white font-mono"
        />
      </div>

      <div className="flex items-center justify-center mb-5">
        <ProgressRing
          value={gpu.load_percent}
          size={120}
          strokeWidth={8}
          color="#39ff14"
          glowColor="rgba(57, 255, 20, 0.3)"
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">VRAM</span>
          <span className="text-white font-mono">
            {gpu.memory_used_mb.toFixed(0)} / {gpu.memory_total_mb.toFixed(0)} MB
          </span>
        </div>

        {gpu.temperature != null && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 flex items-center gap-1">
              <Thermometer className="w-3 h-3" />
              Temperature
            </span>
            <motion.span
              className="font-mono font-medium"
              animate={{
                color: isCriticalTemp ? "#ff073a" : gpu.temperature > 75 ? "#ff6a00" : "#e0e0e0",
              }}
              transition={{ duration: 0.5 }}
            >
              {gpu.temperature.toFixed(0)}°C
            </motion.span>
          </div>
        )}

        {/* VRAM bar */}
        <div className="progress-track h-2 mt-2">
          <motion.div
            className="progress-fill"
            style={{
              background:
                gpu.memory_percent > 90
                  ? "linear-gradient(90deg, #ff073a, #ff6a00)"
                  : "linear-gradient(90deg, #39ff14, #00b36b)",
            }}
            animate={{ width: `${gpu.memory_percent}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    </div>
  );
}
