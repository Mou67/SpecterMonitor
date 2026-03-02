"use client";

import { motion } from "framer-motion";
import { Cpu, Thermometer, ChevronRight } from "lucide-react";
import { CpuMetrics } from "@/types/metrics";
import AnimatedValue from "./AnimatedValue";
import ProgressRing from "./ProgressRing";

interface CpuCardProps {
  cpu: CpuMetrics;
  onClick?: () => void;
}

export default function CpuCard({ cpu, onClick }: CpuCardProps) {
  const isCriticalTemp = cpu.temperature != null && cpu.temperature > 85;

  return (
    <motion.div
      className={`glass-card p-6 h-full transition-shadow duration-500 ${
        isCriticalTemp ? "animate-glow-red" : ""
      } ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02, borderColor: "rgba(0, 240, 255, 0.3)" } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: "rgba(0, 240, 255, 0.1)" }}
          >
            <Cpu className="w-5 h-5 text-neon-cyan" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">CPU</h3>
            <p className="text-xs text-gray-500">
              {cpu.cores_physical}C / {cpu.cores_logical}T
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AnimatedValue
            value={cpu.usage_percent}
            suffix="%"
            className="text-2xl font-bold text-white font-mono"
          />
          {onClick && (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      <div className="flex items-center justify-center mb-5">
        <ProgressRing
          value={cpu.usage_percent}
          size={120}
          strokeWidth={8}
          color="#00f0ff"
          glowColor="rgba(0, 240, 255, 0.3)"
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Frequency</span>
          <span className="text-white font-mono">
            {cpu.frequency_mhz.toFixed(0)} MHz
          </span>
        </div>

        {cpu.temperature != null && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 flex items-center gap-1">
              <Thermometer className="w-3 h-3" />
              Temperature
            </span>
            <motion.span
              className="font-mono font-medium"
              animate={{
                color: isCriticalTemp ? "#ff073a" : cpu.temperature > 70 ? "#ff6a00" : "#e0e0e0",
              }}
              transition={{ duration: 0.5 }}
            >
              {cpu.temperature.toFixed(0)}°C
            </motion.span>
          </div>
        )}

        {/* Usage bar */}
        <div className="progress-track h-2 mt-2">
          <motion.div
            className="progress-fill"
            style={{
              background:
                cpu.usage_percent > 90
                  ? "linear-gradient(90deg, #ff073a, #ff6a00)"
                  : cpu.usage_percent > 60
                  ? "linear-gradient(90deg, #ff6a00, #ffcc00)"
                  : "linear-gradient(90deg, #00f0ff, #00b8d4)",
            }}
            animate={{ width: `${cpu.usage_percent}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* Deep-dive hint */}
        {onClick && (
          <p className="text-[10px] text-gray-600 text-center pt-1">
            Click for details
          </p>
        )}
      </div>
    </motion.div>
  );
}
