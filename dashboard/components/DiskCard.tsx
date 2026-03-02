"use client";

import { motion } from "framer-motion";
import { Database } from "lucide-react";
import { DiskMetrics } from "@/types/metrics";

interface DiskCardProps {
  disks: DiskMetrics[];
}

export default function DiskCard({ disks }: DiskCardProps) {
  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: "rgba(138, 100, 255, 0.1)" }}
        >
          <Database className="w-5 h-5" style={{ color: "#8a64ff" }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Storage</h3>
          <p className="text-xs text-gray-500">{disks.length} Drive{disks.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="space-y-4">
        {disks.map((disk, i) => (
          <motion.div
            key={disk.mountpoint}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-white truncate max-w-[180px]">
                {disk.mountpoint}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {disk.used_gb.toFixed(0)} / {disk.total_gb.toFixed(0)} GB
              </span>
            </div>
            <div className="progress-track h-2">
              <motion.div
                className="progress-fill"
                style={{
                  background:
                    disk.usage_percent > 90
                      ? "linear-gradient(90deg, #ff073a, #ff6a00)"
                      : disk.usage_percent > 70
                      ? "linear-gradient(90deg, #ff6a00, #ffcc00)"
                      : "linear-gradient(90deg, #8a64ff, #6c3aff)",
                }}
                animate={{ width: `${disk.usage_percent}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-500">
                {disk.free_gb.toFixed(1)} GB free
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                {disk.usage_percent.toFixed(1)}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
