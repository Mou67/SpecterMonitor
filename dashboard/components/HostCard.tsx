"use client";

import { motion } from "framer-motion";
import { Monitor, Cpu, HardDrive, Clock, Thermometer } from "lucide-react";
import { HostSnapshot } from "@/types/metrics";
import Sparkline from "./Sparkline";

interface HostCardProps {
  data: HostSnapshot;
  isSelected: boolean;
  onClick: () => void;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function HostCard({ data, isSelected, onClick }: HostCardProps) {
  const cpuHistory = (data.history || []).map((h) => h.cpu_percent);
  const ramHistory = (data.history || []).map((h) => h.ram_percent);
  const netHistory = (data.history || []).map((h) => h.net_recv_rate / 1024);

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`glass-card p-5 cursor-pointer transition-all duration-300 ${
        isSelected
          ? "ring-1 ring-neon-cyan/30 shadow-neon-cyan"
          : "hover:border-white/10"
      }`}
    >
      {/* Host Name + Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: isSelected
                ? "rgba(0, 240, 255, 0.15)"
                : "rgba(255, 255, 255, 0.05)",
            }}
          >
            <Monitor
              className={`w-4 h-4 ${isSelected ? "text-neon-cyan" : "text-gray-400"}`}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{data.hostname}</h3>
            <p className="text-[10px] text-gray-500 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatUptime(data.uptime_seconds)}
            </p>
          </div>
        </div>
        <motion.div
          className="w-2 h-2 rounded-full bg-neon-green"
          animate={{
            boxShadow: ["0 0 4px #39ff14", "0 0 10px #39ff14", "0 0 4px #39ff14"],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      {/* Sparkline Metrics */}
      <div className="space-y-3">
        {/* CPU */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 w-12">
            <Cpu className="w-3 h-3 text-neon-cyan" />
            <span className="text-[10px] text-gray-400">CPU</span>
          </div>
          <div className="flex-1">
            <Sparkline data={cpuHistory} color="#00f0ff" height={20} />
          </div>
          <span className="text-xs font-mono text-white w-10 text-right">
            {data.cpu.usage_percent.toFixed(0)}%
          </span>
        </div>

        {/* RAM */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 w-12">
            <HardDrive className="w-3 h-3 text-neon-magenta" />
            <span className="text-[10px] text-gray-400">RAM</span>
          </div>
          <div className="flex-1">
            <Sparkline data={ramHistory} color="#ff00e5" height={20} />
          </div>
          <span className="text-xs font-mono text-white w-10 text-right">
            {data.ram.usage_percent.toFixed(0)}%
          </span>
        </div>

        {/* GPU temp if available */}
        {data.gpu.length > 0 && data.gpu[0].temperature != null && (
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Thermometer className="w-2.5 h-2.5" />
              GPU Temp
            </span>
            <motion.span
              className="text-xs font-mono"
              animate={{
                color:
                  data.gpu[0].temperature! > 85
                    ? "#ff073a"
                    : data.gpu[0].temperature! > 70
                    ? "#ff6a00"
                    : "#e0e0e0",
              }}
            >
              {data.gpu[0].temperature}°C
            </motion.span>
          </div>
        )}
      </div>

      {/* Process count */}
      <div className="mt-3 pt-2 border-t border-white/5">
        <span className="text-[10px] text-gray-500">
          {data.processes.length} Processes
        </span>
      </div>
    </motion.div>
  );
}
