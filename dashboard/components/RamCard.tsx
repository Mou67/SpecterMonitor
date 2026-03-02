"use client";

import { motion } from "framer-motion";
import { HardDrive, ChevronRight } from "lucide-react";
import { RamMetrics } from "@/types/metrics";
import AnimatedValue from "./AnimatedValue";
import ProgressRing from "./ProgressRing";

interface RamCardProps {
  ram: RamMetrics;
  onClick?: () => void;
}

export default function RamCard({ ram, onClick }: RamCardProps) {
  return (
    <motion.div
      className={`glass-card p-6 h-full ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02, borderColor: "rgba(255, 0, 229, 0.3)" } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: "rgba(255, 0, 229, 0.1)" }}
          >
            <HardDrive className="w-5 h-5 text-neon-magenta" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">RAM</h3>
            <p className="text-xs text-gray-500">{ram.total_gb.toFixed(1)} GB Total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AnimatedValue
            value={ram.usage_percent}
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
          value={ram.usage_percent}
          size={120}
          strokeWidth={8}
          color="#ff00e5"
          glowColor="rgba(255, 0, 229, 0.3)"
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Used</span>
          <span className="text-white font-mono">{ram.used_gb.toFixed(1)} GB</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Available</span>
          <span className="text-white font-mono">{ram.available_gb.toFixed(1)} GB</span>
        </div>

        <div className="progress-track h-2 mt-2">
          <motion.div
            className="progress-fill"
            style={{
              background:
                ram.usage_percent > 90
                  ? "linear-gradient(90deg, #ff073a, #ff6a00)"
                  : "linear-gradient(90deg, #ff00e5, #b300a0)",
            }}
            animate={{ width: `${ram.usage_percent}%` }}
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
