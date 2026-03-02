"use client";

import { motion } from "framer-motion";
import { Cpu } from "lucide-react";

interface CoreGridProps {
  cores: number[];
}

function coreColor(percent: number): string {
  if (percent > 90) return "#ff073a";
  if (percent > 70) return "#ff6a00";
  if (percent > 40) return "#00f0ff";
  return "#1a3a4a";
}

function coreGlow(percent: number): string {
  if (percent > 90) return "0 0 8px rgba(255, 7, 58, 0.5)";
  if (percent > 70) return "0 0 6px rgba(255, 106, 0, 0.4)";
  if (percent > 40) return "0 0 6px rgba(0, 240, 255, 0.3)";
  return "none";
}

export default function CoreGrid({ cores }: CoreGridProps) {
  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: "rgba(0, 240, 255, 0.1)" }}
        >
          <Cpu className="w-5 h-5 text-neon-cyan" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">CPU Cores</h3>
          <p className="text-xs text-gray-500">{cores.length} Threads</p>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {cores.map((usage, i) => (
          <motion.div
            key={i}
            className="relative flex flex-col items-center"
            whileHover={{ scale: 1.15, zIndex: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <motion.div
              className="w-full aspect-square rounded-lg flex items-center justify-center cursor-default"
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              animate={{
                backgroundColor: `${coreColor(usage)}20`,
                boxShadow: coreGlow(usage),
              }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="w-3 h-3 rounded-sm"
                animate={{ backgroundColor: coreColor(usage) }}
                transition={{ duration: 0.5 }}
              />
            </motion.div>
            <span className="text-[9px] text-gray-500 mt-1 font-mono">
              {usage.toFixed(0)}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
