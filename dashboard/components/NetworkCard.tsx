"use client";

import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Network } from "lucide-react";
import { NetworkMetrics } from "@/types/metrics";

interface NetworkCardProps {
  network: NetworkMetrics;
}

function formatRate(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${bytesPerSec.toFixed(0)} B/s`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function NetworkCard({ network }: NetworkCardProps) {
  const maxRate = Math.max(network.bytes_sent_rate, network.bytes_recv_rate, 1);

  return (
    <div className="glass-card p-6 h-full">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: "rgba(255, 106, 0, 0.1)" }}
        >
          <Network className="w-5 h-5 text-neon-orange" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Network</h3>
          <p className="text-xs text-gray-500">Traffic</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Upload */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <ArrowUp className="w-3.5 h-3.5 text-neon-cyan" />
              Upload
            </div>
            <span className="text-sm font-mono text-white">
              {formatRate(network.bytes_sent_rate)}
            </span>
          </div>
          <div className="progress-track h-1.5">
            <motion.div
              className="progress-fill"
              style={{ background: "linear-gradient(90deg, #00f0ff, #00b8d4)" }}
              animate={{
                width: `${Math.min((network.bytes_sent_rate / (1024 * 1024)) * 10, 100)}%`,
              }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Download */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <ArrowDown className="w-3.5 h-3.5 text-neon-green" />
              Download
            </div>
            <span className="text-sm font-mono text-white">
              {formatRate(network.bytes_recv_rate)}
            </span>
          </div>
          <div className="progress-track h-1.5">
            <motion.div
              className="progress-fill"
              style={{ background: "linear-gradient(90deg, #39ff14, #00b36b)" }}
              animate={{
                width: `${Math.min((network.bytes_recv_rate / (1024 * 1024)) * 10, 100)}%`,
              }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Totals */}
        <div className="pt-3 border-t border-white/5 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Total Sent</span>
            <span className="text-gray-300 font-mono">{formatBytes(network.bytes_sent)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Total Received</span>
            <span className="text-gray-300 font-mono">{formatBytes(network.bytes_recv)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
